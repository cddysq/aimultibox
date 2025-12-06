# -*- coding: utf-8 -*-
"""
限流模块

- 全局默认限流：1/10seconds（10秒1次）
- 工具在自己目录的 __init__.py 中配置 RATE_LIMITS
"""

import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger("aimultibox")

# 全局默认限流：10秒1次
DEFAULT_LIMIT = "1/10seconds"


def get_client_ip(request: Request) -> str:
    """获取客户端 IP（支持代理）"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# 限流器实例
limiter = Limiter(
    key_func=get_client_ip,
    default_limits=[DEFAULT_LIMIT],
    headers_enabled=True,
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """限流异常处理"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    logger.warning(f"[{request_id}] 限流触发: {exc.detail}")
    
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {
                "type": "RATE_LIMIT_EXCEEDED",
                "message": "请求过于频繁，请稍后再试",
                "detail": str(exc.detail),
            },
            "request_id": request_id,
        },
        headers={"Retry-After": "10"}
    )


def setup_ratelimit(app: FastAPI) -> None:
    """配置限流"""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    logger.info(f"✓ 限流配置完成 (默认: {DEFAULT_LIMIT})")
