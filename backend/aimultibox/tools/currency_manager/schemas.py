# -*- coding: utf-8 -*-
"""汇率管家 - 数据模型"""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

from aimultibox.models import BaseResponse


# ========== 汇率相关 ==========

class RateData(BaseModel):
    """
    单条汇率数据
    
    四种汇率说明:
    - rtb_bid: 现汇买入价（银行买入你的现汇，如境外汇款结汇）
    - rth_bid: 现钞买入价（银行买入你的现钞，如外币现金换人民币）
    - rtc_ofr: 现汇卖出价（银行卖给你现汇，如境外汇款/留学缴费）
    - rth_ofr: 现钞卖出价（银行卖给你现钞，如取外币现金出国）
    """
    currency_pair: str = Field(..., description="货币对，如 JPY_CNY")
    rate: float = Field(..., description="中间价")
    rtb_bid: float = Field(..., description="现汇买入价")
    rth_bid: float = Field(..., description="现钞买入价")
    rtc_ofr: float = Field(..., description="现汇卖出价")
    rth_ofr: float = Field(..., description="现钞卖出价")
    timestamp: datetime = Field(..., description="时间戳")
    time_str: Optional[str] = Field(default=None, description="原始时间字符串")


class RateHistory(BaseModel):
    """汇率历史记录"""
    id: int
    currency_pair: str
    rate: float
    rtb_bid: float
    rth_bid: float
    rtc_ofr: float
    rth_ofr: float
    timestamp: datetime
    time_str: Optional[str] = None


class RateResponse(BaseResponse):
    """汇率响应"""
    data: Optional[List[RateData]] = None
    source: str = "CMB"
    update_time: Optional[datetime] = Field(default=None, description="API 返回的更新时间")


class RateHistoryResponse(BaseResponse):
    """汇率历史响应"""
    data: List[RateHistory] = []
    total: int = 0


class RateStats(BaseModel):
    """汇率统计"""
    currency_pair: str
    current: float
    high: float
    low: float
    average: float
    change: float  # 涨跌幅%
    updated_at: datetime
    streak_days: int = Field(default=0, description="连涨/连跌天数（正=涨，负=跌）")
    streak_change: float = Field(default=0, description="连续期间累计涨跌幅%")


# ========== 交易相关 ==========

class TradeCreate(BaseModel):
    """创建交易记录"""
    type: Literal["buy", "sell"] = Field(..., description="交易类型")
    currency_pair: str = Field(default="JPY_CNY", description="货币对")
    amount: float = Field(..., gt=0, description="交易金额（外币）")
    rate: float = Field(..., gt=0, description="交易汇率")
    timestamp: Optional[datetime] = Field(default=None, description="交易时间")
    note: Optional[str] = Field(default=None, max_length=500, description="备注")


class TradeUpdate(BaseModel):
    """更新交易记录"""
    type: Optional[Literal["buy", "sell"]] = None
    amount: Optional[float] = Field(default=None, gt=0)
    rate: Optional[float] = Field(default=None, gt=0)
    timestamp: Optional[datetime] = None
    note: Optional[str] = Field(default=None, max_length=500)


class TradeRecord(BaseModel):
    """
    交易记录
    
    计算字段:
    - cost_cny = amount × rate
    - current_value = amount × 当前汇率
    - profit_loss = current_value - cost_cny（仅买入计算，卖出为0）
    """
    id: int
    type: Literal["buy", "sell"]
    currency_pair: str
    amount: float
    rate: float
    timestamp: datetime
    note: Optional[str] = None
    # 计算字段
    cost_cny: float = Field(default=0, description="成本（人民币）")
    current_value: float = Field(default=0, description="当前价值")
    profit_loss: float = Field(default=0, description="盈亏")


class TradeListResponse(BaseResponse):
    """交易列表响应"""
    data: List[TradeRecord] = []
    total: int = 0


# ========== 盈亏分析 ==========

class ProfitSummary(BaseModel):
    """
    盈亏汇总
    
    计算公式:
    - 总成本 = 买入总花费
    - 当前价值 = 持仓市值 + 已卖出收入
    - 盈亏 = 当前价值 - 总成本
    - 收益率 = 盈亏 / 总成本 × 100%
    """
    currency_pair: str
    total_cost: float = Field(..., description="总成本（人民币）")
    current_value: float = Field(..., description="当前价值（人民币）")
    profit_loss: float = Field(..., description="盈亏")
    return_rate: float = Field(..., description="收益率%")
    holding_amount: float = Field(..., description="持有数量（外币）")
    avg_cost_rate: float = Field(..., description="平均成本汇率")
    current_rate: float = Field(..., description="当前汇率")


class ProfitResponse(BaseResponse):
    """盈亏响应"""
    summary: Optional[ProfitSummary] = None
    trades: List[TradeRecord] = []


# ========== 预警相关 ==========

class AlertCreate(BaseModel):
    """创建预警规则"""
    currency_pair: str = Field(default="JPY_CNY", description="货币对")
    condition: Literal["rate_above", "rate_below", "daily_change_above"] = Field(..., description="条件类型")
    threshold: float = Field(..., description="阈值")
    notify_email: Optional[str] = Field(default=None, description="通知邮箱")
    enabled: bool = Field(default=True, description="是否启用")


class AlertUpdate(BaseModel):
    """更新预警规则"""
    condition: Optional[Literal["rate_above", "rate_below", "daily_change_above"]] = None
    threshold: Optional[float] = None
    notify_email: Optional[str] = None
    enabled: Optional[bool] = None


class AlertRule(BaseModel):
    """预警规则"""
    id: int
    currency_pair: str
    condition: str
    threshold: float
    notify_email: Optional[str] = None
    enabled: bool
    created_at: datetime
    last_triggered: Optional[datetime] = None


class AlertListResponse(BaseResponse):
    """预警列表响应"""
    data: List[AlertRule] = []
    total: int = 0
