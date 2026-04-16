"""
実験ループ — A/B テスト的に同じゴールに対して複数バリアントを走らせ、
結果を比較するためのユーティリティ。

典型的な使い方:

    from backend.experiment_loop import run_experiment

    results = await run_experiment(
        goal="30代女性向け新商品のキャッチコピーを作りたい",
        contexts=[
            {"persona": "田中美咲（32歳・都内会社員・独身）"},
            {"persona": "佐藤由紀（35歳・既婚子持ち・郊外在住）"},
        ],
        forced_agents=["strategy", "copy"],  # 任意
    )

    # results は ExperimentRecord のリスト

内部的には各バリアントに対して pipeline.run_pipeline を SSE 生成器として
回しきり、ストリーム全体を吸い上げたのち synthesis テキストだけを抽出する。
API エンドポイントは現状未配線（将来 /api/experiment として wire up 予定）。
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .pipeline import run_pipeline
from .planner import plan_task
from .models import ANTHROPIC_MODEL_MAIN
import anthropic

_log = logging.getLogger(__name__)


@dataclass
class ExperimentRecord:
    variant_id: str
    goal: str
    context: dict
    forced_agents: Optional[list]
    plan: dict = field(default_factory=dict)
    agent_outputs: list = field(default_factory=list)
    synthesis: str = ""
    errors: list = field(default_factory=list)
    elapsed_s: float = 0.0
    started_at: str = ""
    finished_at: str = ""

    def to_dict(self) -> dict:
        return {
            "variant_id": self.variant_id,
            "goal": self.goal,
            "context_keys": [k for k, v in self.context.items() if v],
            "forced_agents": self.forced_agents,
            "plan": self.plan,
            "agent_outputs": [
                {"agent_id": a["agent_id"], "len": len(a["output"])}
                for a in self.agent_outputs
            ],
            "synthesis_len": len(self.synthesis),
            "errors": self.errors,
            "elapsed_s": round(self.elapsed_s, 2),
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


async def _consume_pipeline(
    goal: str,
    context: dict,
    forced_agents: Optional[list],
    variant_id: str,
) -> ExperimentRecord:
    """pipeline.run_pipeline を1回完走させて構造化結果に変換する"""
    rec = ExperimentRecord(
        variant_id=variant_id,
        goal=goal,
        context=context,
        forced_agents=forced_agents,
        started_at=datetime.now().isoformat(),
    )

    t0 = asyncio.get_event_loop().time()
    agent_buffer: dict[str, str] = {}

    async for sse_line in run_pipeline(goal, context, forced_agents):
        # sse_line 形式: "data: {json}\n\n"
        if not sse_line.startswith("data: "):
            continue
        try:
            payload = json.loads(sse_line[6:].strip())
        except json.JSONDecodeError:
            continue

        t = payload.get("type")
        d = payload.get("data", {})

        if t == "plan":
            rec.plan = {"agents": d.get("agents", []), "reason": d.get("reason", "")}
        elif t == "token":
            agent_id = d.get("agent_id")
            if agent_id:
                agent_buffer[agent_id] = agent_buffer.get(agent_id, "") + d.get("text", "")
        elif t == "agent_done":
            agent_id = d.get("id")
            if agent_id:
                rec.agent_outputs.append({
                    "agent_id": agent_id,
                    "output": agent_buffer.get(agent_id, ""),
                })
        elif t == "synth_done":
            rec.synthesis = d.get("synthesis", "")
        elif t == "error":
            rec.errors.append(d.get("message", ""))

    rec.elapsed_s = asyncio.get_event_loop().time() - t0
    rec.finished_at = datetime.now().isoformat()
    return rec


async def run_experiment(
    goal: str,
    contexts: list[dict],
    forced_agents: Optional[list] = None,
    concurrency: int = 2,
) -> list[ExperimentRecord]:
    """
    複数コンテキストで同じゴールを並列実行し、各結果を返す。

    Args:
      goal: マーケティング課題（全バリアント共通）
      contexts: 各バリアントのコンテキスト dict のリスト
      forced_agents: 指定した場合、全バリアントで同じエージェント列を使う
      concurrency: 同時実行数（デフォルト 2。API レート制限を考慮）

    Returns:
      ExperimentRecord のリスト（contexts と同じ順序）
    """
    if not contexts:
        return []

    sem = asyncio.Semaphore(max(1, concurrency))

    async def _one(i: int, ctx: dict) -> ExperimentRecord:
        async with sem:
            variant_id = f"exp_{uuid.uuid4().hex[:8]}_v{i+1}"
            _log.info("experiment start %s", variant_id)
            try:
                rec = await _consume_pipeline(goal, ctx, forced_agents, variant_id)
            except Exception as e:
                _log.exception("experiment variant %s crashed", variant_id)
                rec = ExperimentRecord(
                    variant_id=variant_id,
                    goal=goal,
                    context=ctx,
                    forced_agents=forced_agents,
                    errors=[f"{e!r}"],
                    started_at=datetime.now().isoformat(),
                    finished_at=datetime.now().isoformat(),
                )
            _log.info(
                "experiment done %s elapsed=%.2fs errors=%d synth_len=%d",
                variant_id, rec.elapsed_s, len(rec.errors), len(rec.synthesis),
            )
            return rec

    return await asyncio.gather(*(_one(i, c) for i, c in enumerate(contexts)))


async def judge_variants(
    goal: str,
    records: list[ExperimentRecord],
    criteria: Optional[str] = None,
) -> dict:
    """
    複数バリアントの synthesis を Claude に読ませて LLM-as-a-Judge で比較する。

    Returns:
      {"ranking": [variant_id, ...], "summary": "..."}

    呼び出し時に有効な API キー（プロセス内 state）が必要。
    """
    from .main import get_api_key

    usable = [r for r in records if r.synthesis]
    if not usable:
        return {"ranking": [], "summary": "比較可能なバリアントがありません（全て失敗）"}

    criteria_text = criteria or (
        "以下の観点で総合評価してください:\n"
        "1. DIケイパビリティへの紐付き\n"
        "2. アクション可能性（具体性・明日から動けるか）\n"
        "3. ターゲット理解の深さ\n"
        "4. 論理展開の質\n"
    )

    blocks = []
    for i, r in enumerate(usable):
        blocks.append(f"【バリアント {i+1}: {r.variant_id}】\n{r.synthesis[:2500]}")
    combined = "\n\n---\n\n".join(blocks)

    client = anthropic.AsyncAnthropic(api_key=get_api_key())
    response = await client.messages.create(
        model=ANTHROPIC_MODEL_MAIN,
        max_tokens=1200,
        system=[{
            "type": "text",
            "text": (
                "あなたはマーケティング戦略のシニアレビュワーです。"
                "複数バリアントのアウトプットを比較し、最も優れたものから順にランキングしてください。"
                "返答は以下の JSON 形式のみ（説明文なし）:\n"
                '{"ranking":["variant_id_a","variant_id_b"],"summary":"1〜3文の総評"}'
            ),
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{
            "role": "user",
            "content": (
                f"【課題】{goal}\n\n"
                f"【評価基準】\n{criteria_text}\n\n"
                f"【比較対象】\n{combined}"
            ),
        }],
    )
    text = response.content[0].text.strip()
    try:
        # ```json ... ``` のマークダウン剥がしに対応
        import re
        clean = re.sub(r"```[a-z]*", "", text).strip().strip("`")
        m = re.search(r"\{[\s\S]*\}", clean)
        return json.loads(m.group(0) if m else clean)
    except Exception as e:
        _log.warning("judge_variants parse failed: %r — raw=%r", e, text[:200])
        return {
            "ranking": [r.variant_id for r in usable],
            "summary": f"ジャッジのJSONパースに失敗。生テキスト: {text[:300]}",
        }
