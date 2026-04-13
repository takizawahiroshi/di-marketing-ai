"""
実験結果の永続化。
data/memory/results.json と patterns.json を asyncio.Lock で排他制御する。
"""
import json
import asyncio
from pathlib import Path
from datetime import datetime

MEMORY_DIR = Path(__file__).parent.parent / "data" / "memory"
RESULTS_PATH = MEMORY_DIR / "results.json"
PATTERNS_PATH = MEMORY_DIR / "patterns.json"

_lock = asyncio.Lock()


def _load_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return default
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def _save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


async def save_result(
    task_id: str,
    goal: str,
    plan: dict,
    results: list,
    synthesis: str,
    context: dict = None,
) -> None:
    """タスク実行結果を results.json に保存する（最大50件）"""
    record = {
        "id": task_id,
        "timestamp": datetime.now().isoformat(),
        "goal": goal,
        "context": {
            "survey_len": len((context or {}).get("survey", "")),
            "persona_len": len((context or {}).get("persona", "")),
            "brief_len":  len((context or {}).get("brief", "")),
        },
        "plan": plan,
        "agent_results": [
            {
                "agent_id": r["agent_id"],
                "output_len": len(r.get("output", "")),
                "baton": r.get("baton", ""),
            }
            for r in results
        ],
        "synthesis_len": len(synthesis),
    }

    async with _lock:
        data = _load_json(RESULTS_PATH, {"version": "1.0", "results": []})
        data["results"].insert(0, record)
        data["results"] = data["results"][:50]
        _save_json(RESULTS_PATH, data)

    await _update_patterns(plan.get("agents", []))


async def get_results(limit: int = 20) -> list:
    data = _load_json(RESULTS_PATH, {"version": "1.0", "results": []})
    return data["results"][:limit]


async def _update_patterns(agents: list) -> None:
    """エージェント組み合わせの使用回数をカウントする"""
    if not agents:
        return
    combo_key = " → ".join(agents)

    async with _lock:
        data = _load_json(PATTERNS_PATH, {"version": "1.0", "combos": [], "updated_at": ""})
        combos = data.get("combos", [])

        found = next((c for c in combos if c["combo"] == combo_key), None)
        if found:
            found["count"] += 1
        else:
            combos.append({"combo": combo_key, "agents": agents, "count": 1})

        # 使用回数でソート
        combos.sort(key=lambda x: x["count"], reverse=True)
        data["combos"] = combos[:50]
        data["updated_at"] = datetime.now().isoformat()
        _save_json(PATTERNS_PATH, data)


async def get_patterns() -> dict:
    return _load_json(PATTERNS_PATH, {"version": "1.0", "combos": [], "updated_at": ""})
