# -*- coding: utf-8 -*-
"""去水印工具"""

TOOL_META = {
    "id": "watermark-removal",
    "name": "AI 去水印",
    "description": "使用 LaMa/SDXL 模型去除图片水印",
    "icon": "eraser",
    "version": "0.0.1",
}

# 限流配置（不配置则使用全局默认）
RATE_LIMITS = {
    "remove": "1/10seconds",       # 手动去水印（10秒1次）
    "remove-auto": "1/12seconds",  # 自动去水印（12秒1次，消耗更大）
    "detect": "1/3seconds",        # 检测接口
}
