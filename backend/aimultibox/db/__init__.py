# -*- coding: utf-8 -*-
"""ORM 基础设施（公共）"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Generator, Optional, Tuple

from datetime import datetime, timezone

from sqlalchemy import create_engine, event, String, DateTime
from sqlalchemy import false
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, Mapped, mapped_column
from sqlalchemy.sql import Select, Delete, Update
from sqlalchemy.types import TypeDecorator

from aimultibox.core.config import settings


class UTCDateTime(TypeDecorator):
    """
    UTC 时间类型 - 全球化时间处理的核心

    存储：aware datetime → naive UTC
    读取：naive UTC → aware UTC datetime

    确保数据库中所有时间统一为 UTC，简化跨时区处理
    """
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value  # naive datetime 视为 UTC

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


class Base(DeclarativeBase):
    """ORM 基类"""


class UserScopedMixin:
    """需要用户范围隔离的数据表"""

    __abstract__ = True
    user_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    client_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)


# 请求上下文
current_user_id: ContextVar[Optional[str]] = ContextVar("current_user_id", default=None)
current_client_id: ContextVar[Optional[str]] = ContextVar("current_client_id", default=None)
scope_disabled: ContextVar[bool] = ContextVar("scope_disabled", default=False)


def set_scope(user_id: Optional[str], client_id: Optional[str]) -> Tuple:
    token_user = current_user_id.set(user_id)
    token_client = current_client_id.set(client_id)
    token_disabled = scope_disabled.set(False)
    return token_user, token_client, token_disabled


def reset_scope(tokens: Tuple) -> None:
    token_user, token_client, token_disabled = tokens
    current_user_id.reset(token_user)
    current_client_id.reset(token_client)
    scope_disabled.reset(token_disabled)


@contextmanager
def disable_scope() -> Generator[None, None, None]:
    token = scope_disabled.set(True)
    try:
        yield
    finally:
        scope_disabled.reset(token)


def _build_scope_condition(table) -> Optional[object]:
    if scope_disabled.get():
        return None
    uid = current_user_id.get()
    cid = current_client_id.get()
    if uid and "user_id" in table.c:
        return table.c.user_id == uid
    if cid and "client_id" in table.c:
        return table.c.client_id == cid
    if "user_id" in table.c or "client_id" in table.c:
        return false()
    return None


def _get_scope_entities_from_statement(statement) -> list:
    """从 SELECT 语句中提取所有 UserScopedMixin 实体"""
    entities = []
    for col_desc in statement.column_descriptions:
        entity = col_desc.get("entity")
        if entity and isinstance(entity, type) and issubclass(entity, UserScopedMixin):
            entities.append(entity)
    return entities


def _ensure_scope_for_statement(execute_state) -> None:
    if scope_disabled.get():
        return
    uid = current_user_id.get()
    cid = current_client_id.get()

    if isinstance(execute_state.statement, Select):
        # 直接在 SELECT 语句上添加 WHERE 条件，避免 with_loader_criteria 的 lambda 缓存问题
        entities = _get_scope_entities_from_statement(execute_state.statement)
        for entity in entities:
            if uid:
                execute_state.statement = execute_state.statement.where(entity.user_id == uid)
            elif cid:
                execute_state.statement = execute_state.statement.where(entity.client_id == cid)
            else:
                # 无用户也无客户端，返回空结果
                execute_state.statement = execute_state.statement.where(false())
        return

    if isinstance(execute_state.statement, (Update, Delete)):
        condition = _build_scope_condition(execute_state.statement.table)
        if condition is not None:
            execute_state.statement = execute_state.statement.where(condition)


def _auto_fill_scope(session: Session) -> None:
    if scope_disabled.get():
        return
    uid = current_user_id.get()
    cid = current_client_id.get()
    for obj in session.new:
        if isinstance(obj, UserScopedMixin):
            if uid and getattr(obj, "user_id", None) is None:
                obj.user_id = uid
            if cid and getattr(obj, "client_id", None) is None:
                obj.client_id = cid


engine = create_engine(
    settings.database_url,
    future=True,
    echo=False,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass


SessionLocal = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)


@event.listens_for(Session, "do_orm_execute")
def _scope_orm_execute(execute_state) -> None:
    _ensure_scope_for_statement(execute_state)


@event.listens_for(Session, "before_flush")
def _scope_before_flush(session: Session, flush_context, instances) -> None:
    _auto_fill_scope(session)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def create_all() -> None:
    """创建所有表（仅用于初始化或迁移脚本）"""
    Base.metadata.create_all(engine)


__all__ = [
    "Base",
    "UTCDateTime",
    "UserScopedMixin",
    "engine",
    "SessionLocal",
    "session_scope",
    "set_scope",
    "reset_scope",
    "disable_scope",
    "current_user_id",
    "current_client_id",
]
