# -*- coding: utf-8 -*-
"""水印去除 - 业务层"""

import io
import logging
from typing import Optional, List, Dict, Any
import numpy as np
from PIL import Image

from .model import WatermarkModel

logger = logging.getLogger(__name__)


class WatermarkRemovalService:
    """水印去除服务"""
    
    def __init__(self):
        self.model = WatermarkModel()
    
    async def remove_watermark(
        self,
        image_bytes: bytes,
        mask_bytes: Optional[bytes] = None,
    ) -> Optional[bytes]:
        """
        去除水印
        
        Args:
            image_bytes: 原始图片字节
            mask_bytes: 遮罩图片字节（可选，为空则自动检测）
        
        Returns:
            处理后的图片字节，失败返回 None
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != "RGB":
                image = image.convert("RGB")
            
            if mask_bytes:
                mask = Image.open(io.BytesIO(mask_bytes))
                if mask.mode != "L":
                    mask = mask.convert("L")
                if mask.size != image.size:
                    mask = mask.resize(image.size, Image.Resampling.NEAREST)
            else:
                mask = await self._auto_generate_mask(image)
            
            mask_array = np.array(mask)
            if np.sum(mask_array > 127) < 100:
                pass  # 遮罩区域过小，但仍尝试处理
            
            result = await self.model.inpaint(image, mask)
            
            if result is None:
                return None
            
            output = io.BytesIO()
            result.save(output, format="PNG", quality=95)
            return output.getvalue()
            
        except Exception:
            return None
    
    async def _auto_generate_mask(self, image: Image.Image) -> Image.Image:
        """自动生成遮罩"""
        width, height = image.size
        mask = Image.new("L", (width, height), 0)
        
        regions = await self.model.detect_watermark_regions(image)
        
        logger.debug(f"检测到 {len(regions)} 个文字区域")
        for r in regions:
            logger.debug(f"  - '{r.get('text', '')}' conf={r.get('confidence', 0):.2f} pos=({r['x']},{r['y']}) size={r['width']}x{r['height']}")
        
        if not regions:
            logger.debug("未检测到文字，返回空遮罩")
            return mask
        
        from PIL import ImageDraw, ImageFilter
        draw = ImageDraw.Draw(mask)
        
        for region in regions:
            x, y, w, h = region["x"], region["y"], region["width"], region["height"]
            
            padding = 10
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(width - x, w + padding * 2)
            h = min(height - y, h + padding * 2)
            
            draw.rectangle([x, y, x + w, y + h], fill=255)
        
        mask = mask.filter(ImageFilter.GaussianBlur(radius=2))
        
        return mask
    
    async def detect_watermark(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """检测水印区域"""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != "RGB":
                image = image.convert("RGB")
            
            return await self.model.detect_watermark_regions(image)
            
        except Exception:
            return []
    
    def get_model_status(self) -> Dict[str, Any]:
        """获取模型状态"""
        return {
            "mode": self.model.mode,
            "lama_loaded": self.model.lama.loaded,
            "cloud_available": self.model.sdxl is not None,
        }
