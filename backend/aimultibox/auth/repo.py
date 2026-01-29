# -*- coding: utf-8 -*-
"""认证模块 - 数据访问（私有）"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, delete

from aimultibox.db import session_scope
from aimultibox.auth.models import User, UserIdentity, Client, Session


def upsert_client(client_id: str, user_id: Optional[str] = None) -> None:
    """记录客户端访问"""
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        existing = session.get(Client, client_id)
        if existing:
            if user_id and not existing.user_id:
                existing.user_id = user_id
            existing.last_seen_at = now
        else:
            session.add(Client(id=client_id, user_id=user_id, last_seen_at=now))


def link_client_to_user(client_id: str, user_id: str) -> None:
    """绑定客户端与用户"""
    with session_scope() as session:
        client = session.get(Client, client_id)
        if client:
            client.user_id = user_id
        else:
            session.add(Client(id=client_id, user_id=user_id, last_seen_at=datetime.now(timezone.utc)))


def get_user(user_id: str) -> Optional[dict]:
    """获取用户信息"""
    with session_scope() as session:
        user = session.get(User, user_id)
        return _to_user_dict(user) if user else None


def get_or_create_user_from_identity(provider: str, subject: str,
                                     email: Optional[str], name: Optional[str],
                                     avatar_url: Optional[str]) -> dict:
    """获取或创建用户"""
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        identity = session.execute(
            select(UserIdentity).where(
                UserIdentity.provider == provider,
                UserIdentity.provider_subject == subject,
            )
        ).scalar_one_or_none()

        if identity:
            identity.email = email
            identity.name = name
            identity.avatar_url = avatar_url
            identity.updated_at = now

            user = session.get(User, identity.user_id)
            if user:
                user.display_name = name
                user.email = email
                user.avatar_url = avatar_url
                user.updated_at = now
        else:
            user = User(
                id=str(uuid.uuid4()),
                display_name=name,
                email=email,
                avatar_url=avatar_url,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            session.add(UserIdentity(
                user_id=user.id,
                provider=provider,
                provider_subject=subject,
                email=email,
                name=name,
                avatar_url=avatar_url,
                created_at=now,
                updated_at=now,
            ))

        session.flush()
        return _to_user_dict(user)


def create_session(user_id: str, expires_in_days: int) -> tuple[str, datetime]:
    """创建会话"""
    session_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_in_days)
    with session_scope() as session:
        session.add(Session(
            id=session_id,
            user_id=user_id,
            last_seen_at=now,
            expires_at=expires_at,
        ))
    return session_id, expires_at


def get_user_by_session(session_id: str) -> Optional[dict]:
    """通过会话获取用户"""
    if not session_id:
        return None
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        record = session.get(Session, session_id)
        if not record:
            return None
        if record.expires_at and record.expires_at < now:
            session.delete(record)
            return None
        record.last_seen_at = now
        user = session.get(User, record.user_id)
        return _to_user_dict(user) if user else None


def delete_session(session_id: str) -> None:
    """删除会话"""
    if not session_id:
        return
    with session_scope() as session:
        session.execute(delete(Session).where(Session.id == session_id))


def cleanup_expired_sessions() -> int:
    """清理过期会话"""
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        result = session.execute(delete(Session).where(Session.expires_at < now))
        return result.rowcount or 0


def cleanup_old_clients(days: int = 30) -> int:
    """清理长时间未访问的匿名客户端"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        result = session.execute(
            delete(Client).where(
                Client.user_id.is_(None),
                Client.last_seen_at.is_not(None),
                Client.last_seen_at < cutoff,
            )
        )
        return result.rowcount or 0


def _to_user_dict(user: Optional[User]) -> Optional[dict]:
    if not user:
        return None
    return {
        "id": user.id,
        "display_name": user.display_name,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }
