# -*- coding: utf-8 -*-
"""认证接口"""

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from aimultibox.core.config import settings
from aimultibox.auth import repo as auth_repo
from aimultibox.auth.service import verify_google_token, create_session, delete_session, get_user_by_session, AuthError
from aimultibox.tools.currency_manager.repo import merge_client_to_user
from aimultibox.auth.schemas import UserResponse
from aimultibox.schemas import OkResponse
from starlette import status as HTTP

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    credential: str


def _serialize_user(user: Optional[dict]) -> Optional[dict]:
    if not user:
        return None
    return {
        "id": user.get("id"),
        "name": user.get("display_name"),
        "email": user.get("email"),
        "avatar_url": user.get("avatar_url"),
    }


def _set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=session_id,
        max_age=settings.auth_session_days * 86400,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
        secure=settings.auth_cookie_secure,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.auth_cookie_name,
        samesite=settings.auth_cookie_samesite,
        secure=settings.auth_cookie_secure,
    )


@router.post("/google", response_model=UserResponse)
async def login_with_google(payload: GoogleAuthRequest, request: Request, response: Response) -> dict[str, Any]:
    """Google 登录"""
    if not settings.google_client_id:
        raise HTTPException(status_code=HTTP.HTTP_400_BAD_REQUEST, detail="Google 登录未配置")

    try:
        token_info = await verify_google_token(payload.credential)
    except AuthError as exc:
        raise HTTPException(status_code=HTTP.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not token_info.get("sub"):
        raise HTTPException(status_code=HTTP.HTTP_401_UNAUTHORIZED, detail="Google Token 无效")

    user = auth_repo.get_or_create_user_from_identity(
        provider="google",
        subject=token_info.get("sub"),
        email=token_info.get("email"),
        name=token_info.get("name"),
        avatar_url=token_info.get("picture"),
    )

    client_id = getattr(request.state, "client_id", None)
    if client_id and user:
        auth_repo.link_client_to_user(client_id, user["id"])
        merge_client_to_user(client_id, user["id"])

    session_id, _ = create_session(user["id"])
    _set_session_cookie(response, session_id)

    return {
        "user": _serialize_user(user),
    }


@router.get("/me", response_model=UserResponse)
async def get_me(request: Request) -> dict[str, Any]:
    """获取当前登录状态"""
    session_id = request.cookies.get(settings.auth_cookie_name)
    user = get_user_by_session(session_id) if session_id else None
    return {"user": _serialize_user(user)}


@router.post("/logout", response_model=OkResponse)
async def logout(request: Request, response: Response) -> dict[str, Any]:
    """退出登录"""
    session_id = request.cookies.get(settings.auth_cookie_name)
    if session_id:
        delete_session(session_id)
    _clear_session_cookie(response)
    return {"ok": True}
