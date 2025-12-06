# -*- coding: utf-8 -*-
"""全局路由"""

from fastapi import APIRouter
from aimultibox import APP_META
from aimultibox.core.config import settings
from aimultibox.core.loader import ToolLoader

router = APIRouter()


@router.get("/app")
async def get_app_info():
    """获取应用信息"""
    return {
        **APP_META,
        "ai_mode": settings.ai_mode,
        "debug": settings.debug,
    }


@router.get("/tools")
async def list_tools():
    """获取工具列表"""
    return {"tools": ToolLoader.get_registered_tools()}
