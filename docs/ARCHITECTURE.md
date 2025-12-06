# 架构设计

[English](./ARCHITECTURE_EN.md)

## 项目结构

```
aimultibox/
├── frontend/         # React + Tailwind + Vite
├── backend/          # FastAPI
│   └── models/       # 模型文件
└── docs/             # 文档
```

## 技术栈

### 前端
- React 18 + Vite + TypeScript
- TailwindCSS
- Zustand（状态管理）
- react-i18next（国际化）
- Axios

### 后端
- FastAPI + Uvicorn
- Pydantic v2
- OpenCV + Pillow
- OnnxRuntime

## 插件系统

每个工具目录结构：
```
backend/aimultibox/tools/<tool_name>/
├── __init__.py     # 工具元信息
├── api.py          # 路由
├── service.py      # 业务逻辑
├── model.py        # AI 模型
└── schemas.py      # 数据模型
```

### 加载流程
1. `ToolLoader` 扫描 `tools/` 目录
2. 导入包含 `api.py` 的模块
3. 注册路由
4. 就绪

## 模型层

| 模式 | 引擎 | 来源 |
|------|------|------|
| local | LaMa ONNX | 本地推理 (onnxruntime) |
| cloud | SDXL | Replicate API |

模型下载：https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx

> 推荐使用 `lama_fp32.onnx`，输入固定 512x512，支持 TensorRT
> 来源：[Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX)

## 部署

开发环境:
```
Frontend (5173) → Backend (8000)
```

生产环境:
```
静态托管 → API 网关 → FastAPI (Docker)
```
