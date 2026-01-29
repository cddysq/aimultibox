# AIMultiBox

Open-source, self-hosted AI toolbox with watermark removal and currency manager, plugin‑based with local / cloud
inference switching, built for rapid deployment and customization.

[中文](./README.md)

## What you can do

- Image watermark removal (manual mask / auto detect)
- Currency monitoring, trade records, P/L analysis, rate alerts
- Build your own AI tools platform

## Key features

- ✅ Plugin tools for rapid AI feature expansion
- ✅ Local inference or cloud API mode
- ✅ Multi‑language UI with dark mode
- ✅ Frontend / backend separation, easy to self‑host

## Demo

No public demo yet. Run locally to try it out.

## Screenshots

No public screenshots yet.

## Quick start

```bash
git clone https://github.com/cddysq/aimultibox.git
cd aimultibox
cd backend && pip install -r requirements.txt
cd ../frontend && pnpm install
```

```bash
# Terminal 1 - Backend
cd backend && python run.py --reload

# Terminal 2 - Frontend
cd frontend && pnpm dev
```

Visit http://localhost:5173

## Tools

| Tool                 | Description                                  | Status      |
|----------------------|----------------------------------------------|-------------|
| AI Watermark Removal | Image watermark removal based on LaMa        | ✅ Available |
| Currency Manager     | Real-time rates, trade records, P/L analysis | ✅ Available |
| More tools           | In development                               | 🚧          |

## Model download (optional)

```bash
# Linux/macOS
wget -P backend/models/ https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx
```

## Configuration

Copy `backend/.env.example` to `backend/.env` with common fields:

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

## Docs

- [API Docs](http://localhost:8000/docs)
- [Architecture](./docs/ARCHITECTURE_EN.md)
- [Changelog](/changelog)
- Build changelog: `node ./scripts/build-changelog.mjs`

## License

[Apache-2.0](./LICENSE)
