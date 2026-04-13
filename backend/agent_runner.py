"""
エージェント実行エンジン。
anthropic SDK の streaming API を使用してトークンを非同期 yield する。
"""
import asyncio
import os
from typing import AsyncGenerator
import anthropic
from .agent_registry import build_agent_sys_prompt, AGENT_REGISTRY
from .knowledge_loader import get_knowledge_text

client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


async def run_agent_stream(
    agent_id: str,
    goal: str,
    context: dict,
    chained_context: str = "",
) -> AsyncGenerator[str, None]:
    """
    エージェントを実行し、テキストトークンを非同期で yield する。
    anthropic SDK の stream() コンテキストマネージャを使用。
    """
    sys_prompt = build_agent_sys_prompt(agent_id, context, chained_context)
    user_msg = f"【メインタスク】{goal}\n\n上記タスクに対して、最高品質のアウトプットを出してください。"

    max_tokens = AGENT_REGISTRY.get(agent_id, {}).get("max_tokens", 1800)

    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=sys_prompt,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def run_synthesis_stream(
    goal: str,
    results: list,
) -> AsyncGenerator[str, None]:
    """
    統合ステップ。各エージェント出力（先頭800字）を結合して統合プロンプトに渡す。
    """
    combined_parts = []
    for r in results:
        agent_name = AGENT_REGISTRY.get(r["agent_id"], {}).get("name", r["agent_id"])
        combined_parts.append(
            f"【{agent_name}】\n{r['output'][:800]}"
        )
    combined = "\n\n".join(combined_parts)

    knowledge = get_knowledge_text(max_chars=3000)
    sys_prompt = (
        knowledge
        + "\n\nあなたはDIのシンセサイザーAIです。"
        "複数エージェントの出力を統合し、クライアントへの最終アウトプットとして整理してください。"
        "重複を除き、論理的な順序で、アクションにつながる形でまとめてください。"
        "マークダウン形式で見やすく構造化してください。"
    )

    async with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=2200,
        system=sys_prompt,
        messages=[
            {
                "role": "user",
                "content": f"マーケティング課題: {goal}\n\n各エージェントの出力:\n{combined}",
            }
        ],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def compress_context(
    agent_id: str,
    output: str,
    goal: str,
) -> str:
    """
    Priority C: Haiku で150字以内に圧縮（バトン渡し）。
    8秒タイムアウト、失敗時は先頭150字にフォールバック。
    """
    if len(output) < 200:
        return output[:200]

    agent_name = AGENT_REGISTRY.get(agent_id, {}).get("name", agent_id)
    prompt = (
        f"以下のAI出力を「次のエージェントへのバトン」として150字以内に圧縮してください。\n"
        f"目的：{goal[:80]}\n"
        f"エージェント：{agent_name}\n"
        f"出力（抜粋）：\n{output[:800]}\n\n"
        "【圧縮ルール】\n"
        "- 次エージェントが引き継ぐべき核心的な発見・決定・数値のみを残す\n"
        "- 「〜が判明した」形式の断定文で\n"
        "- 150字以内、1文で\n"
        "圧縮文のみ出力（前後の説明不要）:"
    )

    try:
        response = await asyncio.wait_for(
            client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=180,
                messages=[{"role": "user", "content": prompt}],
            ),
            timeout=8.0,
        )
        compressed = response.content[0].text.strip()
        return compressed or output[:150]
    except Exception:
        return output[:150]
