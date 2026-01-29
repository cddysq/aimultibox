# AIMultiBox

开源自托管 AI 工具箱，内置水印去除与汇率管家，插件式架构支持本地 / 云端推理切换，面向二次开发与自部署

[English](./README_EN.md)

## 你能用它做什么

- 图片水印去除（手动遮罩 / 自动检测）
- 汇率监控、交易记录、盈亏分析、预警通知
- 构建自己的 AI 工具平台

## 核心特性

- ✅ 插件式工具：每个工具独立开发、可热插拔
- ✅ 本地 / 云端推理：按需选择成本与性能
- ✅ 多语言与暗色模式：面向不同地区用户
- ✅ 前后端分离：适合自部署与二次开发

## Demo

当前无在线 Demo，建议本地快速启动体验

## 界面预览

暂无公开截图

## 快速开始

```bash
git clone https://github.com/cddysq/aimultibox.git
cd aimultibox
cd backend && pip install -r requirements.txt
cd ../frontend && pnpm install
```

```bash
# 终端 1 - 后端
cd backend && python run.py --reload

# 终端 2 - 前端
cd frontend && pnpm dev
```

访问 http://localhost:5173

## 工具清单

| 工具     | 说明               | 状态   |
|--------|------------------|------|
| AI 去水印 | 基于 LaMa 的图片水印去除  | ✅ 可用 |
| 汇率管家   | 实时汇率监控、交易记录、盈亏分析 | ✅ 可用 |
| 更多工具   | 持续开发中            | 🚧   |

## 模型下载（可选）

```bash
# Linux/macOS
wget -P backend/models/ https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx
```

## 配置

复制 `backend/.env.example` 为 `backend/.env`，常用项如下：

```env
APP_ENV=development
DEBUG=true
HOST=127.0.0.1
PORT=8000
GOOGLE_CLIENT_ID=
AI_MODE=local
REPLICATE_API_TOKEN=
API_PREFIX=/api
CORS_ORIGINS_STR=http://localhost:5173,http://127.0.0.1:5173
```

## 文档入口

- [API 文档](http://localhost:8000/docs)
- [架构说明](./docs/ARCHITECTURE.md)
- [更新日志](/changelog)
- 手动生成更新日志：`node ./scripts/build-changelog.mjs`

## 许可证

[Apache-2.0](./LICENSE)
