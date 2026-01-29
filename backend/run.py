#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""启动器"""

import argparse
import uvicorn

from aimultibox import APP_META
from aimultibox.core.config import settings


def main():
    parser = argparse.ArgumentParser(description=APP_META['name'])
    parser.add_argument("--host", default=settings.host)
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--reload", action="store_true")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║     █████╗ ██╗███╗   ███╗██╗   ██╗██╗  ████████╗██╗         ║
║    ██╔══██╗██║████╗ ████║██║   ██║██║  ╚══██╔══╝██║         ║
║    ███████║██║██╔████╔██║██║   ██║██║     ██║   ██║         ║
║    ██╔══██║██║██║╚██╔╝██║██║   ██║██║     ██║   ██║         ║
║    ██║  ██║██║██║ ╚═╝ ██║╚██████╔╝███████╗██║   ██║         ║
║    ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝         ║
║                                                              ║
║    {APP_META['name']} v{APP_META['version']}                                       ║
╚══════════════════════════════════════════════════════════════╝

🚀 http://127.0.0.1:{args.port}
   API 文档: http://127.0.0.1:{args.port}/docs
   模式: {settings.ai_mode}
""")
    
    uvicorn.run(
        "aimultibox.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        access_log=False,
    )


if __name__ == "__main__":
    main()
