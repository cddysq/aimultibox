# -*- coding: utf-8 -*-
"""汇率管家 - 业务服务"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

from .fetcher import fetcher, CURRENCY_NAMES
from .database import (
    save_rate, get_rate_history, get_latest_rate, get_rate_stats, get_rate_24h_ago,
    get_daily_closing_rates,
    create_transaction, get_transactions, get_transaction, update_transaction, delete_transaction,
    create_alert, get_alerts, get_alert, update_alert, delete_alert, update_alert_triggered,
)
from .calculator import calculate_profit, get_trades_with_profit
from .schemas import (
    RateData, RateHistory, RateStats,
    TradeCreate, TradeUpdate, TradeRecord,
    AlertCreate, AlertUpdate, AlertRule,
    ProfitSummary,
)


class CurrencyMonitorService:
    """汇率管家服务"""
    
    # ========== 汇率相关 ==========
    
    async def fetch_and_save_rates(self, force: bool = False) -> List[RateData]:
        """获取并保存汇率数据"""
        rates = await fetcher.fetch_rates(force=force)
        
        for rate in rates:
            save_rate(
                currency_pair=rate["currency_pair"],
                rate=rate["rate"],
                rtb_bid=rate["rtb_bid"],
                rth_bid=rate["rth_bid"],
                rtc_ofr=rate["rtc_ofr"],
                rth_ofr=rate["rth_ofr"],
                timestamp=rate["timestamp"],
                time_str=rate.get("time_str", ""),
                source=rate.get("source", "CMB"),
            )
        
        return [
            RateData(
                currency_pair=r["currency_pair"],
                rate=r["rate"],
                rtb_bid=r["rtb_bid"],
                rth_bid=r["rth_bid"],
                rtc_ofr=r["rtc_ofr"],
                rth_ofr=r["rth_ofr"],
                timestamp=r["timestamp"],
                time_str=r.get("time_str"),
            )
            for r in rates
        ]
    
    async def get_current_rate(self, currency_pair: str) -> Optional[RateData]:
        """获取当前汇率"""
        rate = await fetcher.fetch_rate(currency_pair)
        if rate:
            return RateData(
                currency_pair=rate["currency_pair"],
                rate=rate["rate"],
                rtb_bid=rate["rtb_bid"],
                rth_bid=rate["rth_bid"],
                rtc_ofr=rate["rtc_ofr"],
                rth_ofr=rate["rth_ofr"],
                timestamp=rate["timestamp"],
                time_str=rate.get("time_str"),
            )
        return None
    
    def get_rate_history(self, currency_pair: str, days: int = 7,
                         start_time: Optional[datetime] = None,
                         end_time: Optional[datetime] = None) -> List[RateHistory]:
        """获取汇率历史"""
        history = get_rate_history(currency_pair, days, start_time, end_time)
        return [
            RateHistory(
                id=h["id"],
                currency_pair=h["currency_pair"],
                rate=h["rate"],
                rtb_bid=h.get("rtb_bid", 0),
                rth_bid=h.get("rth_bid", 0),
                rtc_ofr=h.get("rtc_ofr", 0),
                rth_ofr=h.get("rth_ofr", 0),
                timestamp=h["timestamp"],
                time_str=h.get("time_str"),
            )
            for h in history
        ]
    
    def get_rate_stats(self, currency_pair: str, days: int = 7) -> Optional[RateStats]:
        """获取汇率统计"""
        stats = get_rate_stats(currency_pair, days)
        latest = get_latest_rate(currency_pair)
        
        if not stats or not latest:
            return None
        
        # 计算涨跌幅
        first_rate = None
        history = get_rate_history(currency_pair, days)
        if history:
            first_rate = history[0]["rate"]
        
        current = latest["rate"]
        change = ((current - first_rate) / first_rate * 100) if first_rate else 0
        
        # 计算连涨/连跌
        streak_days, streak_change = self._calculate_streak(currency_pair)
        
        return RateStats(
            currency_pair=currency_pair,
            current=current,
            high=stats["high"],
            low=stats["low"],
            average=stats["average"],
            change=round(change, 2),
            updated_at=latest["timestamp"],
            streak_days=streak_days,
            streak_change=round(streak_change, 2),
        )
    
    def _calculate_streak(self, currency_pair: str) -> Tuple[int, float]:
        """计算连涨/连跌天数和累计涨跌幅"""
        # 获取最近 30 天每日收盘价
        daily_rates = get_daily_closing_rates(currency_pair, days=30)
        
        if len(daily_rates) < 2:
            return 0, 0.0
        
        # 从最新一天往前数
        streak_days = 0
        streak_start_rate = daily_rates[-1]["rate"]
        
        for i in range(len(daily_rates) - 1, 0, -1):
            today_rate = daily_rates[i]["rate"]
            yesterday_rate = daily_rates[i - 1]["rate"]
            
            if today_rate > yesterday_rate:  # 上涨
                if streak_days >= 0:
                    streak_days += 1
                else:
                    break  # 趋势方向改变
            elif today_rate < yesterday_rate:  # 下跌
                if streak_days <= 0:
                    streak_days -= 1
                else:
                    break  # 趋势方向改变
            else:  # 持平，不计入连续
                break
        
        # 计算累计涨跌幅
        if streak_days != 0:
            streak_start_idx = len(daily_rates) - 1 - abs(streak_days)
            if streak_start_idx >= 0:
                streak_start_rate = daily_rates[streak_start_idx]["rate"]
                current_rate = daily_rates[-1]["rate"]
                streak_change = (current_rate - streak_start_rate) / streak_start_rate * 100
                return streak_days, streak_change
        
        return 0, 0.0
    
    def get_supported_currencies(self) -> List[dict]:
        """获取支持的货币列表"""
        return fetcher.get_supported_currencies()
    
    def get_last_update_time(self) -> Optional[datetime]:
        """获取 API 返回的最后更新时间"""
        return fetcher.get_last_update_time()
    
    # ========== 交易相关 ==========
    
    def create_trade(self, data: TradeCreate) -> TradeRecord:
        """创建交易记录"""
        timestamp = data.timestamp or datetime.now()
        
        trade_id = create_transaction(
            type=data.type,
            currency_pair=data.currency_pair,
            amount=data.amount,
            rate=data.rate,
            timestamp=timestamp,
            note=data.note,
        )
        
        return TradeRecord(
            id=trade_id,
            type=data.type,
            currency_pair=data.currency_pair,
            amount=data.amount,
            rate=data.rate,
            timestamp=timestamp,
            note=data.note,
            cost_cny=data.amount * data.rate,
        )
    
    def get_trades(self, currency_pair: str, type_filter: Optional[str] = None,
                   limit: int = 100, offset: int = 0) -> Tuple[List[TradeRecord], int]:
        """获取交易列表（带盈亏）"""
        return get_trades_with_profit(currency_pair, None, type_filter, limit, offset)
    
    def get_trade(self, trade_id: int) -> Optional[TradeRecord]:
        """获取单条交易记录"""
        trade = get_transaction(trade_id)
        if trade:
            return TradeRecord(
                id=trade["id"],
                type=trade["type"],
                currency_pair=trade["currency_pair"],
                amount=trade["amount"],
                rate=trade["rate"],
                timestamp=trade["timestamp"],
                note=trade.get("note"),
                cost_cny=trade["amount"] * trade["rate"],
            )
        return None
    
    def update_trade(self, trade_id: int, data: TradeUpdate) -> bool:
        """更新交易记录"""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return False
        return update_transaction(trade_id, **update_data)
    
    def delete_trade(self, trade_id: int) -> bool:
        """删除交易记录"""
        return delete_transaction(trade_id)
    
    # ========== 盈亏相关 ==========
    
    def get_profit_summary(self, currency_pair: str) -> Optional[ProfitSummary]:
        """获取盈亏汇总"""
        return calculate_profit(currency_pair)
    
    # ========== 预警相关 ==========
    
    def create_alert_rule(self, data: AlertCreate) -> AlertRule:
        """创建预警规则"""
        alert_id = create_alert(
            currency_pair=data.currency_pair,
            condition=data.condition,
            threshold=data.threshold,
            notify_email=data.notify_email,
            enabled=data.enabled,
        )
        
        return AlertRule(
            id=alert_id,
            currency_pair=data.currency_pair,
            condition=data.condition,
            threshold=data.threshold,
            notify_email=data.notify_email,
            enabled=data.enabled,
            created_at=datetime.now(),
        )
    
    def get_alert_rules(self, currency_pair: Optional[str] = None) -> List[AlertRule]:
        """获取预警规则列表"""
        alerts = get_alerts(currency_pair)
        return [
            AlertRule(
                id=a["id"],
                currency_pair=a["currency_pair"],
                condition=a["condition"],
                threshold=a["threshold"],
                notify_email=a["notify_email"],
                enabled=bool(a["enabled"]),
                created_at=a["created_at"],
                last_triggered=a["last_triggered"],
            )
            for a in alerts
        ]
    
    def get_alert_rule(self, alert_id: int) -> Optional[AlertRule]:
        """获取单条预警规则"""
        alert = get_alert(alert_id)
        if alert:
            return AlertRule(
                id=alert["id"],
                currency_pair=alert["currency_pair"],
                condition=alert["condition"],
                threshold=alert["threshold"],
                notify_email=alert["notify_email"],
                enabled=bool(alert["enabled"]),
                created_at=alert["created_at"],
                last_triggered=alert["last_triggered"],
            )
        return None
    
    def update_alert_rule(self, alert_id: int, data: AlertUpdate) -> bool:
        """更新预警规则"""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return False
        
        # 转换 enabled 为整数
        if "enabled" in update_data:
            update_data["enabled"] = 1 if update_data["enabled"] else 0
        
        return update_alert(alert_id, **update_data)
    
    def delete_alert_rule(self, alert_id: int) -> bool:
        """删除预警规则"""
        return delete_alert(alert_id)
    
    async def check_alerts(self, currency_pair: str, current_rate: float) -> List[dict]:
        """检查预警触发"""
        alerts = get_alerts(currency_pair, enabled_only=True)
        triggered = []
        
        for alert in alerts:
            condition = alert["condition"]
            threshold = alert["threshold"]
            should_trigger = False
            
            if condition == "rate_above" and current_rate > threshold:
                should_trigger = True
            elif condition == "rate_below" and current_rate < threshold:
                should_trigger = True
            elif condition == "daily_change_above":
                # 计算日涨跌幅
                rate_24h_ago = get_rate_24h_ago(currency_pair)
                if rate_24h_ago:
                    old_rate = rate_24h_ago["rate"]
                    daily_change = abs((current_rate - old_rate) / old_rate * 100)
                    if daily_change > threshold:
                        should_trigger = True
            
            if should_trigger:
                update_alert_triggered(alert["id"])
                triggered.append({
                    "alert_id": alert["id"],
                    "condition": condition,
                    "threshold": threshold,
                    "current_rate": current_rate,
                    "currency_pair": currency_pair,
                    "notify_email": alert.get("notify_email"),
                })
                logger.info(f"Alert triggered: {condition} {threshold}, current: {current_rate}")
        
        return triggered


# 单例
service = CurrencyMonitorService()
