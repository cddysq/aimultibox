# 架构说明

[English](./ARCHITECTURE_EN.md)

## 技术栈

**前端**: React 19 + Vite 6 + TypeScript 5.7 + Tailwind CSS 4 + Zustand

**后端**: FastAPI + Pydantic v2 + OnnxRuntime

## 目录结构

```
frontend/src/
├── api/          # API 封装
├── components/   # 公共组件
├── stores/       # Zustand 状态
├── tools/        # 工具页面
└── types/        # 类型定义

backend/aimultibox/
├── core/         # 配置、中间件、插件加载
├── models/       # 公共数据模型
└── tools/        # 工具插件
```

## 插件结构

每个工具是独立的插件，放在 `tools/` 目录下：

```
tools/<tool_name>/
├── __init__.py   # TOOL_META 元信息
├── api.py        # 路由（导出 router）
├── service.py    # 业务逻辑
└── schemas.py    # Pydantic 模型
```

### 工具元信息

```python
# __init__.py
TOOL_META = {
    "id": "tool-slug",        # API 路径
    "name": "工具名称",
    "description": "描述",
    "icon": "lucide-icon",    # 图标名
    "version": "0.0.1"
}
```

启动时 `ToolLoader` 自动扫描并注册到 `/api/tools/{id}/`。

## 核心模块

- `core/config.py` - 配置管理（从 .env 加载）
- `core/loader.py` - 插件加载器
- `core/middleware.py` - 请求日志、错误处理
- `core/ratelimit.py` - 限流

## 部署

**开发**: Vite 代理 `/api` 到后端

**生产**: 静态托管 + Docker
