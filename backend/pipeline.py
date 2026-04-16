"""
オーケストレーションパイプライン。
Plan → Execute → Synthesize の3ステップを SSE ストリームとして実行する。
"""
import json
import logging
import uuid
from typing import AsyncGenerator
from .planner import plan_task
from .agent_runner import run_agent_stream, run_synthesis_stream, compress_context
from .memory_store import save_result

_log = logging.getLogger(__name__)


def _task_id() -> str:
    return "task_" + uuid.uuid4().hex[:12]


async def sse_event(event_type: str, data: dict) -> str:
    """SSE 形式の文字列を生成する"""
    payload = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    return f"data: {payload}\n\n"


async def run_pipeline(
    goal: str,
    context: dict,
    forced_agents: list = None,
) -> AsyncGenerator[str, None]:
    """
    メインパイプライン。AsyncGenerator として実装し FastAPI の StreamingResponse に渡す。

    SSE イベント仕様:
      planning    → {task_id}
      plan        → {agents, reason}
      agent_start → {id, num}
      token       → {agent_id, text}
      agent_done  → {id, num}
      compressing → {from, to}
      baton_ready → {to, preview}
      synth_start → {}
      synth_token → {text}
      synth_done  → {synthesis}
      complete    → {task_id}
      error       → {message}
    """
    task_id = _task_id()

    # ── STEP 1: Plan ──────────────────────────────────────────
    yield await sse_event("planning", {"task_id": task_id})

    try:
        plan = await plan_task(goal, context, forced_agents)
    except Exception as e:
        _log.exception("plan step failed")
        yield await sse_event("error", {"message": f"プランニングに失敗しました: {e}"})
        return

    yield await sse_event("plan", {"agents": plan["agents"], "reason": plan["reason"]})

    # ── STEP 2: Execute Agents ────────────────────────────────
    results = []
    chained_context = ""

    for idx, agent_id in enumerate(plan["agents"]):
        num = idx + 1
        yield await sse_event("agent_start", {"id": agent_id, "num": num})

        full_text = ""
        try:
            async for token in run_agent_stream(agent_id, goal, context, chained_context):
                full_text += token
                yield await sse_event("token", {"agent_id": agent_id, "text": token})
        except Exception as e:
            _log.exception("agent step failed agent_id=%s", agent_id)
            yield await sse_event("error", {"message": f"エージェント {agent_id} でエラー: {e}"})
            full_text = full_text or "(エラーのため出力なし)"

        results.append({"agent_id": agent_id, "output": full_text})
        yield await sse_event("agent_done", {"id": agent_id, "num": num})

        # バトン圧縮（最後のエージェントはスキップ）
        next_idx = idx + 1
        if next_idx < len(plan["agents"]):
            next_id = plan["agents"][next_idx]
            yield await sse_event("compressing", {"from": agent_id, "to": next_id})
            chained_context = await compress_context(agent_id, full_text, goal)
            yield await sse_event("baton_ready", {
                "to": next_id,
                "preview": chained_context[:60],
            })

    # ── STEP 3: Synthesize ────────────────────────────────────
    yield await sse_event("synth_start", {})

    synthesis = ""
    try:
        async for token in run_synthesis_stream(goal, results):
            synthesis += token
            yield await sse_event("synth_token", {"text": token})
    except Exception as e:
        _log.exception("synth step failed")
        yield await sse_event("error", {"message": f"統合ステップでエラー: {e}"})

    yield await sse_event("synth_done", {"synthesis": synthesis})

    try:
        await save_result(
            task_id=task_id,
            goal=goal,
            plan=plan,
            results=results,
            synthesis=synthesis,
            context=context,
        )
    except Exception as e:
        _log.warning("save_result failed: %s", e)

    yield await sse_event("complete", {"task_id": task_id})
