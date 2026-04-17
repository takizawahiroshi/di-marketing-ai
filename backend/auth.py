"""
認証・認可モジュール。
JWT (HS256) + bcrypt パスワードハッシュ + JSON ファイルユーザーストア。

ロール階層（小さいほど権限が高い）:
  owner(0) > admin(1) > member(2) > viewer(3)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt as _bcrypt

_log = logging.getLogger(__name__)

# ── 設定 ──────────────────────────────────────────────────────
# JWT_SECRET 未設定時は起動ごとに生成（再起動でトークン失効）
_SECRET_KEY = os.environ.get("JWT_SECRET", secrets.token_hex(32))
_ALGORITHM  = "HS256"
_TOKEN_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

_USERS_FILE = Path(__file__).parent.parent / "data" / "users.json"
_lock = asyncio.Lock()
_bearer = HTTPBearer(auto_error=False)


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# ── ロール定義 ────────────────────────────────────────────────
ROLES = ["owner", "admin", "member", "viewer"]
_ROLE_LEVEL = {r: i for i, r in enumerate(ROLES)}

ROLE_LABELS = {
    "owner":  "オーナー",
    "admin":  "管理者",
    "member": "メンバー",
    "viewer": "閲覧者",
}


def role_ok(user_role: str, required: str) -> bool:
    """user_role が required 以上の権限を持つか"""
    return _ROLE_LEVEL.get(user_role, 99) <= _ROLE_LEVEL.get(required, 99)


# ── ユーザーストア ────────────────────────────────────────────
def _public(user: dict) -> dict:
    """hashed_password を除いた安全な辞書を返す"""
    return {k: v for k, v in user.items() if k != "hashed_password"}


async def _load() -> list[dict]:
    async with _lock:
        if not _USERS_FILE.exists():
            return []
        try:
            return json.loads(_USERS_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            _log.warning("users.json load failed: %r", e)
            return []


async def _save(users: list[dict]) -> None:
    async with _lock:
        _USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _USERS_FILE.write_text(
            json.dumps(users, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


async def has_any_user() -> bool:
    return bool(await _load())


async def list_users() -> list[dict]:
    return [_public(u) for u in await _load()]


async def create_user(
    email: str, name: str, role: str, password: str
) -> dict:
    users = await _load()
    if any(u["email"].lower() == email.lower() for u in users):
        raise ValueError(f"{email} は既に登録されています")
    user: dict = {
        "id":              "u_" + uuid.uuid4().hex[:12],
        "email":           email.lower().strip(),
        "name":            name.strip() or email.split("@")[0],
        "role":            role,
        "hashed_password": _hash_password(password),
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    users.append(user)
    await _save(users)
    return _public(user)


async def delete_user(user_id: str) -> bool:
    users = await _load()
    new = [u for u in users if u["id"] != user_id]
    if len(new) == len(users):
        return False
    await _save(new)
    return True


async def update_user_role(user_id: str, new_role: str) -> Optional[dict]:
    users = await _load()
    for u in users:
        if u["id"] == user_id:
            u["role"] = new_role
            await _save(users)
            return _public(u)
    return None


# ── 認証 ─────────────────────────────────────────────────────
async def authenticate(email: str, password: str) -> Optional[dict]:
    users = await _load()
    user = next((u for u in users if u["email"] == email.lower().strip()), None)
    if not user:
        return None
    if not _verify_password(password, user.get("hashed_password", "")):
        return None
    return _public(user)


def create_token(user: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {
            "sub":   user["id"],
            "email": user["email"],
            "name":  user["name"],
            "role":  user["role"],
            "exp":   expire,
        },
        _SECRET_KEY,
        algorithm=_ALGORITHM,
    )


# ── FastAPI 依存関係 ──────────────────────────────────────────
async def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Bearer トークンからユーザーを取得。認証失敗は 401。"""
    if not cred:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンが必要です",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        p = jwt.decode(cred.credentials, _SECRET_KEY, algorithms=[_ALGORITHM])
        return {"id": p["sub"], "email": p["email"], "name": p["name"], "role": p["role"]}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="トークンが無効または期限切れです",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(minimum: str):
    """指定ロール以上でなければ 403 を返す依存関係ファクトリ。"""
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if not role_ok(user["role"], minimum):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"この操作には {minimum} 以上の権限が必要です",
            )
        return user
    return dep
