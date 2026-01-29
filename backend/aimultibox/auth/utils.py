# -*- coding: utf-8 -*-
"""认证工具函数"""

from typing import Optional
from fastapi import Request


def get_client_id(request: Request) -> Optional[str]:
    """获取客户端 ID"""
    return getattr(request.state, "client_id", None)


def get_user_id(request: Request) -> Optional[int]:
    """获取当前登录用户 ID"""
    return getattr(request.state, "user_id", None)
