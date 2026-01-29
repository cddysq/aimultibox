# -*- coding: utf-8 -*-
"""汇率管家 - 汇率数据抓取"""

import asyncio
import logging
import math
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional

import httpx

from . import SCHEDULER_CONFIG

logger = logging.getLogger(__name__)

CMB_API_URL = "https://m.cmbchina.com/api/rate/fx-rate"

# 招行中文名 -> 货币代码
CURRENCY_CODE_MAP = {
    "日元": "JPY",
    "美元": "USD",
    "欧元": "EUR",
    "\u82f1\u9551": "GBP",
    "港币": "HKD",
    "澳大利亚元": "AUD",
    "加拿大元": "CAD",
    "新加坡元": "SGD",
    "瑞士法郎": "CHF",
    "新西兰元": "NZD",
}


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://m.cmbchina.com/",
    "Origin": "https://m.cmbchina.com",
}


class RateFetcher:
    """汇率数据抓取器"""

    def __init__(self):
        self.last_fetch_time: Optional[datetime] = None
        self.last_update_time: Optional[datetime] = None
        self.last_query_time_str: Optional[str] = None
        self.cached_rates: Dict[str, dict] = {}
        self.supported_currencies: List[dict] = []
        self.retry_count = 3
        self.retry_delay = 2
        self._first_fetch = True
        self._fetch_lock = asyncio.Lock()

    async def fetch_rates(self, min_interval_seconds: Optional[int] = None, skip_delay: bool = False) -> tuple[
        List[dict], bool]:
        """获取汇率数据"""
        async with self._fetch_lock:
            now = datetime.now(timezone.utc)
            if (
                min_interval_seconds
                and self.last_fetch_time
                and (now - self.last_fetch_time).total_seconds() < min_interval_seconds
            ):
                return list(self.cached_rates.values()), False

            # 调度刷新时添加随机延迟，手动刷新跳过
            if not self._first_fetch and not skip_delay:
                delay = random.uniform(0.5, 1.5)
                await asyncio.sleep(delay)

            for attempt in range(self.retry_count):
                try:
                    rates = await self._do_fetch()
                    if rates:
                        self.last_fetch_time = datetime.now(timezone.utc)
                        self.cached_rates = {r["currency_pair"]: r for r in rates}
                        self._first_fetch = False
                        return rates, True
                except Exception as e:
                    logger.warning(f"Fetch attempt {attempt + 1} failed: {e}")
                    if attempt < self.retry_count - 1:
                        # 指数退避
                        wait_time = self.retry_delay * (2 ** attempt)
                        await asyncio.sleep(wait_time)

            logger.error("All fetch attempts failed")
            self._first_fetch = False
            return list(self.cached_rates.values()), False

    async def _do_fetch(self) -> List[dict]:
        """执行 API 请求"""
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            response = await client.get(CMB_API_URL, headers=HEADERS)
            response.raise_for_status()
            data = response.json()

        if data.get("returnCode") != "SUC0000":
            raise ValueError(f"API error: {data.get('returnCode')}")

        body = data.get("body", {})
        query_time_str = body.get("time", "")
        self.last_query_time_str = query_time_str or None

        sh_tz = ZoneInfo("Asia/Shanghai")
        if query_time_str:
            try:
                naive = datetime.strptime(query_time_str, "%Y-%m-%d %H:%M")
                self.last_update_time = naive.replace(tzinfo=sh_tz).astimezone(timezone.utc)
            except ValueError:
                self.last_update_time = datetime.now(timezone.utc)
        else:
            self.last_update_time = datetime.now(timezone.utc)

        rates = []
        currencies = []
        for item in body.get("data", []):
            currency_name = item.get("ccyNbr", "")
            currency_code = CURRENCY_CODE_MAP.get(currency_name)
            if not currency_code:
                logger.debug(f"Unknown currency: {currency_name}")
                continue

            currency_pair = f"{currency_code}_CNY"
            rate_timestamp = self.last_update_time
            rat_dat = item.get("ratDat", "")
            rat_tim = item.get("ratTim", "")
            if rat_dat and rat_tim:
                try:
                    naive_local = datetime.strptime(f"{rat_dat} {rat_tim}", "%Y年%m月%d日 %H:%M:%S")
                    rate_timestamp = naive_local.replace(tzinfo=sh_tz).astimezone(timezone.utc)
                except ValueError:
                    pass

            try:
                rtb_bid = float(item.get("rtbBid", 0)) / 100
                rth_bid = float(item.get("rthBid", 0)) / 100
                rtc_ofr = float(item.get("rtcOfr", 0)) / 100
                rth_ofr = float(item.get("rthOfr", 0)) / 100
                mid_rate = (rtb_bid + rtc_ofr) / 2
                time_str = f"{rat_dat} {rat_tim}" if rat_dat and rat_tim else ""

                rates.append({
                    "currency_pair": currency_pair,
                    "rate": round(mid_rate, 6),
                    "rtb_bid": round(rtb_bid, 6),
                    "rth_bid": round(rth_bid, 6),
                    "rtc_ofr": round(rtc_ofr, 6),
                    "rth_ofr": round(rth_ofr, 6),
                    "timestamp": rate_timestamp,
                    "time_str": time_str,
                    "source": "CMB",
                })
                currencies.append({"pair": currency_pair, "name": currency_name})
            except (ValueError, TypeError) as e:
                logger.warning(f"Parse rate failed for {currency_name}: {e}")
                continue

        if currencies:
            self.supported_currencies = currencies

        logger.debug(f"Fetched {len(rates)} rates from CMB, query_time: {self.last_update_time}")
        return rates

    def get_supported_currencies(self) -> List[dict]:
        """获取支持的货币列表"""
        if self.supported_currencies:
            return self.supported_currencies

        return [
            {"pair": f"{code}_CNY", "name": name}
            for name, code in CURRENCY_CODE_MAP.items()
        ]

    def get_cached_rates(self) -> List[dict]:
        """返回缓存的汇率数据副本"""
        return list(self.cached_rates.values())


class RateScheduler:
    """汇率数据后台调度器"""
    MIN_STARTUP_REFRESH_GAP_SECONDS = 10
    MIN_REFRESH_INTERVAL_SECONDS = 5

    def __init__(self, fetcher_instance: RateFetcher) -> None:
        self.fetcher = fetcher_instance
        self.task: Optional[asyncio.Task] = None
        self.running = False
        self.next_refresh_time: Optional[datetime] = None
        self.consecutive_failures = 0

    async def start(self) -> None:
        """启动调度器"""
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._run())
        logger.info(f"汇率调度器已启动，间隔: {SCHEDULER_CONFIG['interval']}秒")

    async def stop(self) -> None:
        """停止调度器"""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
        logger.info("汇率调度器已停止")

    def _floor_to_interval(self, now: datetime, interval: int) -> datetime:
        ts = now.timestamp()
        floored = math.floor(ts / interval) * interval
        return datetime.fromtimestamp(floored, tz=timezone.utc)

    def _next_aligned_time(self, now: datetime, interval: int) -> datetime:
        return self._floor_to_interval(now, interval) + timedelta(seconds=interval)

    async def _do_refresh(self) -> None:
        """执行一次刷新"""
        from .service import service
        from aimultibox.core.sse import sse_manager

        rates, fetched = await service.fetch_and_save_rates(
            min_interval_seconds=self.MIN_REFRESH_INTERVAL_SECONDS,
        )
        self.consecutive_failures = 0

        query_time_str = getattr(self.fetcher, "last_query_time_str", None)
        if not query_time_str:
            query_time = getattr(self.fetcher, "last_update_time", None)
            query_time_str = query_time.strftime("%Y-%m-%d %H:%M") if query_time else "-"

        if fetched:
            # 检测预警（会通过 SSE 推送）
            await service.process_alerts_for_rates(rates)

            # 广播汇率更新事件
            await sse_manager.broadcast("rates_updated", {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "CMB",
                "count": len(rates),
            })

        next_local = self.next_refresh_time.astimezone().strftime(
            "%Y-%m-%d %H:%M:%S") if self.next_refresh_time else "-"
        status_text = "刷新成功" if fetched else "跳过(近期已刷新)"
        logger.info(
            f"汇率调度{status_text} | 数据源: CMB | 条数: {len(rates)} | 接口时间: {query_time_str} | 下次刷新: {next_local}")

    async def _run(self) -> None:
        """调度主循环"""
        interval = int(SCHEDULER_CONFIG["interval"])

        # 首次启动立即拉一次数据
        if not self.next_refresh_time:
            now = datetime.now(timezone.utc)
            self.next_refresh_time = self._floor_to_interval(now, interval) + timedelta(seconds=interval)
            try:
                await self._do_refresh()

                # 重新对齐下次刷新时间
                now = datetime.now(timezone.utc)
                next_time = self._next_aligned_time(now, interval)
                if (next_time - now).total_seconds() < self.MIN_STARTUP_REFRESH_GAP_SECONDS:
                    next_time = next_time + timedelta(seconds=interval)
                self.next_refresh_time = next_time
            except Exception as e:
                self.consecutive_failures += 1
                logger.warning(f"调度刷新失败 ({self.consecutive_failures}次): {e}")

        while self.running:
            now = datetime.now(timezone.utc)
            sleep_seconds = (self.next_refresh_time - now).total_seconds() if self.next_refresh_time else 0
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

            scheduled = self.next_refresh_time or datetime.now(timezone.utc)
            self.next_refresh_time = scheduled + timedelta(seconds=interval)

            try:
                await self._do_refresh()
            except Exception as e:
                self.consecutive_failures += 1
                logger.warning(f"调度刷新失败 ({self.consecutive_failures}次): {e}")

    def get_status(self) -> dict:
        """获取调度器状态"""
        return {
            "enabled": SCHEDULER_CONFIG["enabled"],
            "running": self.running,
            "interval": int(SCHEDULER_CONFIG["interval"]),
            "next_refresh_time": self.next_refresh_time.isoformat() if self.next_refresh_time else None,
            "consecutive_failures": self.consecutive_failures,
        }


fetcher = RateFetcher()
scheduler: Optional[RateScheduler] = None


async def start_scheduler() -> None:
    """启动调度器"""
    global scheduler
    if not SCHEDULER_CONFIG["enabled"]:
        logger.info("汇率调度器未启用")
        return

    if scheduler is None:
        scheduler = RateScheduler(fetcher)
    await scheduler.start()


async def stop_scheduler() -> None:
    """停止调度器"""
    global scheduler
    if scheduler:
        await scheduler.stop()
