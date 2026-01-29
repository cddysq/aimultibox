# -*- coding: utf-8 -*-
"""水印去除 - API 路由"""

import base64
from typing import Any
from fastapi import APIRouter, File, UploadFile, HTTPException, Request, Response

from aimultibox.core.ratelimit import limiter, DEFAULT_LIMIT
from starlette import status as HTTP
from . import TOOL_META, RATE_LIMITS
from .service import WatermarkRemovalService
from .schemas import RemovalResult, DetectionResult, ToolInfoResponse, ModelStatusResponse

router = APIRouter()
service = WatermarkRemovalService()


@router.get("/", response_model=ToolInfoResponse)
async def tool_info() -> dict[str, Any]:
    """获取工具信息"""
    status = service.get_model_status()
    return {
        **TOOL_META,
        "model_status": status,
        "features": [
            {
                "id": "manual_mask",
                "name": "手动标注",
                "description": "画笔涂抹水印区域",
            },
            {
                "id": "auto_detect",
                "name": "自动检测",
                "description": "自动识别水印位置",
            },
        ],
    }


@router.post("/remove", response_model=RemovalResult)
@limiter.limit(RATE_LIMITS.get("remove", DEFAULT_LIMIT))
async def remove_watermark(
    request: Request,
    response: Response,
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
) -> dict[str, Any]:
    """去除水印（需要遮罩）"""
    try:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(status_code=HTTP.HTTP_400_BAD_REQUEST, detail="无效的图片文件")

        if not mask.content_type or not mask.content_type.startswith("image/"):
            raise HTTPException(status_code=HTTP.HTTP_400_BAD_REQUEST, detail="无效的遮罩文件")

        image_bytes = await image.read()
        mask_bytes = await mask.read()

        result = await service.remove_watermark(
            image_bytes=image_bytes,
            mask_bytes=mask_bytes,
        )

        if result is None:
            raise HTTPException(status_code=HTTP.HTTP_500_INTERNAL_SERVER_ERROR, detail="处理失败")

        result_base64 = base64.b64encode(result).decode("utf-8")

        return {"image_base64": result_base64}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=HTTP.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/remove-auto", response_model=RemovalResult)
@limiter.limit(RATE_LIMITS.get("remove-auto", DEFAULT_LIMIT))
async def remove_watermark_auto(
    request: Request,
    response: Response,
    image: UploadFile = File(...),
) -> dict[str, Any]:
    """自动检测并去除水印"""
    try:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(status_code=HTTP.HTTP_400_BAD_REQUEST, detail="无效的图片文件")

        image_bytes = await image.read()

        result = await service.remove_watermark(
            image_bytes=image_bytes,
            mask_bytes=None,
        )

        if result is None:
            raise HTTPException(status_code=HTTP.HTTP_500_INTERNAL_SERVER_ERROR, detail="处理失败")

        result_base64 = base64.b64encode(result).decode("utf-8")

        return {"image_base64": result_base64}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=HTTP.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/detect", response_model=DetectionResult)
@limiter.limit(RATE_LIMITS.get("detect", DEFAULT_LIMIT))
async def detect_watermark(
    request: Request,
    response: Response,
    image: UploadFile = File(...),
) -> dict[str, Any]:
    """检测水印区域"""
    try:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(status_code=HTTP.HTTP_400_BAD_REQUEST, detail="无效的图片文件")

        image_bytes = await image.read()
        regions = await service.detect_watermark(image_bytes)

        return {
            "regions": regions,
            "count": len(regions),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=HTTP.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/status", response_model=ModelStatusResponse)
async def get_status() -> dict[str, Any]:
    """获取模型状态"""
    return service.get_model_status()
