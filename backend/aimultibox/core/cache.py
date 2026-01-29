# -*- coding: utf-8 -*-
"""缓存管理"""

from typing import Any, Callable, Optional, TypeVar
from cachetools import TTLCache
import threading

T = TypeVar("T")

_lock = threading.Lock()
_caches: dict[str, TTLCache] = {}


def get_cache(name: str, maxsize: int = 128, ttl: int = 60) -> TTLCache:
    """获取或创建命名缓存"""
    with _lock:
        if name not in _caches:
            _caches[name] = TTLCache(maxsize=maxsize, ttl=ttl)
        return _caches[name]


def clear_cache(name: str) -> None:
    """清除指定缓存"""
    with _lock:
        if name in _caches:
            _caches[name].clear()


def clear_all_caches() -> None:
    """清除所有缓存"""
    with _lock:
        for cache in _caches.values():
            cache.clear()


def cached(
    cache_name: str,
    key_func: Optional[Callable[..., str]] = None,
    maxsize: int = 128,
    ttl: int = 60,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """缓存装饰器

    Args:
        cache_name: 缓存名称
        key_func: 自定义 key 生成函数，接收原函数参数，返回缓存 key
        maxsize: 最大缓存数量
        ttl: 缓存过期时间（秒）
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        def wrapper(*args, **kwargs) -> T:
            cache = get_cache(cache_name, maxsize, ttl)

            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"{args}:{kwargs}"

            if cache_key in cache:
                return cache[cache_key]

            result = func(*args, **kwargs)
            cache[cache_key] = result
            return result

        return wrapper

    return decorator
