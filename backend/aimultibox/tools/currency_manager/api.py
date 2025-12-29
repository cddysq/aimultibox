# -*- coding: utf-8 -*-
"""汇率管家 - API 路由"""

import csv
import io
from datetime import datetime
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Request, Response, Query
from fastapi.responses import StreamingResponse

from aimultibox.core.ratelimit import limiter, DEFAULT_LIMIT
from . import TOOL_META, RATE_LIMITS, REFRESH_CONFIG
from .service import service
from .schemas import (
    RateResponse, RateHistoryResponse, RateStats,
    TradeCreate, TradeUpdate, TradeListResponse, TradeRecord,
    AlertCreate, AlertUpdate, AlertListResponse, AlertRule,
    ProfitResponse,
)

router = APIRouter()


@router.get("/")
async def tool_info() -> dict[str, Any]:
    """获取工具信息"""
    currencies = service.get_supported_currencies()
    return {
        **TOOL_META,
        "supported_currencies": currencies,
        "refresh_config": REFRESH_CONFIG,
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


# ========== 汇率接口 ==========

@router.get("/rates")
async def get_rates(
    request: Request,
    response: Response,
    force: bool = Query(False, description="强制刷新"),
) -> RateResponse:
    """获取当前汇率"""
    rates = await service.fetch_and_save_rates(force=force)
    return RateResponse(
        status="success",
        message="获取成功",
        data=rates,
        source="CMB",
        update_time=service.get_last_update_time(),
    )


@router.post("/rates/refresh")
@limiter.limit(RATE_LIMITS.get("fetch", DEFAULT_LIMIT))
async def refresh_rates(
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """手动刷新汇率（限流）"""
    rates = await service.fetch_and_save_rates(force=True)
    
    # 检查预警并收集触发的预警
    triggered_alerts = []
    for rate in rates:
        alerts = await service.check_alerts(rate.currency_pair, rate.rate)
        triggered_alerts.extend(alerts)
    
    return {
        "status": "success",
        "message": "刷新成功",
        "data": [r.model_dump() for r in rates],
        "source": "CMB",
        "update_time": service.get_last_update_time().isoformat() if service.get_last_update_time() else None,
        "triggered_alerts": triggered_alerts,
    }


@router.get("/rates/{currency_pair}")
async def get_rate(
    currency_pair: str,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """获取单个货币对的当前汇率"""
    rate = await service.get_current_rate(currency_pair)
    if not rate:
        raise HTTPException(status_code=404, detail="货币对不存在")
    
    return {
        "status": "success",
        "data": rate,
    }


@router.get("/rates/{currency_pair}/history")
async def get_rate_history(
    currency_pair: str,
    days: int = Query(7, ge=1, le=90, description="天数"),
    request: Request = None,
    response: Response = None,
) -> RateHistoryResponse:
    """获取汇率历史"""
    history = service.get_rate_history(currency_pair, days)
    return RateHistoryResponse(
        status="success",
        message="获取成功",
        data=history,
        total=len(history),
    )


@router.get("/rates/{currency_pair}/stats")
async def get_rate_stats(
    currency_pair: str,
    days: int = Query(7, ge=1, le=90, description="统计天数"),
    request: Request = None,
    response: Response = None,
) -> dict[str, Any]:
    """获取汇率统计"""
    stats = service.get_rate_stats(currency_pair, days)
    if not stats:
        raise HTTPException(status_code=404, detail="暂无数据")
    
    return {
        "status": "success",
        "data": stats,
    }


# ========== 交易接口 ==========

@router.post("/trades")
@limiter.limit(RATE_LIMITS.get("trade", DEFAULT_LIMIT))
async def create_trade(
    data: TradeCreate,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """创建交易记录"""
    trade = service.create_trade(data)
    return {
        "status": "success",
        "message": "创建成功",
        "data": trade,
    }


@router.get("/trades")
async def get_trades(
    currency_pair: str = Query("JPY_CNY", description="货币对"),
    type: Optional[str] = Query(None, description="类型筛选: buy/sell"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    request: Request = None,
    response: Response = None,
) -> TradeListResponse:
    """获取交易列表"""
    trades, total = service.get_trades(currency_pair, type, limit, offset)
    return TradeListResponse(
        status="success",
        message="获取成功",
        data=trades,
        total=total,
    )


@router.get("/trades/{trade_id}")
async def get_trade(
    trade_id: int,
    request: Request = None,
    response: Response = None,
) -> dict[str, Any]:
    """获取单条交易记录"""
    trade = service.get_trade(trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="交易记录不存在")
    
    return {
        "status": "success",
        "data": trade,
    }


@router.put("/trades/{trade_id}")
@limiter.limit(RATE_LIMITS.get("trade", DEFAULT_LIMIT))
async def update_trade(
    trade_id: int,
    data: TradeUpdate,
    request: Request,
    response: Response,
) -> dict[str, str]:
    """更新交易记录"""
    success = service.update_trade(trade_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="交易记录不存在或无更新")
    
    return {
        "status": "success",
        "message": "更新成功",
    }


@router.delete("/trades/{trade_id}")
@limiter.limit(RATE_LIMITS.get("trade", DEFAULT_LIMIT))
async def delete_trade(
    trade_id: int,
    request: Request,
    response: Response,
) -> dict[str, str]:
    """删除交易记录"""
    success = service.delete_trade(trade_id)
    if not success:
        raise HTTPException(status_code=404, detail="交易记录不存在")
    
    return {
        "status": "success",
        "message": "删除成功",
    }


# ========== 盈亏接口 ==========

@router.get("/profit/{currency_pair}")
async def get_profit(
    currency_pair: str,
    request: Request = None,
    response: Response = None,
) -> ProfitResponse:
    """获取盈亏汇总"""
    summary = service.get_profit_summary(currency_pair)
    trades, _ = service.get_trades(currency_pair, limit=50)
    
    return ProfitResponse(
        status="success",
        message="获取成功",
        summary=summary,
        trades=trades,
    )


# ========== 预警接口 ==========

@router.post("/alerts")
@limiter.limit(RATE_LIMITS.get("alert", DEFAULT_LIMIT))
async def create_alert(
    data: AlertCreate,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """创建预警规则"""
    alert = service.create_alert_rule(data)
    return {
        "status": "success",
        "message": "创建成功",
        "data": alert,
    }


@router.get("/alerts")
async def get_alerts(
    currency_pair: Optional[str] = Query(None, description="货币对筛选"),
    request: Request = None,
    response: Response = None,
) -> AlertListResponse:
    """获取预警规则列表"""
    alerts = service.get_alert_rules(currency_pair)
    return AlertListResponse(
        status="success",
        message="获取成功",
        data=alerts,
        total=len(alerts),
    )


@router.get("/alerts/{alert_id}")
async def get_alert(
    alert_id: int,
    request: Request = None,
    response: Response = None,
) -> dict[str, Any]:
    """获取单条预警规则"""
    alert = service.get_alert_rule(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="预警规则不存在")
    
    return {
        "status": "success",
        "data": alert,
    }


@router.put("/alerts/{alert_id}")
@limiter.limit(RATE_LIMITS.get("alert", DEFAULT_LIMIT))
async def update_alert(
    alert_id: int,
    data: AlertUpdate,
    request: Request,
    response: Response,
) -> dict[str, str]:
    """更新预警规则"""
    success = service.update_alert_rule(alert_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="预警规则不存在或无更新")
    
    return {
        "status": "success",
        "message": "更新成功",
    }


@router.delete("/alerts/{alert_id}")
@limiter.limit(RATE_LIMITS.get("alert", DEFAULT_LIMIT))
async def delete_alert(
    alert_id: int,
    request: Request,
    response: Response,
) -> dict[str, str]:
    """删除预警规则"""
    success = service.delete_alert_rule(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="预警规则不存在")
    
    return {
        "status": "success",
        "message": "删除成功",
    }


# ========== 导出接口 ==========

@router.get("/export/trades")
async def export_trades_csv(
    currency_pair: str = Query("JPY_CNY", description="货币对"),
    type: Optional[str] = Query(None, description="类型筛选: buy/sell"),
    request: Request = None,
    response: Response = None,
) -> StreamingResponse:
    """导出交易记录为 CSV"""
    trades, _ = service.get_trades(currency_pair, type, limit=1000)
    
    if not trades:
        raise HTTPException(status_code=404, detail="暂无数据可导出")
    
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
    
    filename = f"trades_{currency_pair}_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8-sig",
        }
    )
