# -*- coding: utf-8 -*-
"""汇率管家 - 盈亏计算"""

import logging
from typing import List, Optional
from datetime import datetime

from .database import get_holding_summary, get_transactions, get_latest_rate
from .schemas import ProfitSummary, TradeRecord

logger = logging.getLogger(__name__)


def calculate_profit(currency_pair: str, current_rate: Optional[float] = None) -> Optional[ProfitSummary]:
    """计算盈亏汇总"""
    # 获取持仓汇总
    summary = get_holding_summary(currency_pair)
    
    holding = summary["holding"]
    total_buy_cost = summary["total_buy_cost"]
    total_sell_value = summary["total_sell_value"]
    
    # 如果没有持仓，返回空
    if holding <= 0 and total_buy_cost == 0:
        return ProfitSummary(
            currency_pair=currency_pair,
            total_cost=0,
            current_value=0,
            profit_loss=0,
            return_rate=0,
            holding_amount=0,
            avg_cost_rate=0,
            current_rate=current_rate or 0,
        )
    
    # 获取当前汇率
    if current_rate is None:
        latest = get_latest_rate(currency_pair)
        current_rate = latest["rate"] if latest else 0
    
    total_cost = total_buy_cost  # 总成本 = 买入总花费
    current_value = holding * current_rate + total_sell_value  # 持仓市值 + 已卖出收入
    profit_loss = current_value - total_cost
    return_rate = (profit_loss / total_cost * 100) if total_cost > 0 else 0
    avg_cost_rate = (total_buy_cost / summary["total_buy"]) if summary["total_buy"] > 0 else 0
    
    result = ProfitSummary(
        currency_pair=currency_pair,
        total_cost=round(total_cost, 2),
        current_value=round(current_value, 2),
        profit_loss=round(profit_loss, 2),
        return_rate=round(return_rate, 2),
        holding_amount=round(holding, 2),
        avg_cost_rate=round(avg_cost_rate, 6),
        current_rate=current_rate,
    )
    logger.debug(f"Calculated profit for {currency_pair}: P/L={profit_loss:.2f}, return={return_rate:.2f}%")
    return result


def calculate_trade_profit(trade: dict, current_rate: float) -> TradeRecord:
    """计算单笔交易的盈亏"""
    trade_type = trade["type"]
    amount = trade["amount"]
    rate = trade["rate"]
    cost_cny = amount * rate
    current_value = amount * current_rate
    
    # 买入: 计算浮动盈亏; 卖出: 已实现，不计算
    profit_loss = (current_value - cost_cny) if trade_type == "buy" else 0
    
    return TradeRecord(
        id=trade["id"],
        type=trade_type,
        currency_pair=trade["currency_pair"],
        amount=amount,
        rate=rate,
        timestamp=trade["timestamp"],
        note=trade.get("note"),
        cost_cny=round(cost_cny, 2),
        current_value=round(current_value, 2),
        profit_loss=round(profit_loss, 2),
    )


def get_trades_with_profit(currency_pair: str, current_rate: Optional[float] = None,
                           type_filter: Optional[str] = None,
                           limit: int = 100, offset: int = 0) -> tuple:
    """获取带盈亏信息的交易列表"""
    # 获取当前汇率
    if current_rate is None:
        latest = get_latest_rate(currency_pair)
        current_rate = latest["rate"] if latest else 0
    
    # 获取交易记录
    trades, total = get_transactions(currency_pair, type_filter, limit, offset)
    
    # 计算每笔盈亏
    trade_records = [
        calculate_trade_profit(trade, current_rate)
        for trade in trades
    ]
    
    return trade_records, total
