# -*- coding: utf-8 -*-
"""认证模块响应模型"""

from typing import Optional
from pydantic import BaseModel


class UserPublic(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    user: Optional[UserPublic] = None
