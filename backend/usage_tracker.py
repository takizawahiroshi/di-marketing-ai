"""
プロセス内トークン使用量トラッカー。
各 API 呼び出し後に record_usage() を呼び、/api/usage で返却する。
"""
import asyncio
from dataclasses import dataclass, field
from typing import Literal

# ── Anthropic 料金表（USD / 1M tokens）─────────────────────────
# 2025年モデル価格（ソース: Anthropic pricing page）
_PRICING = {
    # メインモデル（Sonnet 系）
    "main": {
        "input":        3.00,   # uncached input
        "output":      15.00,
        "cache_write":  3.75,   # cache_creation_input_tokens
        "cache_read":   0.30,   # cache_read_input_tokens
    },
    # 高速モデル（Haiku 系）
    "fast": {
        "input":        0.80,
        "output":       4.00,
        "cache_write":  1.00,
        "cache_read":   0.08,
    },
}

ModelKind = Literal["main", "fast"]


@dataclass
class UsageBucket:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_create_tokens: int = 0
    cache_read_tokens: int = 0

    def add(
        self,
        input_tokens: int,
        output_tokens: int,
        cache_create_tokens: int,
        cache_read_tokens: int,
    ) -> None:
        self.calls += 1
        self.input_tokens += input_tokens
        self.output_tokens += output_tokens
        self.cache_create_tokens += cache_create_tokens
        self.cache_read_tokens += cache_read_tokens

    def cost_usd(self, kind: ModelKind) -> float:
        p = _PRICING[kind]
        return (
            self.input_tokens        * p["input"]        / 1_000_000
            + self.output_tokens     * p["output"]       / 1_000_000
            + self.cache_create_tokens * p["cache_write"] / 1_000_000
            + self.cache_read_tokens * p["cache_read"]   / 1_000_000
        )

    def savings_usd(self, kind: ModelKind) -> float:
        """キャッシュ未使用の場合と比べた節約額"""
        p = _PRICING[kind]
        # cache_read_tokens が uncached input になっていた場合のコスト差分
        return self.cache_read_tokens * (p["input"] - p["cache_read"]) / 1_000_000

    def to_dict(self, kind: ModelKind) -> dict:
        cost = self.cost_usd(kind)
        savings = self.savings_usd(kind)
        return {
            "calls": self.calls,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_create_tokens": self.cache_create_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "cost_usd": round(cost, 6),
            "savings_usd": round(savings, 6),
        }


@dataclass
class _UsageStore:
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    main: UsageBucket = field(default_factory=UsageBucket)
    fast: UsageBucket = field(default_factory=UsageBucket)


_store = _UsageStore()


async def record_usage(
    kind: ModelKind,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_create_tokens: int = 0,
    cache_read_tokens: int = 0,
) -> None:
    """API 呼び出しが終わったら呼ぶ。スレッドセーフ。"""
    async with _store._lock:
        bucket: UsageBucket = getattr(_store, kind)
        bucket.add(input_tokens, output_tokens, cache_create_tokens, cache_read_tokens)


async def get_usage_stats() -> dict:
    """現在の累計統計を返す。"""
    async with _store._lock:
        main = _store.main.to_dict("main")
        fast = _store.fast.to_dict("fast")
        total_cost = main["cost_usd"] + fast["cost_usd"]
        total_savings = main["savings_usd"] + fast["savings_usd"]
        return {
            "main": main,
            "fast": fast,
            "total_cost_usd": round(total_cost, 6),
            "total_savings_usd": round(total_savings, 6),
        }


async def reset_usage_stats() -> None:
    """統計をリセットする（/api/usage/reset 用）。"""
    async with _store._lock:
        _store.main = UsageBucket()
        _store.fast = UsageBucket()
