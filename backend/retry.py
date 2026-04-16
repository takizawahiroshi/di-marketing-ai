"""
Anthropic API 呼び出しの自動リトライヘルパー。

対象エラー（指数バックオフ）:
  - 429 rate_limit_error
  - 529 overloaded_error
  - ネットワーク系 APIConnectionError / APITimeoutError

非対象（即座に raise）:
  - 400 invalid_request_error（クレジット不足・パラメータ異常 → リトライ無意味）
  - 401 authentication_error（キー間違い）
  - 403 permission_error
  - 404 not_found_error
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Awaitable, Callable, TypeVar

import anthropic

_log = logging.getLogger(__name__)

T = TypeVar("T")

_RETRYABLE_STATUS = (429, 529)
_RETRYABLE_EXCEPTIONS = (
    anthropic.APIConnectionError,
    anthropic.APITimeoutError,
    anthropic.RateLimitError,      # 429
    anthropic.InternalServerError,  # 500 系（SDK によっては overloaded もここ）
)


def _extract_retry_after(err: Exception) -> float | None:
    """Anthropic / httpx のレスポンスヘッダから retry-after を取り出す（秒）"""
    resp = getattr(err, "response", None)
    if resp is None:
        return None
    headers = getattr(resp, "headers", {}) or {}
    v = headers.get("retry-after") or headers.get("Retry-After")
    if not v:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


async def call_with_retry(
    fn: Callable[[], Awaitable[T]],
    *,
    label: str = "anthropic_call",
    max_attempts: int = 4,
    base_delay: float = 1.5,
    max_delay: float = 20.0,
) -> T:
    """
    非同期関数 fn を呼び出し、リトライ対象エラーの場合のみ指数バックオフで再試行する。

    使い方:
        async def _do():
            return await client.messages.create(...)
        result = await call_with_retry(_do, label="planner")
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            return await fn()
        except anthropic.APIStatusError as e:
            status = getattr(e, "status_code", None)
            if status not in _RETRYABLE_STATUS or attempt >= max_attempts:
                raise
            delay = _extract_retry_after(e)
            if delay is None:
                delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
                delay += random.uniform(0, 0.5)  # jitter
            _log.warning(
                "[retry] %s status=%s attempt=%d/%d sleep=%.2fs",
                label, status, attempt, max_attempts, delay,
            )
            await asyncio.sleep(delay)
        except _RETRYABLE_EXCEPTIONS as e:
            if attempt >= max_attempts:
                raise
            delay = min(max_delay, base_delay * (2 ** (attempt - 1))) + random.uniform(0, 0.5)
            _log.warning(
                "[retry] %s %s attempt=%d/%d sleep=%.2fs",
                label, type(e).__name__, attempt, max_attempts, delay,
            )
            await asyncio.sleep(delay)
