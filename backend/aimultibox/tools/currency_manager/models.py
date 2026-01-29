# -*- coding: utf-8 -*-
"""汇率管家 - ORM 模型"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, UniqueConstraint, Index, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from aimultibox.db import Base, UTCDateTime, UserScopedMixin


class RateHistory(Base):
    __tablename__ = "rate_history"
    __table_args__ = (
        UniqueConstraint("currency_pair", "timestamp", name="uq_rate_pair_ts"),
        Index("idx_rate_history_pair_time", "currency_pair", "timestamp"),
        Index("idx_rate_history_pair_date", "currency_pair", "rate_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    currency_pair: Mapped[str] = mapped_column(String, nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False)
    rtb_bid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rth_bid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rtc_ofr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rth_ofr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    rate_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD (UTC)
    time_str: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="CMB")


class Transaction(UserScopedMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("idx_transactions_pair", "currency_pair"),
        Index("idx_transactions_client_pair", "client_id", "currency_pair"),
        Index("idx_transactions_user_pair", "user_id", "currency_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    currency_pair: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    rate: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.current_timestamp())


class Alert(UserScopedMixin, Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("idx_alerts_pair", "currency_pair"),
        Index("idx_alerts_client_pair", "client_id", "currency_pair"),
        Index("idx_alerts_user_pair", "user_id", "currency_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    currency_pair: Mapped[str] = mapped_column(String, nullable=False)
    condition: Mapped[str] = mapped_column(String, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    notify_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, server_default=func.current_timestamp())
    last_triggered: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, nullable=True)


class AlertEvent(UserScopedMixin, Base):
    __tablename__ = "alert_events"
    __table_args__ = (
        Index("idx_alert_events_client_id", "client_id", "id"),
        Index("idx_alert_events_user_id", "user_id", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("alerts.id"), nullable=True)
    currency_pair: Mapped[str] = mapped_column(String, nullable=False)
    condition: Mapped[str] = mapped_column(String, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    current_rate: Mapped[float] = mapped_column(Float, nullable=False)
    notify_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    triggered_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
