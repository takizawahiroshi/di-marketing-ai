"""
Anthropic モデル ID の一元管理。
環境変数 ANTHROPIC_MODEL / ANTHROPIC_MODEL_FAST で上書き可能。
アカウント権限問題で 400 が出た場合のヘッジ経路。
"""
import os

ANTHROPIC_MODEL_MAIN = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
ANTHROPIC_MODEL_FAST = os.environ.get("ANTHROPIC_MODEL_FAST", "claude-haiku-4-5-20251001")
