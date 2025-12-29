# AIMultiBox

可扩展的 AI 工具箱平台，采用插件式架构，支持本地与云端模型切换。

[English](./README_EN.md)

## 特性

- **插件式架构** - 工具独立开发，热插拔加载
- **双模式切换** - 本地推理 / 云端 API 自由切换
- **前后端分离** - FastAPI + React 19 + TypeScript 5.7
- **现代化技术栈** - Vite 6 + Tailwind CSS 4 + ESLint 9
- **国际化** - 中英文切换 + 暗色模式

## 工具列表

| 工具 | 说明 | 状态 |
|------|------|------|
| [AI 去水印](#ai-去水印) | 基于 LaMa 模型的图片水印去除 | ✅ 可用 |
| [汇率管家](#汇率管家) | 实时汇率监控、交易记录、盈亏分析 | ✅ 可用 |
| 更多工具 | 持续开发中... | 🚧 |

### AI 去水印

基于 LaMa 模型的图片水印去除工具。

- 手动标注模式：画笔涂抹水印区域
- 自动检测模式：自动识别并去除文字水印
- 支持本地 LaMa ONNX 或云端 SDXL Inpainting

### 汇率管家

个人外汇管理工具，数据来源为招商银行实时汇率。

- 实时汇率监控 + 历史走势图
- 交易记录管理（买入/卖出）
- 持仓盈亏分析 + 收益率计算
- 汇率预警通知

## 快速开始

### 环境要求

- Python >= 3.10
- Node.js >= 20.19 （推荐 22.x）
- pnpm >= 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/cddysq/aimultibox.git
cd aimultibox

# 启动后端
cd backend
pip install -r requirements.txt
python run.py

# 启动前端（新开一个终端）
cd frontend
pnpm install
pnpm dev
```

访问 http://localhost:5173

### 模型下载（可选）

去水印功能需要 LaMa 模型：

```bash
# Linux/macOS
wget -P backend/models/ https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx

# 或手动下载后放到 backend/models/lama_fp32.onnx
```

## 配置

复制 `backend/.env.example` 为 `backend/.env`：

```env
# AI 模式: local=本地推理, cloud=云端 API
AI_MODE=local

# 云端模式需要 Replicate API Token
REPLICATE_API_TOKEN=
```

## Docker 部署

```bash
cd backend
docker build -t aimultibox .
docker run -p 8000:8000 \
  -v ./models:/app/models \
  -v ./data:/app/data \
  aimultibox
```

## 文档

- [API 文档](http://localhost:8000/docs) - Swagger UI
- [架构说明](./docs/ARCHITECTURE.md) - 插件结构与开发指南

## 许可证

[Apache-2.0](./LICENSE)
