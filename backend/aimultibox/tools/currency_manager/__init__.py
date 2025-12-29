# -*- coding: utf-8 -*-
"""汇率管家 - 汇率监控、交易记录、盈亏分析、预警通知"""

__all__ = ["TOOL_META", "RATE_LIMITS", "REFRESH_CONFIG"]

TOOL_META = {
    "id": "currency-manager",
    "name": "汇率管家",
    "description": "汇率数据采集、交易记录管理、盈亏分析、预警通知",
    "icon": "trending-up",
    "version": "0.0.1",
}

# 限流配置
RATE_LIMITS = {
    "fetch": "1/10seconds",  # 手动刷新汇率
    "trade": "5/minute",     # 交易记录操作
    "alert": "10/minute",    # 预警规则操作
}

# 刷新间隔配置（秒）
REFRESH_CONFIG = {
    "default_interval": 300,  # 默认 5 分钟
    "min_interval": 60,       # 最小 1 分钟，同时作为缓存 TTL
    "max_interval": 1800,     # 最大 30 分钟
}
