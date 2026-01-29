# -*- coding: utf-8 -*-
"""汇率管家 - 汇率监控、交易记录、盈亏分析、预警通知"""

__all__ = ["TOOL_META", "RATE_LIMITS", "SCHEDULER_CONFIG"]

TOOL_META = {
    "id": "currency-manager",
    "name": "汇率管家",
    "description": "汇率数据采集、交易记录管理、盈亏分析、预警通知",
    "icon": "trending-up",
    "version": "0.0.2",
}

RATE_LIMITS = {
    "trade": "5/minute",  # 交易记录操作
    "alert": "10/minute",  # 预警规则操作
}

# 后台调度器配置（秒）
SCHEDULER_CONFIG = {
    "enabled": True,  # 是否启用后台自动刷新
    "interval": 60,  # 后台刷新间隔
}
