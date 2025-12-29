# -*- coding: utf-8 -*-
"""
AIMultiBox 配置管理

配置加载优先级：
1. 环境变量（最高优先级）
2. .env 文件
3. 此文件中的默认值（最低优先级）
"""

from enum import Enum
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from functools import lru_cache


BASE_DIR = Path(__file__).parent.parent.parent


class ModelMode(str, Enum):
    """AI 模型运行模式"""
    LOCAL = "local"   # 本地 LaMa 模型（默认）
    CLOUD = "cloud"   # 云端 SDXL Inpainting API


class Settings(BaseSettings):
    """运行时配置"""

    # 服务器配置
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8000

    # API 配置
    api_prefix: str = "/api"
    cors_origins_str: str = "http://localhost:5173,http://localhost:3000"

    # AI 模式：local（默认）或 cloud
    ai_mode: str = ModelMode.LOCAL.value

    # Replicate API 配置（仅 cloud 模式）
    replicate_api_token: str = ""

    # 安全配置
    max_upload_size: int = 10 * 1024 * 1024  # 10MB

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_str.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
