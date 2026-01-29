# -*- coding: utf-8 -*-
"""全局路由"""

from typing import Any
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from aimultibox import APP_META
from aimultibox.core.config import settings
from aimultibox.core.loader import ToolLoader
from aimultibox.core.sse import sse_manager
from aimultibox.auth.api import router as auth_router
from aimultibox.auth.utils import get_client_id, get_user_id
from aimultibox.schemas import AppInfoResponse, ToolListResponse

router = APIRouter()
router.include_router(auth_router, prefix="/auth")


@router.get("/app", response_model=AppInfoResponse)
async def get_app_info() -> dict[str, Any]:
    """获取应用信息"""
    return {
        **APP_META,
        "ai_mode": settings.ai_mode,
        "debug": settings.debug,
    }


@router.get("/tools", response_model=ToolListResponse)
async def list_tools() -> dict[str, list[dict[str, Any]]]:
    """获取工具列表"""
    return {
        "tools": ToolLoader.get_registered_tools(),
    }


@router.get("/events/stream")
async def sse_stream(
    request: Request,
) -> StreamingResponse:
    """SSE 事件流"""
    actual_client_id = get_client_id(request)
    user_id = get_user_id(request)
    conn = await sse_manager.connect(actual_client_id, user_id)

    return StreamingResponse(
        sse_manager.event_generator(conn),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
