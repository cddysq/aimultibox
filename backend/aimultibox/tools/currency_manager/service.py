# -*- coding: utf-8 -*-
"""汇率管家业务服务层"""

import logging
from datetime import datetime, timezone
from datetime import date as date_cls
from typing import List, Optional, Tuple

from .fetcher import fetcher
from aimultibox.core import clear_cache
from .repo import (
    save_rate, get_rate_history, get_latest_rate, get_rate_stats, get_rate_24h_ago,
    get_daily_closing_rates, CACHE_NAME,
    create_transaction, get_transaction, update_transaction, delete_transaction,
    create_alert, get_alerts, get_alert, update_alert, delete_alert, update_alert_triggered,
    create_alert_event, get_alert_events, get_alert_event_latest_id,
)
from .calculator import calculate_profit, get_trades_with_profit
from .schemas import (
    RateData, RateHistory, RateStats,
    TradeCreate, TradeUpdate, TradeRecord,
    AlertCreate, AlertUpdate, AlertRule,
    ProfitSummary,
)

logger = logging.getLogger(__name__)


class CurrencyMonitorService:
    """汇率管家服务"""

    async def fetch_and_save_rates(
        self,
        min_interval_seconds: Optional[int] = None,
        skip_delay: bool = False,
    ) -> tuple[List[RateData], bool]:
        """获取并保存汇率数据"""
        rates, fetched = await fetcher.fetch_rates(
            min_interval_seconds=min_interval_seconds,
            skip_delay=skip_delay,
        )

        if fetched:
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
                    skip_cache_clear=True,
                )
            clear_cache(CACHE_NAME)

        return ([
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
                ], fetched)

    def get_cached_rates(self) -> List[RateData]:
        """返回缓存数据（不触发远程请求）"""
        rates = fetcher.get_cached_rates()
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

    def get_rate_stats(self, currency_pair: str, days: int = 7,
                       history: Optional[List[RateHistory]] = None) -> Optional[RateStats]:
        """获取汇率统计"""
        stats = get_rate_stats(currency_pair, days)
        latest = get_latest_rate(currency_pair)

        if not stats or not latest:
            return None

        first_rate = history[0].rate if history else None
        current = latest["rate"]
        change = ((current - first_rate) / first_rate * 100) if first_rate else 0
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
        daily_rates = get_daily_closing_rates(currency_pair, days=60)

        if len(daily_rates) < 2:
            return 0, 0.0

        streak_count = 0
        streak_end_idx = len(daily_rates) - 1
        streak_start_idx = streak_end_idx

        for i in range(len(daily_rates) - 1, 0, -1):
            today = daily_rates[i]
            yesterday = daily_rates[i - 1]

            try:
                d1 = date_cls.fromisoformat(str(yesterday["date"]))
                d2 = date_cls.fromisoformat(str(today["date"]))
                gap = (d2 - d1).days
            except (ValueError, TypeError):
                break

            if gap < 1 or gap > 4:
                break

            today_rate = today["rate"]
            yesterday_rate = yesterday["rate"]

            if today_rate > yesterday_rate:
                if streak_count >= 0:
                    streak_count += 1
                    streak_start_idx = i - 1
                else:
                    break
            elif today_rate < yesterday_rate:
                if streak_count <= 0:
                    streak_count -= 1
                    streak_start_idx = i - 1
                else:
                    break  # 趋势方向改变
            else:  # 持平，继续往前看
                continue

        if streak_count == 0:
            return 0, 0.0

        streak_days = streak_count + (1 if streak_count > 0 else -1)
        streak_start_rate = daily_rates[streak_start_idx]["rate"]
        streak_end_rate = daily_rates[streak_end_idx]["rate"]

        if streak_start_rate == 0:
            return streak_days, 0.0

        streak_change = (streak_end_rate - streak_start_rate) / streak_start_rate * 100
        return streak_days, streak_change

    def get_supported_currencies(self) -> List[dict]:
        """获取支持的货币列表"""
        return fetcher.get_supported_currencies()

    def create_trade(self, data: TradeCreate) -> TradeRecord:
        """创建交易记录"""
        timestamp = data.timestamp if isinstance(data.timestamp, datetime) else datetime.now(timezone.utc)

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

    def get_profit_summary(self, currency_pair: str) -> Optional[ProfitSummary]:
        """获取盈亏汇总"""
        return calculate_profit(currency_pair)

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
            created_at=datetime.now(timezone.utc),
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
                notify_email=a.get("notify_email"),
                enabled=bool(a.get("enabled", True)),
                created_at=a.get("created_at"),
                last_triggered=a.get("last_triggered"),
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
                notify_email=alert.get("notify_email"),
                enabled=bool(alert.get("enabled", True)),
                created_at=alert.get("created_at"),
                last_triggered=alert.get("last_triggered"),
            )
        return None

    def update_alert_rule(self, alert_id: int, data: AlertUpdate) -> bool:
        """更新预警规则"""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return False
        return update_alert(alert_id, **update_data)

    def delete_alert_rule(self, alert_id: int) -> bool:
        """删除预警规则"""
        return delete_alert(alert_id)

    def get_alert_events(self, since_id: Optional[int] = None) -> List[dict]:
        """获取最近触发的预警事件（自动从上下文获取用户范围）"""
        events = get_alert_events(since_id)
        return [
            {**e, "event_id": e.get("id")} if "event_id" not in e else e
            for e in events
        ]

    def get_alert_event_latest_id(self) -> int:
        """获取当前预警事件序号（自动从上下文获取用户范围）"""
        return get_alert_event_latest_id()

    async def process_alerts_for_rates(self, rates: List[RateData]) -> List[dict]:
        """检查并记录预警触发事件"""
        from aimultibox.core.sse import sse_manager

        triggered: List[dict] = []
        for rate in rates:
            alerts = get_alerts(rate.currency_pair, enabled_only=True, include_all=True)
            for alert in alerts:
                condition = alert["condition"]
                threshold = alert["threshold"]
                should_trigger = False

                if condition == "rate_above" and rate.rate > threshold:
                    should_trigger = True
                elif condition == "rate_below" and rate.rate < threshold:
                    should_trigger = True
                elif condition == "daily_change_above":
                    rate_24h_ago_data = get_rate_24h_ago(rate.currency_pair)
                    if rate_24h_ago_data:
                        old_rate = rate_24h_ago_data["rate"]
                        daily_change = abs((rate.rate - old_rate) / old_rate * 100)
                        if daily_change > threshold:
                            should_trigger = True

                owner_client_id = alert.get("client_id")
                owner_user_id = alert.get("user_id")
                if should_trigger and (owner_client_id or owner_user_id):
                    triggered_at = datetime.now(timezone.utc)
                    update_alert_triggered(alert["id"], triggered_at, include_all=True)
                    event_id = create_alert_event(
                        alert_id=alert["id"],
                        currency_pair=rate.currency_pair,
                        condition=condition,
                        threshold=threshold,
                        current_rate=rate.rate,
                        notify_email=alert.get("notify_email"),
                        triggered_at=triggered_at,
                        user_id=owner_user_id,
                        client_id=owner_client_id,
                    )

                    event_data = {
                        "event_id": event_id,
                        "alert_id": alert["id"],
                        "condition": condition,
                        "threshold": threshold,
                        "current_rate": rate.rate,
                        "currency_pair": rate.currency_pair,
                        "triggered_at": triggered_at.isoformat(),
                    }
                    triggered.append(event_data)

                    # SSE 定向推送给预警所有者
                    if owner_user_id:
                        await sse_manager.send_to_user(owner_user_id, "alert_triggered", event_data)
                    elif owner_client_id:
                        await sse_manager.send_to_client(owner_client_id, "alert_triggered", event_data)

                    logger.info(f"预警触发: {condition} {threshold}, 当前: {rate.rate}")

        return triggered


# 单例
service = CurrencyMonitorService()
