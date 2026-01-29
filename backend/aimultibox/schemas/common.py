# -*- coding: utf-8 -*-
"""通用数据模型"""

from typing import Any, Optional, List, Dict
from pydantic import BaseModel, ConfigDict


class ErrorDetail(BaseModel):
    """错误详情"""
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    """错误响应模型"""
    error: ErrorDetail


class OkResponse(BaseModel):
    """通用 OK 响应"""
    ok: bool = True


class AppInfoResponse(BaseModel):
    """应用信息响应"""
    model_config = ConfigDict(extra="allow")
    ai_mode: str
    debug: bool


class ToolListResponse(BaseModel):
    """工具列表响应"""
    tools: List[Dict[str, Any]]


class AppConfigResponse(BaseModel):
    """前端配置响应"""
    apiPrefix: str
    version: str
    googleClientId: str
