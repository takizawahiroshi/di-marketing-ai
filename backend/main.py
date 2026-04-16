"""
DI Marketing AI — FastAPI バックエンド
APIキーは backend/.env の ANTHROPIC_API_KEY で管理する。
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# .env 読み込み（backend/.env）
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .pipeline import run_pipeline
from .planner import plan_task
from .agent_registry import get_agents_metadata, VALID_IDS, build_agent_sys_prompt, AGENT_REGISTRY
from .memory_store import get_results, get_patterns
import anthropic as _anthropic

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

app = FastAPI(
    title="DI Marketing AI",
    description="DI マーケティングAIプラットフォーム — バックエンドAPI",
    version="1.0.0",
)

_ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5500,null",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.digitalidentity\.co\.jp$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── ヘルスチェック ────────────────────────────────────────────
@app.get("/api/health")
async def health():
    api_key_set = bool(os.environ.get("ANTHROPIC_API_KEY", "").startswith("sk-"))
    return {
        "status": "ok",
        "agents": len(VALID_IDS),
        "api_key_configured": api_key_set,
    }


# ── エージェント一覧 ──────────────────────────────────────────
@app.get("/api/agents")
async def get_agents():
    return {"agents": get_agents_metadata()}


# ── プランナー（デバッグ用） ──────────────────────────────────
@app.post("/api/plan")
async def plan(request: Request):
    body = await request.json()
    goal = body.get("goal", "")
    if not goal:
        raise HTTPException(status_code=400, detail="goal は必須です")
    context = body.get("context", {})
    forced_agents = body.get("forced_agents")
    result = await plan_task(goal, context, forced_agents)
    return result


# ── メインパイプライン（SSE ストリーミング） ──────────────────
@app.post("/api/run")
async def run_orchestrator(request: Request):
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


# ── エージェント個別チャット ──────────────────────────────────
@app.post("/api/agents/{agent_id}/chat")
async def agent_chat(agent_id: str, request: Request):
    if agent_id not in AGENT_REGISTRY:
        raise HTTPException(status_code=404, detail=f"エージェント '{agent_id}' が見つかりません")
    body = await request.json()
    messages = body.get("messages", [])
    context = body.get("context", {})
    if not messages:
        raise HTTPException(status_code=400, detail="messages は必須です")

    sys_prompt = build_agent_sys_prompt(agent_id, context)
    client = _anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1800,
        system=sys_prompt,
        messages=messages,
    )
    return {"reply": response.content[0].text}


# ── メモリ取得 ────────────────────────────────────────────────
@app.get("/api/memory/results")
async def memory_results():
    return {"results": await get_results()}


@app.get("/api/memory/patterns")
async def memory_patterns():
    return await get_patterns()


# ── フロントエンド配信 ────────────────────────────────────────
# /api/* 以外のルートは frontend/ の静的ファイルを返す
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
