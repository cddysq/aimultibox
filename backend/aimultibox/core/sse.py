# -*- coding: utf-8 -*-
"""SSE 事件管理器"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Optional

logger = logging.getLogger(__name__)


@dataclass
class SSEConnection:
    """SSE 连接"""
    client_id: str
    user_id: Optional[str] = None
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class SSEManager:
    """SSE 连接管理器"""

    def __init__(self) -> None:
        self._connections: dict[str, SSEConnection] = {}
        self._lock = asyncio.Lock()

    async def connect(self, client_id: str, user_id: Optional[str] = None) -> SSEConnection:
        """注册新连接"""
        async with self._lock:
            # 如果已存在同 client_id 的连接，先关闭旧连接
            if client_id in self._connections:
                old_conn = self._connections[client_id]
                await old_conn.queue.put(None)  # 发送关闭信号

            conn = SSEConnection(client_id=client_id, user_id=user_id)
            self._connections[client_id] = conn
            logger.debug(f"SSE 连接建立: {client_id}")
            return conn

    async def disconnect(self, client_id: str) -> None:
        """断开连接"""
        async with self._lock:
            if client_id in self._connections:
                del self._connections[client_id]
                logger.debug(f"SSE 连接断开: {client_id}")

    async def broadcast(self, event_type: str, data: Any) -> int:
        """广播事件给所有连接"""
        message = self._format_event(event_type, data)
        count = 0

        async with self._lock:
            for conn in self._connections.values():
                try:
                    await conn.queue.put(message)
                    count += 1
                except Exception as e:
                    logger.warning(f"SSE 广播失败 [{conn.client_id}]: {e}")

        if count > 0:
            logger.debug(f"SSE 广播: {event_type} -> {count} 个连接")
        return count

    async def send_to_client(self, client_id: str, event_type: str, data: Any) -> bool:
        """发送事件给指定客户端"""
        async with self._lock:
            conn = self._connections.get(client_id)
            if not conn:
                return False

            try:
                message = self._format_event(event_type, data)
                await conn.queue.put(message)
                logger.debug(f"SSE 定向推送: {event_type} -> {client_id}")
                return True
            except Exception as e:
                logger.warning(f"SSE 发送失败 [{client_id}]: {e}")
                return False

    async def send_to_user(self, user_id: str, event_type: str, data: Any) -> int:
        """发送事件给指定用户的所有连接"""
        message = self._format_event(event_type, data)
        count = 0

        async with self._lock:
            for conn in self._connections.values():
                if conn.user_id == user_id:
                    try:
                        await conn.queue.put(message)
                        count += 1
                    except Exception as e:
                        logger.warning(f"SSE 发送失败 [{conn.client_id}]: {e}")

        if count > 0:
            logger.debug(f"SSE 用户推送: {event_type} -> user:{user_id} ({count} 个连接)")
        return count

    async def event_generator(self, conn: SSEConnection) -> AsyncGenerator[str, None]:
        """生成 SSE 事件流"""
        try:
            # 发送初始连接成功事件
            yield self._format_event("connected", {"client_id": conn.client_id})

            while True:
                message = await conn.queue.get()
                if message is None:  # 关闭信号
                    break
                yield message
        finally:
            await self.disconnect(conn.client_id)

    def _format_event(self, event_type: str, data: Any) -> str:
        """格式化 SSE 事件"""
        json_data = json.dumps(data, ensure_ascii=False, default=str)
        return f"event: {event_type}\ndata: {json_data}\n\n"

    @property
    def connection_count(self) -> int:
        """当前连接数"""
        return len(self._connections)


# 全局 SSE 管理器实例
sse_manager = SSEManager()
