# -*- coding: utf-8 -*-
"""去水印工具 - 数据模型"""

from typing import Optional, List
from pydantic import BaseModel

from aimultibox.models import BaseResponse


class RemovalResponse(BaseResponse):
    """水印去除响应"""
    image_base64: Optional[str] = None


class WatermarkRegion(BaseModel):
    """水印区域"""
    x: int
    y: int
    width: int
    height: int
    confidence: float


class DetectionResponse(BaseResponse):
    """水印检测响应"""
    regions: List[WatermarkRegion] = []
    count: int = 0
    note: Optional[str] = None
