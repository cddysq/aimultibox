# Architecture

[中文](./ARCHITECTURE.md)

## Tech Stack

**Frontend**: React 19 + Vite 6 + TypeScript 5.7 + Tailwind CSS 4 + Zustand

**Backend**: FastAPI + Pydantic v2 + OnnxRuntime

## Directory Structure

```
frontend/src/
├── api/          # API wrappers
├── components/   # Shared components
├── stores/       # Zustand state
├── tools/        # Tool pages
└── types/        # Type definitions

backend/aimultibox/
├── core/         # Config, middleware, plugin loader
├── models/       # Shared data models
└── tools/        # Tool plugins
```

## Plugin Structure

Each tool is an independent plugin in the `tools/` directory:

```
tools/<tool_name>/
├── __init__.py   # TOOL_META metadata
├── api.py        # Routes (exports router)
├── service.py    # Business logic
└── schemas.py    # Pydantic models
```

### Tool Metadata

```python
# __init__.py
TOOL_META = {
    "id": "tool-slug",        # API path
    "name": "Tool Name",
    "description": "Description",
    "icon": "lucide-icon",    # Icon name
    "version": "0.0.1"
}
```

On startup, `ToolLoader` scans and registers tools to `/api/tools/{id}/`.

## Core Modules

- `core/config.py` - Config management (loads from .env)
- `core/loader.py` - Plugin loader
- `core/middleware.py` - Request logging, error handling
- `core/ratelimit.py` - Rate limiting

## Deployment

**Development**: Vite proxies `/api` to backend

**Production**: Static hosting + Docker
