# Architecture

[中文](./ARCHITECTURE.md)

## Structure

```
aimultibox/
├── frontend/         # React + Tailwind + Vite
├── backend/          # FastAPI
│   └── models/       # Model files
└── docs/             # Documentation
```

## Tech Stack

### Frontend
- React 18 + Vite + TypeScript
- TailwindCSS
- Zustand (state)
- react-i18next (i18n)
- Axios

### Backend
- FastAPI + Uvicorn
- Pydantic v2
- OpenCV + Pillow
- OnnxRuntime

## Plugin System

Tool directory structure:
```
backend/aimultibox/tools/<tool_name>/
├── __init__.py     # Meta info
├── api.py          # Routes
├── service.py      # Business logic
├── model.py        # AI model
└── schemas.py      # Data models
```

### Load Flow
1. `ToolLoader` scans `tools/`
2. Import modules with `api.py`
3. Register routes
4. Ready

## Model Layer

| Mode | Engine | Source |
|------|--------|--------|
| local | LaMa ONNX | Local inference (onnxruntime) |
| cloud | SDXL | Replicate API |

Model download: https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx

> Recommend `lama_fp32.onnx`, fixed input 512x512, TensorRT compatible
> Source: [Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX)

## Deploy

Dev:
```
Frontend (5173) → Backend (8000)
```

Prod:
```
Static Host → API Gateway → FastAPI (Docker)
```
