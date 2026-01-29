# -*- coding: utf-8 -*-
"""应用入口"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json

from aimultibox import APP_META
from aimultibox.core.config import settings
from aimultibox.core.loader import ToolLoader
from aimultibox.core.middleware import setup_middleware
from aimultibox.core.ratelimit import setup_ratelimit
from aimultibox.api.routes import router as api_router
from aimultibox.schemas import AppConfigResponse

from fastapi.responses import JSONResponse

logger = logging.getLogger("aimultibox")


def _utc_encoder(obj: Any) -> str:
    """datetime 统一输出为 UTC ISO 8601"""
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            obj = obj.replace(tzinfo=timezone.utc)
        return obj.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class UTCJSONResponse(JSONResponse):
    """自定义 JSON 响应，自动将 datetime 转为 UTC ISO 8601"""

    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            default=_utc_encoder,
            ensure_ascii=False
        ).encode("utf-8")


# 生产环境启动前校验
settings.validate_for_production()

# 前端静态文件目录
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"


async def cleanup_rate_history() -> None:
    """后台清理过期数据"""
    import asyncio
    await asyncio.sleep(5)  # 延迟 5 秒执行，避免影响启动
    try:
        from aimultibox.tools.currency_manager.repo import cleanup_old_rates, cleanup_old_alert_events
        from aimultibox.auth.repo import cleanup_expired_sessions, cleanup_old_clients
        deleted = cleanup_old_rates(days=90)
        cleanup_old_alert_events(days=7)
        cleanup_expired_sessions()
        cleanup_old_clients(days=30)
        if deleted > 0:
            logger.info(f"清理了 {deleted} 条过期汇率记录")
    except Exception as e:
        logger.warning(f"清理过期数据失败: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期"""
    import asyncio

    # 输出配置摘要
    settings.log_config_summary(logger)

    tool_loader = ToolLoader()
    tool_loader.load_all_tools(app)
    logger.info(f"{APP_META['name']} 已启动，加载了 {len(ToolLoader._tools)} 个工具")

    cleanup_task = asyncio.create_task(cleanup_rate_history())

    from aimultibox.tools.currency_manager.fetcher import start_scheduler, stop_scheduler
    await start_scheduler()

    yield

    await stop_scheduler()
    cleanup_task.cancel()
    logger.info(f"{APP_META['name']} 已停止")


app = FastAPI(
    title=f"{APP_META['name']} API",
    description=APP_META["description"],
    version=APP_META["version"],
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    default_response_class=UTCJSONResponse,  # 全局 datetime 自动转 UTC
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

setup_middleware(app)
setup_ratelimit(app)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/config", response_model=AppConfigResponse)
async def get_config() -> dict[str, Any]:
    """获取前端配置（API 前缀等）"""
    return {
        "apiPrefix": settings.api_prefix,
        "version": APP_META["version"],
        "googleClientId": settings.google_client_id,
    }


# 静态文件托管
if FRONTEND_DIR.exists():
    from fastapi.responses import HTMLResponse, FileResponse

    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    app.mount("/flags", StaticFiles(directory=FRONTEND_DIR / "flags"), name="flags")
    app.mount("/locales", StaticFiles(directory=FRONTEND_DIR / "locales"), name="locales")
    app.mount("/changelog", StaticFiles(directory=FRONTEND_DIR / "changelog"), name="changelog")


    @app.get("/logo.svg")
    async def serve_logo():
        return FileResponse(FRONTEND_DIR / "logo.svg", media_type="image/svg+xml")


    @app.get("/changelog.json")
    async def serve_changelog():
        return FileResponse(FRONTEND_DIR / "changelog" / "zh.json", media_type="application/json")

    # 读取 index.html 内容
    _index_html = (FRONTEND_DIR / "index.html").read_text(encoding="utf-8")

    @app.get("/", response_class=HTMLResponse)
    async def serve_index() -> str:
        return _index_html

    @app.get("/tools/{path:path}", response_class=HTMLResponse)
    async def serve_tools_spa(path: str) -> str:
        """SPA 工具页面路由"""
        return _index_html

    logger.info(f"✓ 静态文件托管已启用: {FRONTEND_DIR}")
else:
    @app.get("/")
    async def root() -> dict[str, Any]:
        return {**APP_META, "docs": "/docs"}
