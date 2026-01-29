# -*- coding: utf-8 -*-
"""汇率管家 - 数据模型"""

from datetime import datetime
from typing import Optional, List, Literal, Any, Dict
from pydantic import BaseModel, Field, ConfigDict



class RateData(BaseModel):
    """
    单条汇率数据

    四种汇率说明:
    - rtb_bid: 现汇买入价（银行买入你的现汇）
    - rth_bid: 现钞买入价（银行买入你的现钞）
    - rtc_ofr: 现汇卖出价（银行卖给你现汇）
    - rth_ofr: 现钞卖出价（银行卖给你现钞）
    """
    currency_pair: str
    rate: float
    rtb_bid: float
    rth_bid: float
    rtc_ofr: float
    rth_ofr: float
    timestamp: datetime  # UTC，自动序列化为 ISO 8601
    time_str: Optional[str] = None


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


class RateStats(BaseModel):
    """汇率统计"""
    currency_pair: str
    current: float
    high: float
    low: float
    average: float
    change: float  # 涨跌幅%
    updated_at: datetime
    streak_days: int = 0  # 正=连涨，负=连跌
    streak_change: float = 0


class TradeCreate(BaseModel):
    """创建交易记录"""
    type: Literal["buy", "sell"]
    currency_pair: str = "JPY_CNY"
    amount: float = Field(gt=0)
    rate: float = Field(gt=0)
    timestamp: Optional[datetime] = None
    note: Optional[str] = Field(default=None, max_length=500)


class TradeUpdate(BaseModel):
    """更新交易记录"""
    type: Optional[Literal["buy", "sell"]] = None
    amount: Optional[float] = Field(default=None, gt=0)
    rate: Optional[float] = Field(default=None, gt=0)
    timestamp: Optional[datetime] = None
    note: Optional[str] = Field(default=None, max_length=500)


class TradeRecord(BaseModel):
    """交易记录"""
    id: int
    type: Literal["buy", "sell"]
    currency_pair: str
    amount: float
    rate: float
    timestamp: datetime
    note: Optional[str] = None
    cost_cny: float = 0
    current_value: float = 0
    profit_loss: float = 0


class TradeListData(BaseModel):
    """交易列表数据"""
    items: List[TradeRecord] = []
    total: int = 0


class TradeListResponse(BaseModel):
    """交易列表响应"""
    items: List[TradeRecord] = []
    total: int = 0


class ProfitSummary(BaseModel):
    """盈亏汇总"""
    currency_pair: str
    total_cost: float
    current_value: float
    profit_loss: float
    return_rate: float
    holding_amount: float
    avg_cost_rate: float
    current_rate: float


class AlertCreate(BaseModel):
    """创建预警规则"""
    currency_pair: str = "JPY_CNY"
    condition: Literal["rate_above", "rate_below", "daily_change_above"]
    threshold: float
    notify_email: Optional[str] = None
    enabled: bool = True


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


class AlertListData(BaseModel):
    """预警列表数据"""
    items: List[AlertRule] = []
    total: int = 0


class AlertListResponse(BaseModel):
    """预警列表响应"""
    items: List[AlertRule] = []
    total: int = 0


class SchedulerStatus(BaseModel):
    """调度器状态"""
    enabled: bool
    running: bool
    interval: int
    next_refresh_time: Optional[datetime] = None
    consecutive_failures: int


class RatesResponse(BaseModel):
    """当前汇率响应"""
    rates: List[RateData]
    scheduler: SchedulerStatus


class HistoryResponse(BaseModel):
    """汇率历史响应"""
    currency_pair: str
    days: int
    history: List[RateHistory]
    stats: Optional[RateStats] = None


class SummaryResponse(BaseModel):
    """汇率汇总响应"""
    rates: List[RateData]
    scheduler: SchedulerStatus
    history: List[RateHistory]
    stats: Optional[RateStats] = None
    profit: Optional[ProfitSummary] = None
    trades: List[TradeRecord] = []


class ToolFeature(BaseModel):
    id: str
    name: str
    description: str


class ToolInfoResponse(BaseModel):
    """工具信息响应"""
    model_config = ConfigDict(extra="allow")
    supported_currencies: List[Dict[str, Any]] = []
    features: List[ToolFeature] = []
