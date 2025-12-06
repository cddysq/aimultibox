# AIMultiBox

Extensible AI toolbox platform.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[中文](./README.md) · [Issues](https://github.com/cddysq/aimultibox/issues) · [Feature Request](https://github.com/cddysq/aimultibox/issues/new)

## Features

- Plugin architecture, independent tool extension
- Dark mode + i18n (zh/en)
- Local/Cloud model switching
- API rate limiting
- Monorepo structure

## Project Structure

```
aimultibox/
├── frontend/                 # React + Vite + TailwindCSS
├── backend/                  # FastAPI
│   ├── aimultibox/
│   │   ├── tools/           # Tool plugins
│   │   └── core/            # Core modules (config, middleware, rate limit)
│   └── models/              # AI model files
└── docs/                    # Documentation
```

## Tools

| Tool | Model | Status |
|------|-------|--------|
| Watermark Removal | LaMa / SDXL | ✅ |

## Quick Start

### Requirements

- Node.js >= 18
- Python >= 3.10
- pnpm

### 1. Clone

```bash
git clone https://github.com/cddysq/aimultibox.git
cd aimultibox
```

### 2. Download Model (local mode)

```bash
# Download LaMa ONNX model
wget -P backend/models/ https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx
```

Or download manually and place at `backend/models/lama_fp32.onnx`

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

### 4. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Visit http://localhost:5173

## Config

Copy `backend/.env.example` to `backend/.env`:

```env
AI_MODE=local
REPLICATE_API_TOKEN=
```

| Mode | Model | Note |
|------|-------|------|
| local | LaMa | Local inference, offline |
| cloud | SDXL | Cloud processing, requires API token |

## API

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- [API Docs](./docs/API_EN.md)

## Docker

```bash
cd backend
docker build -t aimultibox-backend .
docker run -p 8000:8000 -v ./models:/app/models aimultibox-backend
```

## Contributing

Issues and PRs are welcome.

## License

[Apache-2.0](./LICENSE)
