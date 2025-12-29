# -*- coding: utf-8 -*-
"""全局中间件"""

import time
import uuid
import logging
from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("aimultibox")


class RequestLogMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        start_time = time.time()
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"
        
        logger.info(f"[{request_id}] → {method} {path} | {client_ip}")
        
        try:
            response = await call_next(request)
            
            duration = (time.time() - start_time) * 1000
            status_code = response.status_code
            
            log_level = logging.INFO if status_code < 400 else logging.WARNING
            logger.log(log_level, f"[{request_id}] ← {status_code} | {duration:.1f}ms")
            
            response.headers["X-Request-ID"] = request_id
            return response
            
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            logger.error(f"[{request_id}] ✗ {duration:.1f}ms | {str(e)}")
            raise


class APIException(Exception):
    """API 异常"""
    
    def __init__(
        self, 
        message: str, 
        code: int = 400, 
        error_type: str = "BAD_REQUEST",
        details: dict | None = None
    ) -> None:
        self.message = message
        self.code = code
        self.error_type = error_type
        self.details = details or {}
        super().__init__(self.message)


class ExceptionHandlers:
    """异常处理器"""
    
    @staticmethod
    async def api_exception_handler(request: Request, exc: APIException) -> JSONResponse:
        """API 异常处理"""
        request_id = getattr(request.state, 'request_id', 'unknown')
        logger.warning(f"[{request_id}] {exc.error_type}: {exc.message}")
        
        return JSONResponse(
            status_code=exc.code,
            content={
                "success": False,
                "error": {
                    "type": exc.error_type,
                    "message": exc.message,
                    "details": exc.details,
                },
                "request_id": request_id,
            }
        )
    
    @staticmethod
    async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """验证异常处理"""
        from pydantic import ValidationError
        
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        if isinstance(exc, ValidationError):
            errors = exc.errors()
            message = "参数验证失败"
            details = {"errors": errors}
        else:
            message = str(exc)
            details = {}
        
        logger.warning(f"[{request_id}] 验证错误: {message}")
        
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "type": "VALIDATION_ERROR",
                    "message": message,
                    "details": details,
                },
                "request_id": request_id,
            }
        )
    
    @staticmethod
    async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """HTTP 异常处理"""
        from fastapi import HTTPException
        
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        if isinstance(exc, HTTPException):
            status_code = exc.status_code
            message = exc.detail
        else:
            status_code = 500
            message = "内部错误"
        
        error_type = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            500: "INTERNAL_ERROR",
        }.get(status_code, "UNKNOWN_ERROR")
        
        logger.error(f"[{request_id}] HTTP {status_code}: {message}")
        
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "error": {
                    "type": error_type,
                    "message": message,
                },
                "request_id": request_id,
            }
        )
    
    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """通用异常处理"""
        request_id = getattr(request.state, 'request_id', 'unknown')
        logger.exception(f"[{request_id}] 未处理异常: {str(exc)}")
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "type": "INTERNAL_ERROR",
                    "message": "内部错误",
                },
                "request_id": request_id,
            }
        )


def setup_middleware(app: FastAPI) -> None:
    """配置中间件"""
    from fastapi import HTTPException
    from pydantic import ValidationError
    
    app.add_middleware(RequestLogMiddleware)
    
    app.add_exception_handler(APIException, ExceptionHandlers.api_exception_handler)
    app.add_exception_handler(ValidationError, ExceptionHandlers.validation_exception_handler)
    app.add_exception_handler(HTTPException, ExceptionHandlers.http_exception_handler)
    app.add_exception_handler(Exception, ExceptionHandlers.general_exception_handler)
    
    logger.info("✓ 中间件配置完成")
