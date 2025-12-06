# -*- coding: utf-8 -*-
"""水印去除 - 模型层"""

import io
import base64
import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
from PIL import Image
import cv2

from aimultibox.core.config import settings, BASE_DIR, ModelMode

logger = logging.getLogger(__name__)


class WatermarkDetector:
    """
    水印检测器
    
    使用 EasyOCR 检测图片中的文字区域
    """
    
    def __init__(self):
        self._reader = None
    
    def _get_reader(self):
        """延迟加载 EasyOCR"""
        if self._reader is not None:
            return self._reader
        
        import easyocr
        import torch
        
        gpu_available = torch.cuda.is_available()
        logger.debug(f"正在加载 EasyOCR (GPU: {gpu_available})...")
        self._reader = easyocr.Reader(['ch_sim', 'en'], gpu=gpu_available, verbose=False)
        logger.debug("EasyOCR 加载完成")
        return self._reader
    
    def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """检测水印区域"""
        reader = self._get_reader()
        results = reader.readtext(image, detail=1, paragraph=False)
        
        regions = []
        height, width = image.shape[:2]
        
        for bbox, text, conf in results:
            pts = np.array(bbox, dtype=np.int32)
            x = int(pts[:, 0].min())
            y = int(pts[:, 1].min())
            x2 = int(pts[:, 0].max())
            y2 = int(pts[:, 1].max())
            w = x2 - x
            h = y2 - y
            
            # 过滤太小的区域
            if w < 20 or h < 10:
                continue
            
            # 过滤占比过大的（可能是正文）
            if (w * h) / (width * height) > 0.15:
                continue
            
            regions.append({
                'x': x, 'y': y, 'width': w, 'height': h,
                'confidence': float(conf),
                'text': text,
            })
        
        regions.sort(key=lambda r: r['confidence'], reverse=True)
        return regions[:5]


class LaMaInpainter:
    """
    LaMa 本地推理 (ONNX)
    
    特性：
    - 智能局部处理，不缩放整图
    - 边界羽化融合，无明显接缝
    - 大区域分块处理
    """
    
    def __init__(self):
        self.session = None
        self.loaded = False
        self.input_size = 512
        self.padding = 32
        self.feather_size = 16  # 羽化边界大小
    
    def load(self, model_path: Path) -> bool:
        """加载模型"""
        try:
            import onnxruntime as ort
            
            providers = []
            available = ort.get_available_providers()
            
            if 'CUDAExecutionProvider' in available:
                providers.append('CUDAExecutionProvider')
                print("  ✓ CUDA 可用")
            if 'CoreMLExecutionProvider' in available:
                providers.append('CoreMLExecutionProvider')
                print("  ✓ CoreML 可用")
            providers.append('CPUExecutionProvider')
            
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            self.session = ort.InferenceSession(
                str(model_path),
                sess_options=sess_options,
                providers=providers
            )
            
            self.loaded = True
            print(f"  ✓ LaMa 已加载: {model_path.name}")
            return True
            
        except ImportError:
            print("  ✗ 未安装 onnxruntime")
            return False
        except Exception as e:
            print(f"  ✗ 加载失败: {e}")
            return False
    
    def _get_mask_bbox(self, mask: np.ndarray) -> Tuple[int, int, int, int]:
        """获取 mask 的 bounding box"""
        rows = np.any(mask > 127, axis=1)
        cols = np.any(mask > 127, axis=0)
        
        if not rows.any() or not cols.any():
            return 0, 0, mask.shape[1], mask.shape[0]
        
        y_min, y_max = np.where(rows)[0][[0, -1]]
        x_min, x_max = np.where(cols)[0][[0, -1]]
        
        return int(x_min), int(y_min), int(x_max - x_min + 1), int(y_max - y_min + 1)
    
    def _expand_bbox(self, x: int, y: int, w: int, h: int, 
                     img_w: int, img_h: int) -> Tuple[int, int, int, int]:
        """扩展 bbox 到至少 512x512"""
        # 添加 padding
        x = max(0, x - self.padding)
        y = max(0, y - self.padding)
        w = min(img_w - x, w + 2 * self.padding)
        h = min(img_h - y, h + 2 * self.padding)
        
        # 扩展到至少 512x512
        if w < self.input_size:
            expand = self.input_size - w
            left = expand // 2
            x = max(0, x - left)
            w = min(img_w - x, self.input_size)
        
        if h < self.input_size:
            expand = self.input_size - h
            top = expand // 2
            y = max(0, y - top)
            h = min(img_h - y, self.input_size)
        
        return x, y, w, h
    
    def _create_feather_mask(self, mask: np.ndarray, feather_size: int) -> np.ndarray:
        """
        创建羽化遮罩
        用于边界平滑融合
        """
        # 二值化 mask
        mask_binary = (mask > 127).astype(np.uint8) * 255
        
        # 高斯模糊实现羽化边缘
        ksize = feather_size * 2 + 1
        feathered = cv2.GaussianBlur(mask_binary.astype(np.float32), (ksize, ksize), 0)
        
        # 归一化到 0-1
        feathered = feathered / 255.0
        
        # 确保 mask 中心区域完全是 1
        feathered = np.where(mask_binary > 127, 1.0, feathered)
        
        return feathered
    
    def _prepare_input(self, img_crop: np.ndarray, mask_crop: np.ndarray) -> Tuple[np.ndarray, np.ndarray, Tuple[int, int]]:
        """准备模型输入"""
        h, w = img_crop.shape[:2]
        
        if h == self.input_size and w == self.input_size:
            img_norm = img_crop.astype(np.float32) / 255.0
            mask_norm = (mask_crop > 127).astype(np.float32)
            
            img_tensor = np.transpose(img_norm, (2, 0, 1))[np.newaxis, ...]
            mask_tensor = mask_norm[np.newaxis, np.newaxis, ...]
            
            return img_tensor, mask_tensor, (h, w)
        
        # 填充到 512x512
        pad_h = self.input_size - h
        pad_w = self.input_size - w
        
        img_padded = np.pad(img_crop, ((0, pad_h), (0, pad_w), (0, 0)), mode='reflect')
        mask_padded = np.pad(mask_crop, ((0, pad_h), (0, pad_w)), mode='constant', constant_values=0)
        
        img_norm = img_padded.astype(np.float32) / 255.0
        mask_norm = (mask_padded > 127).astype(np.float32)
        
        img_tensor = np.transpose(img_norm, (2, 0, 1))[np.newaxis, ...]
        mask_tensor = mask_norm[np.newaxis, np.newaxis, ...]
        
        return img_tensor, mask_tensor, (h, w)
    
    def _run_inference(self, img_tensor: np.ndarray, mask_tensor: np.ndarray) -> np.ndarray:
        """执行模型推理"""
        inputs = self.session.get_inputs()
        outputs_meta = self.session.get_outputs()
        
        # 根据输入名称匹配正确的 tensor
        feed_dict = {}
        for inp in inputs:
            name_lower = inp.name.lower()
            if 'mask' in name_lower:
                feed_dict[inp.name] = mask_tensor
            else:
                feed_dict[inp.name] = img_tensor
        
        output_names = [out.name for out in outputs_meta]
        outputs = self.session.run(output_names, feed_dict)
        
        return outputs[0]
    
    def _process_output(self, output: np.ndarray, crop_size: Tuple[int, int]) -> np.ndarray:
        """处理模型输出"""
        result = output[0]
        result = np.transpose(result, (1, 2, 0))
        
        h, w = crop_size
        result = result[:h, :w, :]
        result = np.clip(result, 0, 255).astype(np.uint8)
        
        return result
    
    def _blend_result(self, original: np.ndarray, inpainted: np.ndarray, 
                      mask: np.ndarray, x: int, y: int) -> np.ndarray:
        """
        使用羽化遮罩混合结果
        实现无缝融合
        """
        h, w = inpainted.shape[:2]
        
        # 创建羽化遮罩
        feather_mask = self._create_feather_mask(mask, self.feather_size)
        
        # 扩展到 3 通道
        feather_mask_3d = feather_mask[:, :, np.newaxis]
        
        # 混合
        original_crop = original[y:y+h, x:x+w].astype(np.float32)
        inpainted_f = inpainted.astype(np.float32)
        
        blended = original_crop * (1 - feather_mask_3d) + inpainted_f * feather_mask_3d
        
        result = original.copy()
        result[y:y+h, x:x+w] = blended.astype(np.uint8)
        
        return result
    
    async def inpaint(self, image: Image.Image, mask: Image.Image) -> Optional[Image.Image]:
        """执行图像修复"""
        if not self.loaded or self.session is None:
            return None
        
        try:
            if image.mode != 'RGB':
                image = image.convert('RGB')
            if mask.mode != 'L':
                mask = mask.convert('L')
            
            img_array = np.array(image)
            mask_array = np.array(mask)
            img_h, img_w = img_array.shape[:2]
            
            # 检查 mask 是否有效
            if np.sum(mask_array > 127) < 10:
                return image
            
            # 获取水印区域
            bbox_x, bbox_y, bbox_w, bbox_h = self._get_mask_bbox(mask_array)
            
            # 扩展到合适大小
            crop_x, crop_y, crop_w, crop_h = self._expand_bbox(
                bbox_x, bbox_y, bbox_w, bbox_h, img_w, img_h
            )
            
            # 如果裁剪区域 > 512，分块处理
            if crop_w > self.input_size or crop_h > self.input_size:
                return await self._inpaint_tiled(img_array, mask_array, 
                                                  crop_x, crop_y, crop_w, crop_h)
            
            # 裁剪局部区域
            img_crop = img_array[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
            mask_crop = mask_array[crop_y:crop_y+crop_h, crop_x:crop_x+crop_w]
            
            # 准备输入
            img_tensor, mask_tensor, crop_size = self._prepare_input(img_crop, mask_crop)
            
            # 异步推理
            loop = asyncio.get_event_loop()
            output = await loop.run_in_executor(
                None, lambda: self._run_inference(img_tensor, mask_tensor)
            )
            
            # 处理输出
            result_crop = self._process_output(output, crop_size)
            
            # 羽化混合
            result_array = self._blend_result(img_array, result_crop, mask_crop, crop_x, crop_y)
            
            return Image.fromarray(result_array)
            
        except Exception:
            return None
    
    async def _inpaint_tiled(self, img_array: np.ndarray, mask_array: np.ndarray,
                             crop_x: int, crop_y: int, 
                             crop_w: int, crop_h: int) -> Optional[Image.Image]:
        """
        分块处理大区域
        带羽化边界融合
        """
        result_array = img_array.copy()
        tile_size = self.input_size
        overlap = 64
        
        img_h, img_w = img_array.shape[:2]
        
        y = crop_y
        while y < crop_y + crop_h:
            x = crop_x
            while x < crop_x + crop_w:
                tile_x = max(0, x)
                tile_y = max(0, y)
                tile_w = min(tile_size, img_w - tile_x)
                tile_h = min(tile_size, img_h - tile_y)
                
                # 检查是否有水印区域
                mask_tile = mask_array[tile_y:tile_y+tile_h, tile_x:tile_x+tile_w]
                if np.sum(mask_tile > 127) < 10:
                    x += tile_size - overlap
                    continue
                
                img_tile = img_array[tile_y:tile_y+tile_h, tile_x:tile_x+tile_w]
                
                # 准备输入
                img_tensor, mask_tensor, tile_actual_size = self._prepare_input(img_tile, mask_tile)
                
                # 推理
                output = self._run_inference(img_tensor, mask_tensor)
                
                # 处理输出
                result_tile = self._process_output(output, tile_actual_size)
                
                # 羽化混合贴回
                result_array = self._blend_result(result_array, result_tile, mask_tile, tile_x, tile_y)
                
                x += tile_size - overlap
            y += tile_size - overlap
        
        return Image.fromarray(result_array)


class SDXLInpainter:
    """SDXL 云端推理 (Replicate API)"""
    
    MODEL_VERSION = "stability-ai/stable-diffusion-inpainting:95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3"
    
    def __init__(self, api_token: str):
        self.api_token = api_token
    
    async def inpaint(
        self, 
        image: Image.Image, 
        mask: Image.Image,
        prompt: str = "clean background, seamless, high quality, detailed"
    ) -> Optional[Image.Image]:
        """执行云端图像修复"""
        try:
            import httpx
            
            def image_to_data_uri(img: Image.Image, fmt: str = "PNG") -> str:
                buffer = io.BytesIO()
                img.save(buffer, format=fmt)
                b64 = base64.b64encode(buffer.getvalue()).decode()
                return f"data:image/{fmt.lower()};base64,{b64}"
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            if mask.mode != 'L':
                mask = mask.convert('L')
            
            max_size = 1024
            original_size = image.size
            
            if image.width > max_size or image.height > max_size:
                ratio = max_size / max(image.width, image.height)
                new_size = (int(image.width * ratio), int(image.height * ratio))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                mask = mask.resize(new_size, Image.Resampling.NEAREST)
            
            image_uri = image_to_data_uri(image)
            mask_uri = image_to_data_uri(mask)
            
            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(
                    "https://api.replicate.com/v1/predictions",
                    headers={
                        "Authorization": f"Bearer {self.api_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "version": self.MODEL_VERSION.split(":")[-1],
                        "input": {
                            "image": image_uri,
                            "mask": mask_uri,
                            "prompt": prompt,
                            "negative_prompt": "watermark, text, logo, blurry, low quality",
                            "num_inference_steps": 30,
                            "guidance_scale": 7.5,
                        }
                    }
                )
                
                if response.status_code != 201:
                    print(f"API 错误: {response.status_code}")
                    return None
                
                prediction = response.json()
                prediction_id = prediction["id"]
                
                for i in range(90):
                    await asyncio.sleep(1)
                    
                    status_response = await client.get(
                        f"https://api.replicate.com/v1/predictions/{prediction_id}",
                        headers={"Authorization": f"Bearer {self.api_token}"}
                    )
                    
                    status = status_response.json()
                    
                    if status["status"] == "succeeded":
                        output = status.get("output")
                        if output:
                            output_url = output[0] if isinstance(output, list) else output
                            img_response = await client.get(output_url)
                            result = Image.open(io.BytesIO(img_response.content))
                            
                            if result.size != original_size:
                                result = result.resize(original_size, Image.Resampling.LANCZOS)
                            
                            return result
                        break
                        
                    elif status["status"] == "failed":
                        print(f"处理失败: {status.get('error')}")
                        break
                
                return None
                
        except ImportError:
            print("未安装 httpx")
            return None
        except Exception as e:
            print(f"SDXL 错误: {e}")
            return None


class WatermarkModel:
    """
    统一模型接口
    
    模式:
        local - LaMa ONNX 本地推理
        cloud - SDXL Replicate 云端推理
    
    模型来源: https://huggingface.co/Carve/LaMa-ONNX
    """
    
    MODEL_URL = "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx"
    
    def __init__(self):
        self.lama = LaMaInpainter()
        self.sdxl = None
        self.detector = WatermarkDetector()
        self.mode = settings.ai_mode
        self._init()
    
    def _init(self):
        """初始化模型"""
        print(f"📦 模型初始化 (模式: {self.mode})")
        
        if self.mode == ModelMode.LOCAL.value:
            model_path = BASE_DIR / "models" / "lama_fp32.onnx"
            
            if model_path.exists():
                self.lama.load(model_path)
            else:
                print(f"  ⚠️ 模型文件未找到")
                print(f"  路径: backend/models/lama_fp32.onnx")
                print(f"  下载: {self.MODEL_URL}")
        
        elif self.mode == ModelMode.CLOUD.value:
            if settings.replicate_api_token:
                self.sdxl = SDXLInpainter(settings.replicate_api_token)
                print("  ✓ SDXL 已就绪")
            else:
                print("  ⚠️ 未设置 REPLICATE_API_TOKEN")
    
    async def inpaint(self, image: Image.Image, mask: Image.Image) -> Optional[Image.Image]:
        """执行图像修复"""
        if self.mode == ModelMode.CLOUD.value and self.sdxl:
            result = await self.sdxl.inpaint(image, mask)
            if result:
                return result
        
        if self.lama.loaded:
            return await self.lama.inpaint(image, mask)
        
        return await self._opencv_fallback(image, mask)
    
    async def _opencv_fallback(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        """OpenCV 回退方案"""
        img_array = np.array(image.convert('RGB'))
        mask_array = np.array(mask.convert('L'))
        mask_binary = (mask_array > 127).astype(np.uint8) * 255
        
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        result_bgr = cv2.inpaint(img_bgr, mask_binary, 3, cv2.INPAINT_TELEA)
        result_rgb = cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)
        
        return Image.fromarray(result_rgb)
    
    async def detect_watermark_regions(self, image: Image.Image) -> List[Dict[str, Any]]:
        """检测水印区域（EasyOCR 文字检测）"""
        img_array = np.array(image.convert('RGB'))
        return self.detector.detect(img_array)
