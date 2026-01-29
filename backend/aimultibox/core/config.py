# -*- coding: utf-8 -*-
"""
AIMultiBox 配置管理

配置加载优先级：
1. 环境变量（最高优先级）
2. .env 文件
3. 此文件中的默认值（最低优先级）

配置分类：
- 环境配置：不同环境需要不同的值
- 可选功能：空值表示禁用该功能
- 固定配置：有合理默认值，通常不需要修改
"""

import logging
from enum import Enum
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).parent.parent.parent


class AppEnv(str, Enum):
    """运行环境"""
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TESTING = "testing"


class AIMode(str, Enum):
    """模型运行模式"""
    LOCAL = "local"  # 本地 LaMa
    CLOUD = "cloud"  # 云端 SDXL Inpainting


class Settings(BaseSettings):
    """
    运行时配置

    所有配置项均可通过环境变量或 .env 文件设置
    环境变量名为大写形式，如 app_env -> APP_ENV
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ==================== 环境配置 ====================
    # 生产环境应设置 app_env=production, debug=false
    app_env: str = AppEnv.DEVELOPMENT.value
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8000

    # ==================== 可选功能 ====================
    # 空值表示禁用对应功能

    # Google OAuth（空则禁用 Google 登录）
    google_client_id: str = ""

    # Replicate API（空则禁用云端模式）
    replicate_api_token: str = ""

    # ==================== 固定配置 ====================
    # 有合理默认值，通常不需要修改

    # API
    api_prefix: str = "/api"
    cors_origins_str: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI 模式
    ai_mode: str = AIMode.LOCAL.value

    # 数据库
    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'aimultibox.db').as_posix()}"

    # 安全
    max_upload_size: int = 10 * 1024 * 1024  # 10MB

    # 认证
    auth_session_days: int = 30
    auth_cookie_name: str = "aimb_session"
    auth_cookie_secure: bool = False
    auth_cookie_samesite: str = "lax"

    # 匿名客户端标识
    client_id_cookie_name: str = "aimb_client_id"
    client_id_cookie_days: int = 365

    # ==================== 派生属性 ====================

    @property
    def is_production(self) -> bool:
        return self.app_env == AppEnv.PRODUCTION.value

    @property
    def is_development(self) -> bool:
        return self.app_env == AppEnv.DEVELOPMENT.value

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_str.split(",")]

    # ==================== 校验器 ====================

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        allowed = {e.value for e in AppEnv}
        if v not in allowed:
            raise ValueError(f"app_env must be one of {allowed}")
        return v

    @field_validator("ai_mode")
    @classmethod
    def validate_ai_mode(cls, v: str) -> str:
        allowed = {e.value for e in AIMode}
        if v not in allowed:
            raise ValueError(f"ai_mode must be one of {allowed}")
        return v

    @field_validator("auth_cookie_samesite")
    @classmethod
    def validate_samesite(cls, v: str) -> str:
        allowed = {"strict", "lax", "none"}
        if v.lower() not in allowed:
            raise ValueError(f"auth_cookie_samesite must be one of {allowed}")
        return v.lower()

    # ==================== 启动校验 ====================

    def validate_for_production(self) -> None:
        """生产环境启动前校验，不满足则抛出异常"""
        if not self.is_production:
            return

        errors = []

        if self.debug:
            errors.append("生产环境应禁用 debug 模式 (DEBUG=false)")

        if self.host == "127.0.0.1":
            errors.append("生产环境应绑定公网地址 (HOST=0.0.0.0)")

        if not self.auth_cookie_secure:
            errors.append("生产环境应启用 HTTPS Cookie (AUTH_COOKIE_SECURE=true)")

        if errors:
            raise ValueError(f"生产环境配置校验失败:\n" + "\n".join(f"  - {e}" for e in errors))

    def log_config_summary(self, logger: logging.Logger) -> None:
        """输出配置摘要（脱敏）"""
        logger.info(f"环境: {self.app_env} | 调试: {self.debug} | AI: {self.ai_mode}")
        logger.info(f"Google 登录: {'已启用' if self.google_client_id else '未配置'}")
        logger.info(f"云端模式: {'已启用' if self.replicate_api_token else '未配置'}")


def get_settings() -> Settings:
    """获取配置实例"""
    return Settings()


settings = get_settings()
