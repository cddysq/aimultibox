# 架构说明

[English](./ARCHITECTURE_EN.md)

## 技术栈

**前端**: React 19 + Vite 6 + TypeScript 5.7 + Tailwind CSS 4 + Zustand + TanStack Query + i18next

**后端**: FastAPI + Pydantic v2 + OnnxRuntime

## 目录结构

```
frontend/src/
├── api/          # 业务 API
├── components/   # 公共组件
├── config/       # 初始化配置（i18n / api / query）
├── hooks/        # 自定义 Hooks（含认证）
├── stores/       # Zustand 状态
├── tools/        # 工具页面
├── types/        # 类型定义
└── utils/        # 工具函数

backend/aimultibox/
├── auth/         # 认证模块（OAuth 登录）
├── core/         # 配置、中间件、插件加载
├── db/           # ORM 基础设施
├── schemas/      # 公共 Pydantic 模型
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
- `core/cache.py` - 缓存封装
- `core/sse.py` - SSE 推送

## 响应结构规范

遵循 HTTP 语义：

- 成功：HTTP 2xx，直接返回业务数据本体
- 失败：HTTP 4xx/5xx，返回 `error` 对象：
  - `error.code`
  - `error.message`
  - `error.details`（可选）
- 追踪 ID 通过响应头 `X-Request-ID` 返回

## 部署

**开发**: Vite 代理 `/api` 到后端

**生产**: 静态托管 + Docker
