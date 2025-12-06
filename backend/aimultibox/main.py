# -*- coding: utf-8 -*-
"""应用入口"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from aimultibox import APP_META
from aimultibox.core.config import settings
from aimultibox.core.loader import ToolLoader
from aimultibox.core.middleware import setup_middleware
from aimultibox.core.ratelimit import setup_ratelimit
from aimultibox.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    tool_loader = ToolLoader()
    tool_loader.load_all_tools(app)
    print(f"✅ {APP_META['name']} 已启动，加载了 {len(ToolLoader._tools)} 个工具")
    yield
    print(f"👋 {APP_META['name']} 已停止")


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
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_middleware(app)
setup_ratelimit(app)

app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    """根路由"""
    return {**APP_META, "docs": "/docs"}


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}
