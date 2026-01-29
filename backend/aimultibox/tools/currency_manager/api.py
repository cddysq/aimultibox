# -*- coding: utf-8 -*-
"""汇率管家 - API 路由"""

import csv
import io
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from aimultibox.core.ratelimit import limiter, DEFAULT_LIMIT
from starlette import status as HTTP
from aimultibox.schemas import OkResponse
from . import TOOL_META, RATE_LIMITS, SCHEDULER_CONFIG
from .service import service
from . import fetcher as fetcher_module
from .schemas import (
    TradeCreate, TradeUpdate, TradeRecord, TradeListResponse,
    AlertCreate, AlertUpdate, AlertRule, AlertListResponse,
    RatesResponse, HistoryResponse, SummaryResponse, ToolInfoResponse,
)

router = APIRouter()


@router.get("/", response_model=ToolInfoResponse)
async def tool_info() -> dict[str, Any]:
    """获取工具信息"""
    currencies = service.get_supported_currencies()
    return {
        **TOOL_META,
        "supported_currencies": currencies,
        "features": [
            {
                "id": "rate_monitor",
                "name": "汇率监控",
                "description": "实时汇率数据和历史走势",
            },
            {
                "id": "trade_record",
                "name": "交易记录",
                "description": "记录买入卖出交易",
            },
            {
                "id": "profit_analysis",
                "name": "盈亏分析",
                "description": "计算持仓盈亏和收益率",
            },
            {
                "id": "rate_alert",
                "name": "汇率预警",
                "description": "汇率达到目标值时通知",
            },
        ],
    }


@router.get("/rates", response_model=RatesResponse)
async def get_rates(
    force: bool = Query(False, description="是否强制刷新数据"),
) -> dict[str, Any]:
    """获取当前汇率

    轻量接口，仅返回汇率数据和调度器状态
    SSE 推送 rates_updated 事件后，前端调用此接口获取最新数据
    """
    if force:
        rates, fetched = await service.fetch_and_save_rates(skip_delay=True)
        if fetched:
            await service.process_alerts_for_rates(rates)
    else:
        rates = service.get_cached_rates()

    scheduler_obj = fetcher_module.scheduler
    scheduler = scheduler_obj.get_status() if scheduler_obj else {
        "enabled": False,
        "running": False,
        "interval": int(SCHEDULER_CONFIG["interval"]),
        "next_refresh_time": None,
        "consecutive_failures": 0,
    }

    return {
        "rates": rates,
        "scheduler": scheduler,
    }


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    currency_pair: str = Query("JPY_CNY", description="货币对"),
    days: int = Query(7, ge=1, le=90, description="天数"),
) -> dict[str, Any]:
    """获取汇率历史和统计

    按货币对和天数返回历史数据，前端可缓存结果
    """
    history = service.get_rate_history(currency_pair, days)
    stats = service.get_rate_stats(currency_pair, days, history=history)

    return {
        "currency_pair": currency_pair,
        "days": days,
        "history": history,
        "stats": stats,
    }


@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    currency_pair: str = Query("JPY_CNY", description="货币对"),
    days: int = Query(7, ge=1, le=90, description="天数"),
) -> dict[str, Any]:
    """获取汇总数据

    首次加载页面时使用，一次性返回所有需要的数据
    后续更新通过 SSE + 按需请求实现
    """
    rates = service.get_cached_rates()
    scheduler_obj = fetcher_module.scheduler
    scheduler = scheduler_obj.get_status() if scheduler_obj else {
        "enabled": False,
        "running": False,
        "interval": int(SCHEDULER_CONFIG["interval"]),
        "next_refresh_time": None,
        "consecutive_failures": 0,
    }
    history = service.get_rate_history(currency_pair, days)
    stats = service.get_rate_stats(currency_pair, days, history=history)
    profit = service.get_profit_summary(currency_pair)
    trades, _ = service.get_trades(currency_pair, limit=100)

    return {
        "rates": rates,
        "scheduler": scheduler,
        "history": history,
        "stats": stats,
        "profit": profit,
        "trades": trades,
    }


@router.post("/trades", response_model=TradeRecord)
@limiter.limit(RATE_LIMITS.get("trade", DEFAULT_LIMIT))
async def create_trade(
    request: Request,
    response: Response,
    data: TradeCreate,
) -> dict[str, Any]:
    """创建交易记录"""
    trade = service.create_trade(data)
    return trade


@router.get("/trades", response_model=TradeListResponse)
async def get_trades(
    currency_pair: str = Query("JPY_CNY", description="货币对"),
    type: Optional[str] = Query(None, description="类型筛选: buy/sell"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """获取交易列表"""
    trades, total = service.get_trades(currency_pair, type, limit, offset)
    return {
        "items": trades,
        "total": total,
    }


@router.get("/trades/{trade_id}", response_model=TradeRecord)
async def get_trade(
    trade_id: int,
) -> dict[str, Any]:
    """获取单条交易记录"""
    trade = service.get_trade(trade_id)
    if not trade:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="交易记录不存在")

    return trade


@router.put("/trades/{trade_id}", response_model=OkResponse)
@limiter.limit(RATE_LIMITS.get("trade", DEFAULT_LIMIT))
async def update_trade(
    request: Request,
    response: Response,
    trade_id: int,
    data: TradeUpdate,
) -> dict[str, bool]:

    """更新交易记录"""
    success = service.update_trade(trade_id, data)
    if not success:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="交易记录不存在或无更新")

    return {"ok": True}


@router.delete("/trades/{trade_id}", response_model=OkResponse)
@limiter.limit(RATE_LIMITS.get("trade", DEFAULT_LIMIT))
async def delete_trade(
    request: Request,
    response: Response,
    trade_id: int,
) -> dict[str, bool]:
    """删除交易记录"""
    success = service.delete_trade(trade_id)
    if not success:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="交易记录不存在")

    return {"ok": True}


@router.post("/alerts", response_model=AlertRule)
@limiter.limit(RATE_LIMITS.get("alert", DEFAULT_LIMIT))
async def create_alert(
    request: Request,
    response: Response,
    data: AlertCreate,
) -> dict[str, Any]:
    """创建预警规则"""
    alert = service.create_alert_rule(data)
    return alert


@router.get("/alerts", response_model=AlertListResponse)
async def get_alerts(
    currency_pair: Optional[str] = Query(None, description="货币对筛选"),
) -> dict[str, Any]:
    """获取预警规则列表"""
    alerts = service.get_alert_rules(currency_pair)
    return {
        "items": alerts,
        "total": len(alerts),
    }


@router.get("/alerts/{alert_id}", response_model=AlertRule)
async def get_alert(
    alert_id: int,
) -> dict[str, Any]:
    """获取单条预警规则"""
    alert = service.get_alert_rule(alert_id)
    if not alert:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="预警规则不存在")

    return alert


@router.put("/alerts/{alert_id}", response_model=OkResponse)
@limiter.limit(RATE_LIMITS.get("alert", DEFAULT_LIMIT))
async def update_alert(
    request: Request,
    response: Response,
    alert_id: int,
    data: AlertUpdate,
) -> dict[str, bool]:
    """更新预警规则"""
    success = service.update_alert_rule(alert_id, data)
    if not success:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="预警规则不存在或无更新")

    return {"ok": True}


@router.delete("/alerts/{alert_id}", response_model=OkResponse)
@limiter.limit(RATE_LIMITS.get("alert", DEFAULT_LIMIT))
async def delete_alert(
    request: Request,
    response: Response,
    alert_id: int,
) -> dict[str, bool]:
    """删除预警规则"""
    success = service.delete_alert_rule(alert_id)
    if not success:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="预警规则不存在")

    return {"ok": True}


@router.get("/export/trades")
async def export_trades_csv(
    currency_pair: str = Query("JPY_CNY", description="货币对"),
    type: Optional[str] = Query(None, description="类型筛选: buy/sell"),
) -> StreamingResponse:
    """导出交易记录为 CSV"""
    trades, _ = service.get_trades(currency_pair, type, limit=1000)

    if not trades:
        raise HTTPException(status_code=HTTP.HTTP_404_NOT_FOUND, detail="暂无数据可导出")

    # 创建 CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # 写入表头
    writer.writerow([
        'ID', 'Type', 'Currency Pair', 'Amount', 'Rate',
        'Cost (CNY)', 'Current Value', 'P/L', 'Timestamp', 'Note'
    ])

    # 写入数据
    for trade in trades:
        writer.writerow([
            trade.id,
            trade.type,
            trade.currency_pair,
            trade.amount,
            trade.rate,
            round(trade.cost_cny, 2),
            round(trade.current_value, 2),
            round(trade.profit_loss, 2),
            trade.timestamp.strftime('%Y-%m-%d %H:%M:%S') if trade.timestamp else '',
            trade.note or '',
        ])

    output.seek(0)

    filename = f"trades_{currency_pair}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8-sig",
        }
    )
