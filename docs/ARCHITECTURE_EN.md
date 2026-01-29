# Architecture

[中文](./ARCHITECTURE.md)

## Tech Stack

**Frontend**: React 19 + Vite 6 + TypeScript 5.7 + Tailwind CSS 4 + Zustand + TanStack Query + i18next

**Backend**: FastAPI + Pydantic v2 + OnnxRuntime

## Directory Structure

```
frontend/src/
├── api/          # Business APIs
├── components/   # Shared components
├── config/       # Init config (i18n / api / query)
├── hooks/        # Custom hooks (incl. auth)
├── stores/       # Zustand state
├── tools/        # Tool pages
├── types/        # Type definitions
└── utils/        # Utilities

backend/aimultibox/
├── auth/         # Auth module (OAuth login)
├── core/         # Config, middleware, plugin loader
├── db/           # ORM infrastructure
├── schemas/      # Common Pydantic models
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
- `core/cache.py` - Cache wrapper
- `core/sse.py` - SSE push

## Response Conventions

HTTP semantic style:

- Success: HTTP 2xx, return the business payload directly
- Error: HTTP 4xx/5xx with an `error` object:
  - `error.code`
  - `error.message`
  - `error.details` (optional)
- Trace id is exposed via `X-Request-ID` header

## Deployment

**Development**: Vite proxies `/api` to backend

**Production**: Static hosting + Docker
