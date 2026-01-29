# -*- coding: utf-8 -*-
"""去水印工具 - 数据模型"""

from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict


class RemovalResult(BaseModel):
    """去水印结果"""
    image_base64: Optional[str] = None


class WatermarkRegion(BaseModel):
    """水印区域"""
    x: int
    y: int
    width: int
    height: int
    confidence: float
    text: Optional[str] = None


class DetectionResult(BaseModel):
    """水印检测结果"""
    regions: List[WatermarkRegion] = []
    count: int = 0
    note: Optional[str] = None


class ToolFeature(BaseModel):
    id: str
    name: str
    description: str


class ToolInfoResponse(BaseModel):
    """工具信息响应"""
    model_config = ConfigDict(extra="allow")
    model_status: Dict[str, Any] = {}
    features: List[ToolFeature] = []


class ModelStatusResponse(BaseModel):
    """模型状态响应"""
    mode: str
    lama_loaded: bool
    cloud_available: bool
