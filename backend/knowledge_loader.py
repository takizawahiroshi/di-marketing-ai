"""
di-knowledge.json の読み込みと提供。
lru_cache で起動時に1回だけ読み込む。
"""
import json
from pathlib import Path
from functools import lru_cache

DATA_DIR = Path(__file__).parent.parent / "data"


@lru_cache(maxsize=1)
def _load_blocks() -> tuple:
    """JSON を読み込んでタプルで返す（lru_cache のため immutable にする）"""
    path = DATA_DIR / "di-knowledge.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return tuple(data["blocks"])


def get_knowledge_text(max_chars: int = 5000, categories: list = None) -> str:
    """
    全ブロックを連結したテキストを返す。
    categories を指定するとそのカテゴリのみ返す。
    max_chars で文字数を制限する。
    """
    blocks = list(_load_blocks())
    if categories:
        blocks = [b for b in blocks if b.get("category") in categories]
    text = "\n\n".join(b["content"] for b in blocks)
    return text[:max_chars]


def get_knowledge_by_category(category: str, max_blocks: int = 5) -> str:
    blocks = [b for b in _load_blocks() if b.get("category") == category]
    return "\n\n".join(b["content"] for b in blocks[:max_blocks])
