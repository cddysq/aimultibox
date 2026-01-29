# -*- coding: utf-8 -*-
"""认证模块 - 鉴权与会话"""

from __future__ import annotations

import httpx
from datetime import datetime, timezone
from typing import Optional

from aimultibox.core.config import settings
from aimultibox.auth import repo as auth_repo


class AuthError(Exception):
    """认证错误"""


async def verify_google_token(id_token: str) -> dict:
    """校验 Google ID Token"""
    if not settings.google_client_id:
        raise AuthError("Google 客户端未配置")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
        )
    if resp.status_code != 200:
        raise AuthError("Google Token 校验失败")

    data = resp.json()
    if data.get("aud") != settings.google_client_id:
        raise AuthError("Google Token 受众不匹配")

    exp = data.get("exp")
    if exp and int(exp) < int(datetime.now(timezone.utc).timestamp()):
        raise AuthError("Google Token 已过期")

    return {
        "sub": data.get("sub"),
        "email": data.get("email"),
        "name": data.get("name"),
        "picture": data.get("picture"),
    }


def create_session(user_id: str) -> tuple[str, datetime]:
    """创建会话"""
    return auth_repo.create_session(user_id, settings.auth_session_days)


def get_user_by_session(session_id: str) -> Optional[dict]:
    """通过会话获取用户"""
    return auth_repo.get_user_by_session(session_id)


def delete_session(session_id: str) -> None:
    """删除会话"""
    auth_repo.delete_session(session_id)
