# -*- coding: utf-8 -*-
"""全局中间件"""

import time
import uuid
import logging
from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from aimultibox.core.config import settings
from aimultibox.common.enums import ErrorCode
from aimultibox.common.errors import error_response, error_code_from_status
from starlette import status as HTTP
from aimultibox.auth.repo import upsert_client, get_user_by_session
from aimultibox.db import set_scope, reset_scope

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# 降低第三方库的冗余请求日志（例如 httpx 每次外部请求的 INFO 输出）
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger("aimultibox")


class RequestLogMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        client_id = request.cookies.get(settings.client_id_cookie_name)
        if not client_id:
            client_id = str(uuid.uuid4())
        request.state.client_id = client_id

        tokens = None
        try:
            session_id = request.cookies.get(settings.auth_cookie_name)
            user = get_user_by_session(session_id) if session_id else None
            request.state.user_id = user.get("id") if user else None
            upsert_client(client_id, request.state.user_id)
            tokens = set_scope(request.state.user_id, client_id)
        except Exception as e:
            logger.warning(f"[{request_id}] 认证解析失败: {e}")
            request.state.user_id = None
            tokens = set_scope(None, client_id)

        start_time = time.time()
        method = request.method

        path = request.url.path
        if request.url.query:
            path = f"{path}?{request.url.query}"

        client_ip = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)

            duration = (time.time() - start_time) * 1000
            status_code = response.status_code

            log_level = logging.INFO if status_code < 400 else logging.WARNING
            logger.log(log_level, f"[{request_id}] {method} {path} {status_code} | {duration:.1f}ms | {client_ip}")

            response.headers["X-Request-ID"] = request_id
            response.set_cookie(
                key=settings.client_id_cookie_name,
                value=client_id,
                max_age=settings.client_id_cookie_days * 86400,
                httponly=False,
                samesite=settings.auth_cookie_samesite,
                secure=settings.auth_cookie_secure,
            )
            return response

        except Exception as e:
            duration = (time.time() - start_time) * 1000
            logger.error(f"[{request_id}] {method} {path} 500 | {duration:.1f}ms | {client_ip} | {str(e)}")
            raise
        finally:
            if tokens:
                reset_scope(tokens)


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
    def _attach_ids(response: JSONResponse, request: Request) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        client_id = getattr(request.state, "client_id", None)
        response.headers["X-Request-ID"] = request_id
        if client_id:
            response.set_cookie(
                key=settings.client_id_cookie_name,
                value=client_id,
                max_age=settings.client_id_cookie_days * 86400,
                httponly=False,
                samesite=settings.auth_cookie_samesite,
                secure=settings.auth_cookie_secure,
            )
        return response

    @staticmethod
    async def api_exception_handler(request: Request, exc: APIException) -> JSONResponse:
        """API 异常处理"""
        request_id = getattr(request.state, 'request_id', 'unknown')
        logger.warning(f"[{request_id}] {exc.error_type}: {exc.message}")

        try:
            code = ErrorCode(exc.error_type)
        except Exception:
            code = ErrorCode.UNKNOWN_ERROR
        response = error_response(
            code,
            exc.message,
            exc.code,
            exc.details,
        )
        return ExceptionHandlers._attach_ids(response, request)

    @staticmethod
    async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """验证异常处理"""
        from pydantic import ValidationError

        request_id = getattr(request.state, 'request_id', 'unknown')

        if isinstance(exc, ValidationError):
            errors = exc.errors()
            message = "参数验证失败"
            fields: list[dict] = []
            for err in errors:
                loc = err.get("loc", [])
                field = ".".join(str(item) for item in loc if item is not None) if loc else ""
                fields.append({
                    "field": field,
                    "loc": loc,
                    "message": err.get("msg", ""),
                    "type": err.get("type", ""),
                })
            details = {"errors": errors, "fields": fields}
        else:
            message = str(exc)
            details = {}

        logger.warning(f"[{request_id}] 验证错误: {message}")

        response = error_response(
            ErrorCode.VALIDATION_ERROR,
            message,
            HTTP.HTTP_422_UNPROCESSABLE_ENTITY,
            details,
        )
        return ExceptionHandlers._attach_ids(response, request)

    @staticmethod
    async def response_validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """响应验证异常处理"""
        from fastapi.exceptions import ResponseValidationError
        request_id = getattr(request.state, 'request_id', 'unknown')

        if isinstance(exc, ResponseValidationError):
            errors = exc.errors()
            message = "响应校验失败"
            details = {"errors": errors}
        else:
            message = str(exc)
            details = {}

        logger.error(f"[{request_id}] 响应验证错误: {message}")
        response = error_response(
            ErrorCode.RESPONSE_VALIDATION_ERROR,
            message,
            HTTP.HTTP_500_INTERNAL_SERVER_ERROR,
            details,
        )
        return ExceptionHandlers._attach_ids(response, request)
    @staticmethod
    async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """HTTP 异常处理"""
        from fastapi import HTTPException

        request_id = getattr(request.state, 'request_id', 'unknown')

        details = None
        if isinstance(exc, HTTPException):
            status_code = exc.status_code
            if isinstance(exc.detail, (dict, list)):
                details = exc.detail
                message = "请求错误"
            else:
                message = str(exc.detail)
        else:
            status_code = 500
            message = "内部错误"

        error_type = error_code_from_status(status_code)

        logger.error(f"[{request_id}] HTTP {status_code}: {message}")

        response = error_response(
            error_type,
            message,
            status_code,
            details if details is not None else None,
        )
        return ExceptionHandlers._attach_ids(response, request)

    @staticmethod
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """通用异常处理"""
        request_id = getattr(request.state, 'request_id', 'unknown')
        logger.exception(f"[{request_id}] 未处理异常: {str(exc)}")

        response = error_response(
            ErrorCode.INTERNAL_ERROR,
            "内部错误",
            HTTP.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        return ExceptionHandlers._attach_ids(response, request)


def setup_middleware(app: FastAPI) -> None:
    """配置中间件"""
    from fastapi import HTTPException
    from pydantic import ValidationError
    from fastapi.exceptions import ResponseValidationError

    app.add_middleware(RequestLogMiddleware)

    app.add_exception_handler(APIException, ExceptionHandlers.api_exception_handler)
    app.add_exception_handler(ValidationError, ExceptionHandlers.validation_exception_handler)
    app.add_exception_handler(ResponseValidationError, ExceptionHandlers.response_validation_exception_handler)
    app.add_exception_handler(HTTPException, ExceptionHandlers.http_exception_handler)
    app.add_exception_handler(Exception, ExceptionHandlers.general_exception_handler)

    logger.info("✓ 中间件配置完成")
