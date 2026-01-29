# -*- coding: utf-8 -*-
"""错误响应工具"""

from __future__ import annotations

from typing import Any
from fastapi.responses import JSONResponse

from .enums import ErrorCode
from starlette import status as HTTP
from aimultibox.schemas import ErrorResponse, ErrorDetail

HTTP_CODE_MAP: dict[int, ErrorCode] = {
    HTTP.HTTP_400_BAD_REQUEST: ErrorCode.BAD_REQUEST,
    HTTP.HTTP_401_UNAUTHORIZED: ErrorCode.UNAUTHORIZED,
    HTTP.HTTP_403_FORBIDDEN: ErrorCode.FORBIDDEN,
    HTTP.HTTP_404_NOT_FOUND: ErrorCode.NOT_FOUND,
    HTTP.HTTP_405_METHOD_NOT_ALLOWED: ErrorCode.METHOD_NOT_ALLOWED,
    HTTP.HTTP_500_INTERNAL_SERVER_ERROR: ErrorCode.INTERNAL_ERROR,
}


def error_code_from_status(status_code: int) -> ErrorCode:
    return HTTP_CODE_MAP.get(status_code, ErrorCode.UNKNOWN_ERROR)


def error_response(
    code: ErrorCode,
    message: str,
    status_code: int,
    details: Any | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    data = ErrorResponse(
        error=ErrorDetail(
            code=code.value,
            message=message,
            details=details,
        )
    )
    return JSONResponse(status_code=status_code, content=data.model_dump(), headers=headers)
