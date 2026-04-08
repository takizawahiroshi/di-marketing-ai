"""
エージェント選択プランナー。
claude-sonnet-4-6 でユーザーゴールから最適なエージェント2〜4個を選択する。
"""
import re
import json
import os
import anthropic
from .agent_registry import build_agent_list_text, VALID_IDS, AGENT_REGISTRY

client = anthropic.AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_PLANNER_SYSTEM = """あなたはDIマーケティングAIプラットフォームのオーケストレーターです。
ユーザーのマーケティング課題に対して、最適なエージェントを2〜4個選び、実行順序と理由をJSONで返してください。

利用可能なエージェント:
{agent_list}

【選択ルール】
- research系（depth/grouin）はターゲットや本音が不明確な場合に優先
- strategy系はresearchの後、または調査済みデータがある場合は単独で
- creative系はstrategy後が最も効果的（コピーや施策は戦略の後）
- media系は施策フェーズの最後に配置
- 有効なIDのみ使用すること: {valid_ids}

返答は必ずJSON形式のみ（説明文なし、コードブロックなし）:
{{"agents":["agent_id1","agent_id2"],"reason":"なぜこの順番か1〜2文"}}"""


async def plan_task(
    goal: str,
    context: dict,
    forced_agents: list = None,
) -> dict:
    """
    エージェント選択。
    forced_agents が指定された場合はバリデーションのみ行いプランナーをスキップ。
    """
    if forced_agents:
        valid = [a for a in forced_agents if a in AGENT_REGISTRY]
        return {
            "agents": valid or ["strategy"],
            "reason": "手動指定されたエージェントを使用します",
        }

    # コンテキスト状態をプランナーに伝える
    ctx_note = ""
    if context.get("survey"):
        ctx_note += f"\n- 調査データ: あり（{len(context['survey'])}文字）"
    if context.get("persona"):
        ctx_note += "\n- ペルソナ: あり"
    if context.get("brief"):
        ctx_note += "\n- ブリーフ: あり"

    sys_prompt = _PLANNER_SYSTEM.format(
        agent_list=build_agent_list_text(),
        valid_ids=", ".join(VALID_IDS),
    )
    user_msg = f"マーケティング課題: {goal}"
    if ctx_note:
        user_msg += f"\n\n投入済みコンテキスト:{ctx_note}"

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=sys_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = response.content[0].text.strip()
        return _parse_plan(text)
    except Exception as e:
        return {
            "agents": ["strategy"],
            "reason": f"プランナーエラーのためデフォルト選択: {str(e)[:80]}",
        }


def _parse_plan(text: str) -> dict:
    """
    JSONパース + バリデーション + ファジーマッチ。
    無効なエージェントIDを除去し、重複排除・最大4件に制限する。
    """
    try:
        # コードブロック除去
        clean = re.sub(r"```[a-z]*", "", text).strip()
        # JSON部分を抽出
        m = re.search(r"\{[\s\S]*?\}", clean)
        plan = json.loads(m.group(0) if m else clean)
        agents = plan.get("agents", [])
        reason = plan.get("reason", "")

        corrected = []
        for aid in agents:
            if aid in AGENT_REGISTRY:
                corrected.append(aid)
                continue
            # ファジーマッチ（部分一致）
            best = next(
                (v for v in VALID_IDS if v in aid or aid in v), None
            )
            if best:
                corrected.append(best)

        # 重複除去（順序を保持）
        seen = set()
        deduped = [a for a in corrected if not (a in seen or seen.add(a))]

        # 最大4件、空の場合はデフォルト
        final_agents = deduped[:4] or ["strategy", "copy"]

        return {"agents": final_agents, "reason": reason}

    except Exception:
        return {
            "agents": ["strategy"],
            "reason": "JSONパース失敗のためデフォルト選択",
        }
