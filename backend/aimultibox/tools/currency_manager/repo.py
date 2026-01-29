# -*- coding: utf-8 -*-
"""汇率管家数据访问层"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import select, func, delete
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from aimultibox.db import session_scope, disable_scope
from aimultibox.core import clear_cache, get_cache
from .models import RateHistory, Transaction, Alert, AlertEvent

logger = logging.getLogger(__name__)

CACHE_NAME = "currency_rates"
CACHE_TTL = 60


def _row_to_dict(row) -> dict:
    """ORM 对象转字典"""
    return {c.key: getattr(row, c.key) for c in row.__table__.columns}


def _cache_key(prefix: str, currency_pair: str, days: int) -> str:
    return f"{prefix}:{currency_pair}:{days}"


def save_rate(currency_pair: str, rate: float,
              rtb_bid: float, rth_bid: float, rtc_ofr: float, rth_ofr: float,
              timestamp: datetime, time_str: str = "", source: str = "CMB",
              skip_cache_clear: bool = False) -> bool:
    """保存汇率数据"""
    ts = timestamp.astimezone(timezone.utc) if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
    rate_date = ts.strftime("%Y-%m-%d")

    if not skip_cache_clear:
        clear_cache(CACHE_NAME)

    with session_scope() as session:
        stmt = sqlite_insert(RateHistory).values(
            currency_pair=currency_pair,
            rate=rate,
            rtb_bid=rtb_bid,
            rth_bid=rth_bid,
            rtc_ofr=rtc_ofr,
            rth_ofr=rth_ofr,
            timestamp=timestamp,
            rate_date=rate_date,
            time_str=time_str,
            source=source,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["currency_pair", "timestamp"],
            set_={
                "rate": stmt.excluded.rate,
                "rtb_bid": stmt.excluded.rtb_bid,
                "rth_bid": stmt.excluded.rth_bid,
                "rtc_ofr": stmt.excluded.rtc_ofr,
                "rth_ofr": stmt.excluded.rth_ofr,
                "rate_date": stmt.excluded.rate_date,
                "time_str": stmt.excluded.time_str,
                "source": stmt.excluded.source,
            },
        )
        session.execute(stmt)
    return True


def get_rate_history(currency_pair: str, days: int = 7,
                     start_time: Optional[datetime] = None,
                     end_time: Optional[datetime] = None,
                     max_points: int = 200) -> List[dict]:
    """获取汇率历史"""
    if not start_time and not end_time:
        cache = get_cache(CACHE_NAME, maxsize=64, ttl=CACHE_TTL)
        key = _cache_key("history", currency_pair, days)
        if key in cache:
            return cache[key]

    actual_days = (end_time - start_time).days if start_time and end_time else days

    if actual_days <= 7:
        result = _get_raw_rate_history(currency_pair, days, start_time, end_time, max_points)
    else:
        result = _get_daily_rate_history(currency_pair, days, start_time, end_time)

    if not start_time and not end_time:
        cache = get_cache(CACHE_NAME, maxsize=64, ttl=CACHE_TTL)
        cache[_cache_key("history", currency_pair, days)] = result

    return result


def _get_raw_rate_history(currency_pair: str, days: int,
                          start_time: Optional[datetime],
                          end_time: Optional[datetime],
                          max_points: int) -> List[dict]:
    """获取原始汇率历史数据"""
    with session_scope() as session:
        if start_time and end_time:
            stmt = (
                select(RateHistory)
                .where(
                    RateHistory.currency_pair == currency_pair,
                    RateHistory.timestamp.between(start_time, end_time),
                )
                .order_by(RateHistory.timestamp.asc())
            )
        else:
            since = datetime.now(timezone.utc) - timedelta(days=days)
            stmt = (
                select(RateHistory)
                .where(
                    RateHistory.currency_pair == currency_pair,
                    RateHistory.timestamp >= since,
                )
                .order_by(RateHistory.timestamp.asc())
            )
        rows = session.execute(stmt).scalars().all()
        data = [_row_to_dict(row) for row in rows]

    if len(data) <= max_points:
        return data

    step = len(data) / max_points
    sampled = []
    for i in range(max_points):
        idx = int(i * step)
        if idx < len(data):
            sampled.append(data[idx])
    if sampled and sampled[-1] != data[-1]:
        sampled.append(data[-1])
    return sampled


def _get_daily_rate_history(currency_pair: str, days: int,
                            start_time: Optional[datetime],
                            end_time: Optional[datetime],
                            tz_offset_hours: int = 0) -> List[dict]:
    """获取每日收盘价汇率历史"""
    since_date = start_time.strftime("%Y-%m-%d") if start_time else \
        (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    sub = (
        select(
            RateHistory.rate_date,
            func.max(RateHistory.id).label("max_id"),
        )
        .where(
            RateHistory.currency_pair == currency_pair,
            RateHistory.rate_date >= since_date,
        )
        .group_by(RateHistory.rate_date)
        .subquery()
    )

    with session_scope() as session:
        stmt = (
            select(RateHistory)
            .join(sub, RateHistory.id == sub.c.max_id)
            .order_by(RateHistory.timestamp.asc())
        )
        rows = session.execute(stmt).scalars().all()
        return [_row_to_dict(row) for row in rows]


def get_latest_rate(currency_pair: str) -> Optional[dict]:
    """获取最新汇率"""
    with session_scope() as session:
        stmt = (
            select(RateHistory)
            .where(RateHistory.currency_pair == currency_pair)
            .order_by(RateHistory.timestamp.desc())
            .limit(1)
        )
        row = session.execute(stmt).scalar_one_or_none()
        if not row:
            return None
        return _row_to_dict(row)


def get_rate_stats(currency_pair: str, days: int = 7) -> Optional[dict]:
    """获取汇率统计"""
    cache = get_cache(CACHE_NAME, maxsize=64, ttl=CACHE_TTL)
    key = _cache_key("stats", currency_pair, days)
    if key in cache:
        return cache[key]

    since = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        stmt = select(
            func.max(RateHistory.rate).label("high"),
            func.min(RateHistory.rate).label("low"),
            func.avg(RateHistory.rate).label("average"),
        ).where(
            RateHistory.currency_pair == currency_pair,
            RateHistory.timestamp >= since,
        )
        row = session.execute(stmt).one_or_none()
        if not row or row.high is None:
            return None
        result = {"high": row.high, "low": row.low, "average": row.average}
        cache[key] = result
        return result


def get_daily_closing_rates(currency_pair: str, days: int = 30) -> List[dict]:
    """获取每日收盘价"""
    cache = get_cache(CACHE_NAME, maxsize=64, ttl=CACHE_TTL)
    key = _cache_key("daily", currency_pair, days)
    if key in cache:
        return cache[key]

    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    sub = (
        select(
            RateHistory.rate_date,
            func.max(RateHistory.id).label("max_id"),
        )
        .where(
            RateHistory.currency_pair == currency_pair,
            RateHistory.rate_date >= since_date,
        )
        .group_by(RateHistory.rate_date)
        .subquery()
    )

    with session_scope() as session:
        stmt = (
            select(sub.c.rate_date, RateHistory.rate)
            .join(RateHistory, RateHistory.id == sub.c.max_id)
            .order_by(sub.c.rate_date.asc())
        )
        rows = session.execute(stmt).all()
        result = [{"date": r.rate_date, "rate": r.rate} for r in rows]
        cache[key] = result
        return result


def create_transaction(type: str, currency_pair: str, amount: float,
                       rate: float, timestamp: datetime, note: Optional[str] = None) -> int:
    """创建交易记录"""
    with session_scope() as session:
        trade = Transaction(
            type=type,
            currency_pair=currency_pair,
            amount=amount,
            rate=rate,
            timestamp=timestamp,
            note=note,
        )
        session.add(trade)
        session.flush()
        trade_id = trade.id
    logger.info(f"Created transaction: id={trade_id}, {type} {amount} {currency_pair} @ {rate}")
    return trade_id


def get_transactions(currency_pair: str, type_filter: Optional[str] = None,
                     limit: int = 100, offset: int = 0) -> Tuple[List[dict], int]:
    """获取交易记录"""
    conditions = [Transaction.currency_pair == currency_pair]
    if type_filter:
        conditions.append(Transaction.type == type_filter)
    with session_scope() as session:
        stmt = select(Transaction).where(*conditions)
        total = session.execute(
            select(func.count()).select_from(stmt.subquery())
        ).scalar_one()

        rows = session.execute(
            stmt.order_by(Transaction.timestamp.desc()).limit(limit).offset(offset)
        ).scalars().all()
        data = [_row_to_dict(row) for row in rows]

    return data, int(total)


def get_transaction(trade_id: int) -> Optional[dict]:
    """获取单条交易记录"""
    with session_scope() as session:
        row = session.get(Transaction, trade_id)
        if not row:
            return None
        return _row_to_dict(row)


def update_transaction(trade_id: int, **kwargs) -> bool:
    """更新交易记录"""
    if not kwargs:
        return False
    with session_scope() as session:
        row = session.get(Transaction, trade_id)
        if not row:
            return False
        for key, value in kwargs.items():
            setattr(row, key, value)
    return True


def delete_transaction(trade_id: int) -> bool:
    """删除交易记录"""
    with session_scope() as session:
        row = session.get(Transaction, trade_id)
        if not row:
            return False
        session.delete(row)
    return True


def get_holding_summary(currency_pair: str) -> dict:
    """获取持仓汇总"""
    with session_scope() as session:
        buy_stmt = select(
            func.coalesce(func.sum(Transaction.amount), 0).label("total_buy"),
            func.coalesce(func.sum(Transaction.amount * Transaction.rate), 0).label("total_buy_cost"),
        ).where(
            Transaction.currency_pair == currency_pair,
            Transaction.type == "buy",
        )
        sell_stmt = select(
            func.coalesce(func.sum(Transaction.amount), 0).label("total_sell"),
            func.coalesce(func.sum(Transaction.amount * Transaction.rate), 0).label("total_sell_value"),
        ).where(
            Transaction.currency_pair == currency_pair,
            Transaction.type == "sell",
        )
        buy_row = session.execute(buy_stmt).one()
        sell_row = session.execute(sell_stmt).one()

        return {
            "total_buy": buy_row.total_buy,
            "total_buy_cost": buy_row.total_buy_cost,
            "total_sell": sell_row.total_sell,
            "total_sell_value": sell_row.total_sell_value,
            "holding": buy_row.total_buy - sell_row.total_sell,
        }


def create_alert(currency_pair: str, condition: str, threshold: float,
                 notify_email: Optional[str] = None, enabled: bool = True) -> int:
    """创建预警规则"""
    with session_scope() as session:
        alert = Alert(
            currency_pair=currency_pair,
            condition=condition,
            threshold=threshold,
            notify_email=notify_email,
            enabled=enabled,
        )
        session.add(alert)
        session.flush()
        return alert.id


def get_alerts(currency_pair: Optional[str] = None, enabled_only: bool = False,
               include_all: bool = False) -> List[dict]:
    """获取预警规则"""

    def _query(sess: Session) -> List[dict]:
        stmt = select(Alert)
        if currency_pair:
            stmt = stmt.where(Alert.currency_pair == currency_pair)
        if enabled_only:
            stmt = stmt.where(Alert.enabled.is_(True))
        stmt = stmt.order_by(Alert.created_at.desc())
        rows = sess.execute(stmt).scalars().all()
        return [_row_to_dict(row) for row in rows]

    if include_all:
        with disable_scope():
            with session_scope() as session:
                return _query(session)
    else:
        with session_scope() as session:
            return _query(session)


def get_alert(alert_id: int) -> Optional[dict]:
    """获取单条预警规则"""
    with session_scope() as session:
        row = session.get(Alert, alert_id)
        if not row:
            return None
        return _row_to_dict(row)


def update_alert(alert_id: int, **kwargs) -> bool:
    """更新预警规则"""
    if not kwargs:
        return False
    with session_scope() as session:
        row = session.get(Alert, alert_id)
        if not row:
            return False
        for key, value in kwargs.items():
            setattr(row, key, value)
    return True


def delete_alert(alert_id: int) -> bool:
    """删除预警规则"""
    with session_scope() as session:
        row = session.get(Alert, alert_id)
        if not row:
            return False
        session.delete(row)
    return True


def update_alert_triggered(alert_id: int, triggered_at: Optional[datetime] = None,
                           include_all: bool = False) -> bool:
    """更新预警触发时间"""
    ts = triggered_at or datetime.now(timezone.utc)

    def _update(session: Session) -> bool:
        row = session.get(Alert, alert_id)
        if not row:
            return False
        row.last_triggered = ts
        return True

    if include_all:
        with disable_scope():
            with session_scope() as session:
                return _update(session)
    with session_scope() as session:
        return _update(session)


def create_alert_event(alert_id: int, currency_pair: str, condition: str,
                       threshold: float, current_rate: float,
                       notify_email: Optional[str], triggered_at: datetime,
                       user_id: Optional[str] = None, client_id: Optional[str] = None) -> int:
    """创建预警事件"""
    with session_scope() as session:
        event = AlertEvent(
            alert_id=alert_id,
            currency_pair=currency_pair,
            condition=condition,
            threshold=threshold,
            current_rate=current_rate,
            notify_email=notify_email,
            triggered_at=triggered_at,
            user_id=user_id,
            client_id=client_id,
        )
        session.add(event)
        session.flush()
        return event.id


def get_alert_events(since_id: Optional[int] = None) -> List[dict]:
    """获取预警事件"""
    with session_scope() as session:
        stmt = select(AlertEvent)
        if since_id is not None:
            stmt = stmt.where(AlertEvent.id > since_id)
        stmt = stmt.order_by(AlertEvent.id.asc())
        rows = session.execute(stmt).scalars().all()
        return [_row_to_dict(row) for row in rows]


def get_alert_event_latest_id() -> int:
    """获取最新预警事件ID"""
    with session_scope() as session:
        stmt = select(func.coalesce(func.max(AlertEvent.id), 0))
        value = session.execute(stmt).scalar_one()
    return int(value or 0)


def cleanup_old_alert_events(days: int = 7) -> int:
    """清理旧预警事件"""
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        result = session.execute(
            delete(AlertEvent).where(AlertEvent.triggered_at < cutoff_time)
        )
        deleted_count = result.rowcount or 0
    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} old alert events (older than {days} days)")
    return deleted_count


def get_rate_24h_ago(currency_pair: str) -> Optional[dict]:
    """获取24小时前的汇率（用于计算日涨跌幅）"""
    target_time = datetime.now(timezone.utc) - timedelta(hours=24)
    with session_scope() as session:
        stmt = (
            select(RateHistory)
            .where(RateHistory.currency_pair == currency_pair, RateHistory.timestamp <= target_time)
            .order_by(RateHistory.timestamp.desc())
            .limit(1)
        )
        row = session.execute(stmt).scalar_one_or_none()
        if not row:
            return None
        return _row_to_dict(row)


def cleanup_old_rates(days: int = 90) -> int:
    """清理超过指定天数的汇率历史记录"""
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        result = session.execute(delete(RateHistory).where(RateHistory.timestamp < cutoff_time))
        deleted_count = result.rowcount or 0
    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} old rate records (older than {days} days)")
    return deleted_count


def merge_client_to_user(client_id: str, user_id: str) -> None:
    """合并匿名客户端数据到用户"""
    with disable_scope():
        with session_scope() as session:
            session.execute(
                Transaction.__table__.update()
                .where(Transaction.user_id.is_(None), Transaction.client_id == client_id)
                .values(user_id=user_id)
            )
            session.execute(
                Alert.__table__.update()
                .where(Alert.user_id.is_(None), Alert.client_id == client_id)
                .values(user_id=user_id)
            )
            session.execute(
                AlertEvent.__table__.update()
                .where(AlertEvent.user_id.is_(None), AlertEvent.client_id == client_id)
                .values(user_id=user_id)
            )
