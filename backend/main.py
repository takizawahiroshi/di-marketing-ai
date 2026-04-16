"""
DI Marketing AI — FastAPI バックエンド
APIキーはダッシュボードの「⚙ 設定」から登録し、プロセス内に保持する。
永続化はしない（再起動後は再設定が必要）。
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from .pipeline import run_pipeline, sse_event
from .planner import plan_task
from .agent_registry import get_agents_metadata, VALID_IDS, build_agent_sys_prompt_blocks, AGENT_REGISTRY
from .memory_store import get_results, get_patterns, get_result_detail
from .models import ANTHROPIC_MODEL_MAIN
from .experiment_loop import run_experiment, judge_variants
from .retry import call_with_retry
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
# ダッシュボードから保存するたびに更新。再起動で消える。
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


# ── ヘルスチェック ────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "agents": len(VALID_IDS),
        "api_key_configured": _API_KEY.startswith("sk-"),
    }


# ── API キー設定 ──────────────────────────────────────────────
@app.get("/api/config")
async def get_config():
    return {
        "api_key_configured": _API_KEY.startswith("sk-"),
        "api_key_masked": _mask_key(_API_KEY) if _API_KEY.startswith("sk-") else "",
    }


@app.post("/api/config")
async def set_config(request: Request):
    body = await request.json()
    api_key = (body.get("api_key") or "").strip()
    if not api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="APIキーは 'sk-' で始まる必要があります")
    _set_api_key(api_key)
    return {"ok": True, "api_key_masked": _mask_key(api_key)}


# ── エージェント一覧 ──────────────────────────────────────────
@app.get("/api/agents")
async def get_agents():
    return {"agents": get_agents_metadata()}


# ── プランナー（デバッグ用） ──────────────────────────────────
@app.post("/api/plan")
async def plan(request: Request):
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


# ── メインパイプライン（SSE ストリーミング） ──────────────────
@app.post("/api/run")
async def run_orchestrator(request: Request):
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


# ── エージェント個別チャット（SSE ストリーミング） ───────────
async def _chat_stream(agent_id: str, messages: list, context: dict, api_key: str):
    """
    エージェント個別チャットを SSE で流す。
    イベント: token {text} / done {} / error {message}
    """
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
async def agent_chat(agent_id: str, request: Request):
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


# ── メモリ取得 ────────────────────────────────────────────────
@app.get("/api/memory/results")
async def memory_results():
    return {"results": await get_results()}


@app.get("/api/memory/results/{task_id}")
async def memory_result_detail(task_id: str):
    rec = await get_result_detail(task_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"task {task_id} が見つかりません")
    return rec


@app.get("/api/memory/patterns")
async def memory_patterns():
    return await get_patterns()


# ── ペルソナデータ ────────────────────────────────────────────
@app.get("/api/personas")
async def personas():
    path = _Path(__file__).parent.parent / "data" / "persona_data.json"
    if not path.exists():
        return {"personas": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"persona_data.json load failed: {e!r}")


# ── 実験ループ（A/B 比較） ───────────────────────────────────
@app.post("/api/experiment")
async def experiment(request: Request):
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


# ── フロントエンド配信 ────────────────────────────────────────
# /api/* 以外のルートは frontend/ の静的ファイルを返す
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
