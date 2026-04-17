"""
DI Marketing AI — FastAPI バックエンド
APIキーはダッシュボードの「⚙ 設定」から登録し、プロセス内に保持する。
永続化はしない（再起動後は再設定が必要）。
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles

from .pipeline import run_pipeline, sse_event
from .planner import plan_task
from .agent_registry import get_agents_metadata, VALID_IDS, build_agent_sys_prompt_blocks, AGENT_REGISTRY
from .memory_store import get_results, get_patterns, get_result_detail
from .models import ANTHROPIC_MODEL_MAIN
from .experiment_loop import run_experiment, judge_variants
from .retry import call_with_retry
from .usage_tracker import get_usage_stats, reset_usage_stats
from .exporter import export_to_docx, export_to_pptx, export_to_pdf
from .auth import (
    has_any_user, list_users, create_user, delete_user, update_user_role,
    authenticate, create_token,
    get_current_user, require_role,
    ROLES, ROLE_LABELS,
)
import anthropic as _anthropic
import json
import logging
from pathlib import Path as _Path

_log = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

app = FastAPI(
    title="DI Marketing AI",
    description="DI マーケティングAIプラットフォーム — バックエンドAPI",
    version="1.0.0",
)

_ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.digitalidentity\.co\.jp$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── APIキー管理（プロセス内 state） ───────────────────────────
_API_KEY: str = ""


def get_api_key() -> str:
    return _API_KEY


def _set_api_key(key: str) -> None:
    global _API_KEY
    _API_KEY = key


def _mask_key(key: str) -> str:
    if not key or len(key) < 12:
        return ""
    return f"{key[:7]}…{key[-4:]}"


# ── ヘルスチェック（公開） ───────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "agents": len(VALID_IDS),
        "api_key_configured": _API_KEY.startswith("sk-"),
    }


# ── 認証エンドポイント（公開） ───────────────────────────────
@app.get("/api/auth/status")
async def auth_status():
    """初回セットアップが必要かどうかを返す。フロントエンドの初期化に使用。"""
    return {"setup_required": not await has_any_user()}


@app.post("/api/auth/setup")
async def auth_setup(request: Request):
    """ユーザーが1人もいない場合のみ: 最初の Owner アカウントを作成する。"""
    if await has_any_user():
        raise HTTPException(status_code=400, detail="既にセットアップ済みです")
    body = await request.json()
    email    = (body.get("email") or "").strip()
    name     = (body.get("name") or "").strip()
    password = (body.get("password") or "").strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="email と password は必須です")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上にしてください")
    try:
        user = await create_user(email, name, "owner", password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"token": create_token(user), "user": user}


@app.post("/api/auth/login")
async def auth_login(request: Request):
    body = await request.json()
    user = await authenticate(
        body.get("email", ""),
        body.get("password", ""),
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail="メールアドレスまたはパスワードが正しくありません",
        )
    return {"token": create_token(user), "user": user}


@app.get("/api/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


# ── ユーザー管理（admin+） ───────────────────────────────────
@app.get("/api/auth/users")
async def auth_list_users(_: dict = Depends(require_role("admin"))):
    return {"users": await list_users()}


@app.post("/api/auth/users")
async def auth_create_user(
    request: Request,
    _: dict = Depends(require_role("owner")),
):
    body = await request.json()
    email    = (body.get("email") or "").strip()
    name     = (body.get("name") or "").strip()
    role     = (body.get("role") or "member")
    password = (body.get("password") or "").strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="email と password は必須です")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上にしてください")
    if role not in ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"ロールは {', '.join(ROLES)} から選んでください",
        )
    try:
        return await create_user(email, name, role, password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/auth/users/{user_id}")
async def auth_update_role(
    user_id: str,
    request: Request,
    me: dict = Depends(require_role("owner")),
):
    body = await request.json()
    new_role = (body.get("role") or "").strip()
    if new_role not in ROLES:
        raise HTTPException(status_code=400, detail=f"不正なロール: {new_role}")
    if user_id == me["id"] and new_role != "owner":
        raise HTTPException(status_code=400, detail="自分自身のロールは変更できません")
    updated = await update_user_role(user_id, new_role)
    if not updated:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    return updated


@app.delete("/api/auth/users/{user_id}")
async def auth_delete_user(
    user_id: str,
    me: dict = Depends(require_role("owner")),
):
    if user_id == me["id"]:
        raise HTTPException(status_code=400, detail="自分自身は削除できません")
    if not await delete_user(user_id):
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    return {"ok": True}


# ── API キー設定（owner のみ書き込み） ───────────────────────
@app.get("/api/config")
async def get_config(_: dict = Depends(require_role("admin"))):
    return {
        "api_key_configured": _API_KEY.startswith("sk-"),
        "api_key_masked": _mask_key(_API_KEY) if _API_KEY.startswith("sk-") else "",
    }


@app.post("/api/config")
async def set_config(
    request: Request,
    _: dict = Depends(require_role("owner")),
):
    body = await request.json()
    api_key = (body.get("api_key") or "").strip()
    if not api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="APIキーは 'sk-' で始まる必要があります")
    _set_api_key(api_key)
    return {"ok": True, "api_key_masked": _mask_key(api_key)}


# ── エージェント一覧（公開） ──────────────────────────────────
@app.get("/api/agents")
async def get_agents():
    return {"agents": get_agents_metadata()}


# ── プランナー（member+） ─────────────────────────────────────
@app.post("/api/plan")
async def plan(
    request: Request,
    _: dict = Depends(require_role("member")),
):
    _require_api_key()
    body = await request.json()
    goal = body.get("goal", "")
    if not goal:
        raise HTTPException(status_code=400, detail="goal は必須です")
    context = body.get("context", {})
    forced_agents = body.get("forced_agents")
    result = await plan_task(goal, context, forced_agents)
    return result


def _require_api_key() -> str:
    if not _API_KEY.startswith("sk-"):
        raise HTTPException(
            status_code=403,
            detail="APIキーが未設定です。右上の「⚙ 設定」からAPIキーを登録してください。",
        )
    return _API_KEY


# ── メインパイプライン（member+） ────────────────────────────
@app.post("/api/run")
async def run_orchestrator(
    request: Request,
    current_user: dict = Depends(require_role("member")),
):
    _require_api_key()
    body = await request.json()
    goal = body.get("goal", "").strip()
    if not goal:
        raise HTTPException(status_code=400, detail="goal は必須です")

    context = body.get("context", {})
    forced_agents = body.get("forced_agents")

    return StreamingResponse(
        run_pipeline(goal, context, forced_agents),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── エージェント個別チャット（member+） ─────────────────────
async def _chat_stream(agent_id: str, messages: list, context: dict, api_key: str):
    sys_blocks = build_agent_sys_prompt_blocks(agent_id, context, di_mode=False)
    client = _anthropic.AsyncAnthropic(api_key=api_key)
    try:
        async with client.messages.stream(
            model=ANTHROPIC_MODEL_MAIN,
            max_tokens=1800,
            system=sys_blocks,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield await sse_event("token", {"text": text})
            try:
                final = await stream.get_final_message()
                u = getattr(final, "usage", None)
                if u is not None:
                    _log.info(
                        "chat=%s cache_read=%s cache_create=%s input=%s output=%s",
                        agent_id,
                        getattr(u, "cache_read_input_tokens", 0),
                        getattr(u, "cache_creation_input_tokens", 0),
                        getattr(u, "input_tokens", 0),
                        getattr(u, "output_tokens", 0),
                    )
            except Exception as e:
                _log.debug("usage fetch skipped: %r", e)
        yield await sse_event("done", {})
    except Exception as e:
        _log.exception("chat stream failed agent_id=%s", agent_id)
        yield await sse_event("error", {"message": f"chat エラー: {e!r}"})


@app.post("/api/agents/{agent_id}/chat")
async def agent_chat(
    agent_id: str,
    request: Request,
    _: dict = Depends(require_role("member")),
):
    api_key = _require_api_key()
    if agent_id not in AGENT_REGISTRY:
        raise HTTPException(status_code=404, detail=f"エージェント '{agent_id}' が見つかりません")
    body = await request.json()
    messages = body.get("messages", [])
    context = body.get("context", {})
    if not messages:
        raise HTTPException(status_code=400, detail="messages は必須です")

    return StreamingResponse(
        _chat_stream(agent_id, messages, context, api_key),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── メモリ取得（viewer+） ────────────────────────────────────
@app.get("/api/memory/results")
async def memory_results(_: dict = Depends(require_role("viewer"))):
    return {"results": await get_results()}


@app.get("/api/memory/results/{task_id}")
async def memory_result_detail(
    task_id: str,
    _: dict = Depends(require_role("viewer")),
):
    rec = await get_result_detail(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"task {task_id} が見つかりません")
    return rec


@app.get("/api/memory/patterns")
async def memory_patterns(_: dict = Depends(require_role("viewer"))):
    return await get_patterns()


# ── ペルソナデータ（公開） ───────────────────────────────────
@app.get("/api/personas")
async def personas():
    path = _Path(__file__).parent.parent / "data" / "persona_data.json"
    if not path.exists():
        return {"personas": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"persona_data.json load failed: {e!r}")


# ── 実験ループ（member+） ───────────────────────────────────
@app.post("/api/experiment")
async def experiment(
    request: Request,
    _: dict = Depends(require_role("member")),
):
    _require_api_key()
    body = await request.json()
    goal = (body.get("goal") or "").strip()
    if not goal:
        raise HTTPException(status_code=400, detail="goal は必須です")
    contexts = body.get("contexts") or []
    if not isinstance(contexts, list) or not contexts:
        raise HTTPException(status_code=400, detail="contexts（dict配列）は必須です")
    forced_agents = body.get("forced_agents")
    concurrency = int(body.get("concurrency", 2))
    use_judge = bool(body.get("judge", False))

    records = await run_experiment(
        goal=goal,
        contexts=contexts,
        forced_agents=forced_agents,
        concurrency=concurrency,
    )
    payload = {"records": [r.to_dict() for r in records]}
    if use_judge:
        payload["judge"] = await judge_variants(goal, records)
    return payload


# ── 使用量・コストダッシュボード（admin+） ───────────────────
@app.get("/api/usage")
async def get_usage(_: dict = Depends(require_role("admin"))):
    return await get_usage_stats()


@app.post("/api/usage/reset")
async def reset_usage(_: dict = Depends(require_role("admin"))):
    await reset_usage_stats()
    return {"ok": True}


# ── リッチ export（member+） ──────────────────────────────────
_EXPORT_MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pdf":  "application/pdf",
}


@app.post("/api/export/{fmt}")
async def export_output(
    fmt: str,
    request: Request,
    _: dict = Depends(require_role("member")),
):
    if fmt not in _EXPORT_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"未対応フォーマット: {fmt}。docx / pptx / pdf から選んでください",
        )
    body = await request.json()
    try:
        if fmt == "docx":
            data = export_to_docx(body)
        elif fmt == "pptx":
            data = export_to_pptx(body)
        else:
            data = export_to_pdf(body)
    except Exception as e:
        _log.exception("export failed fmt=%s", fmt)
        raise HTTPException(status_code=500, detail=f"export 生成エラー: {e!r}")

    return Response(
        content=data,
        media_type=_EXPORT_MIME[fmt],
        headers={"Content-Disposition": f"attachment; filename=di-output.{fmt}"},
    )


# ── フロントエンド配信 ────────────────────────────────────────
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
