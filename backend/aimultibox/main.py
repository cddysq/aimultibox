# -*- coding: utf-8 -*-
"""应用入口"""

import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger("aimultibox")
from fastapi.middleware.cors import CORSMiddleware

from aimultibox import APP_META
from aimultibox.core.config import settings
from aimultibox.core.loader import ToolLoader
from aimultibox.core.middleware import setup_middleware
from aimultibox.core.ratelimit import setup_ratelimit
from aimultibox.api.routes import router as api_router

# 前端静态文件目录
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"


async def cleanup_rate_history() -> None:
    """后台清理过期汇率数据"""
    import asyncio
    await asyncio.sleep(5)  # 延迟 5 秒执行，避免影响启动
    try:
        from aimultibox.tools.currency_manager.database import cleanup_old_rates
        deleted = cleanup_old_rates(days=90)
        if deleted > 0:
            logger.info(f"清理了 {deleted} 条过期汇率记录")
    except Exception as e:
        logger.warning(f"清理汇率历史失败: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期"""
    import asyncio

    tool_loader = ToolLoader()
    tool_loader.load_all_tools(app)
    logger.info(f"{APP_META['name']} 已启动，加载了 {len(ToolLoader._tools)} 个工具")

    # 后台清理任务
    cleanup_task = asyncio.create_task(cleanup_rate_history())

    yield

    cleanup_task.cancel()
    logger.info(f"{APP_META['name']} 已停止")


app = FastAPI(
    title=f"{APP_META['name']} API",
    description=APP_META["description"],
    version=APP_META["version"],
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
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


@app.get("/health")
async def health_check() -> dict[str, str]:
    """健康检查"""
    return {"status": "healthy"}


@app.get("/config")
async def get_config() -> dict[str, Any]:
    """获取前端配置（API 前缀等）"""
    return {
        "apiPrefix": settings.api_prefix,
        "version": APP_META["version"],
    }


# 静态文件托管
if FRONTEND_DIR.exists():
    from fastapi.responses import HTMLResponse

    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

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
