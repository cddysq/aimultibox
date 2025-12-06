# AIMultiBox

可扩展的 AI 工具箱平台

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English](./README_EN.md) · [问题反馈](https://github.com/cddysq/aimultibox/issues) · [功能建议](https://github.com/cddysq/aimultibox/issues/new)

## 功能

- 插件式架构，工具独立扩展
- 暗色模式 + 中英文切换
- 本地/云端模型切换
- API 限流保护
- 前后端分离 Monorepo

## 项目结构

```
aimultibox/
├── frontend/                 # React + Vite + TailwindCSS
├── backend/                  # FastAPI
│   ├── aimultibox/
│   │   ├── tools/           # 工具插件目录
│   │   └── core/            # 核心模块（配置、中间件、限流）
│   └── models/              # AI 模型文件
└── docs/                    # 详细文档
```

## 工具

| 工具 | 模型 | 状态 |
|------|------|------|
| 去水印 | LaMa / SDXL | ✅ |

## 快速开始

### 环境

- Node.js >= 18
- Python >= 3.10
- pnpm

### 1. 克隆

```bash
git clone https://github.com/cddysq/aimultibox.git
cd aimultibox
```

### 2. 下载模型（本地模式）

```bash
# 下载 LaMa ONNX 模型
wget -P backend/models/ https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx
```

或手动下载后放到 `backend/models/lama_fp32.onnx`

### 3. 启动后端

```bash
cd backend
pip install -r requirements.txt
python run.py
```

### 4. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

访问 http://localhost:5173

## 配置

复制 `backend/.env.example` 为 `backend/.env`：

```env
AI_MODE=local
REPLICATE_API_TOKEN=
```

| 模式 | 模型 | 说明 |
|------|------|------|
| local | LaMa | 本地推理，无需联网 |
| cloud | SDXL | 云端处理，需 API Token |

## API

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- [API 文档](./docs/API.md)

## Docker

```bash
cd backend
docker build -t aimultibox-backend .
docker run -p 8000:8000 -v ./models:/app/models aimultibox-backend
```

## 贡献

欢迎提交 Issue 和 PR。

## 许可证

[Apache-2.0](./LICENSE)
