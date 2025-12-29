# AIMultiBox

Extensible AI toolbox platform with plugin architecture, supporting local and cloud model switching.

[中文](./README.md)

## Features

- **Plugin Architecture** - Independent tool development, hot-pluggable
- **Dual Mode** - Switch between local inference and cloud API
- **Monorepo** - FastAPI + React 19 + TypeScript 5.7
- **Modern Stack** - Vite 6 + Tailwind CSS 4 + ESLint 9
- **i18n** - Multi-language support + Dark mode

## Tools

| Tool | Description | Status |
|------|-------------|--------|
| [AI Watermark Removal](#ai-watermark-removal) | Image watermark removal based on LaMa | ✅ Available |
| [Currency Manager](#currency-manager) | Real-time rates, trade records, P/L analysis | ✅ Available |
| More tools | In development... | 🚧 |

### AI Watermark Removal

Image watermark removal tool based on LaMa model.

- Manual mode: Paint brush to mark watermark areas
- Auto mode: Automatically detect and remove text watermarks
- Supports local LaMa ONNX or cloud SDXL Inpainting

### Currency Manager

Personal forex management tool with real-time CMB bank rates.

- Real-time rate monitoring + Historical charts
- Trade records management (buy/sell)
- P/L analysis + Return rate calculation
- Rate alert notifications

## Quick Start

### Requirements

- Python >= 3.10
- Node.js >= 20.19 (22.x recommended)
- pnpm >= 9

### Installation

```bash
# Clone
git clone https://github.com/cddysq/aimultibox.git
cd aimultibox

# Start backend
cd backend
pip install -r requirements.txt
python run.py

# Start frontend (new terminal)
cd frontend
pnpm install
pnpm dev
```

Visit http://localhost:5173

### Model Download (optional)

Watermark removal requires LaMa model:

```bash
# Linux/macOS
wget -P backend/models/ https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx

# Or download manually to backend/models/lama_fp32.onnx
```

## Configuration

Copy `backend/.env.example` to `backend/.env`:

```env
# AI mode: local=local inference, cloud=cloud API
AI_MODE=local

# Replicate API Token for cloud mode
REPLICATE_API_TOKEN=
```

## Docker Deployment

```bash
cd backend
docker build -t aimultibox .
docker run -p 8000:8000 \
  -v ./models:/app/models \
  -v ./data:/app/data \
  aimultibox
```

## Documentation

- [API Docs](http://localhost:8000/docs) - Swagger UI
- [Architecture](./docs/ARCHITECTURE_EN.md) - Plugin structure & development guide

## License

[Apache-2.0](./LICENSE)
