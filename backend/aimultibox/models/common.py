# -*- coding: utf-8 -*-
"""通用数据模型"""

from typing import Any, Optional
from pydantic import BaseModel


class BaseResponse(BaseModel):
    """基础响应模型"""
    status: str = "success"
    message: Optional[str] = None
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """错误响应模型"""
    status: str = "error"
    message: str
    code: Optional[str] = None
    details: Optional[Any] = None
