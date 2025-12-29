# -*- coding: utf-8 -*-
"""汇率管家 - 汇率数据抓取"""

import asyncio
import logging
import random
from datetime import datetime
from typing import Dict, List, Optional
import httpx

from . import REFRESH_CONFIG

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

CURRENCY_NAMES = {f"{code}_CNY": name for name, code in CURRENCY_CODE_MAP.items()}

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
        self.cached_rates: Dict[str, dict] = {}
        self.supported_currencies: List[dict] = []
        self.retry_count = 3
        self.retry_delay = 2
        self._first_fetch = True
    
    async def fetch_rates(self, force: bool = False) -> List[dict]:
        """获取汇率数据"""
        cache_ttl = REFRESH_CONFIG.get("min_interval", 60)
        if not force and self.last_fetch_time:
            elapsed = (datetime.now() - self.last_fetch_time).total_seconds()
            if elapsed < cache_ttl and self.cached_rates:
                logger.debug(f"Using cached rates, elapsed: {elapsed:.0f}s, ttl: {cache_ttl}s")
                return list(self.cached_rates.values())
        
        # 首次请求不延迟，加快首屏加载
        if not self._first_fetch:
            delay = random.uniform(0.5, 1.5)
            await asyncio.sleep(delay)
        
        for attempt in range(self.retry_count):
            try:
                rates = await self._do_fetch()
                if rates:
                    self.last_fetch_time = datetime.now()
                    self.cached_rates = {r["currency_pair"]: r for r in rates}
                    self._first_fetch = False
                    return rates
            except Exception as e:
                logger.warning(f"Fetch attempt {attempt + 1} failed: {e}")
                if attempt < self.retry_count - 1:
                    # 指数退避
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
        
        logger.error("All fetch attempts failed")
        self._first_fetch = False
        return []
    
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
            if query_time_str:
                try:
                    self.last_update_time = datetime.strptime(query_time_str, "%Y-%m-%d %H:%M")
                except ValueError:
                    self.last_update_time = datetime.now()
            else:
                self.last_update_time = datetime.now()
            
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
                        rate_timestamp = datetime.strptime(f"{rat_dat} {rat_tim}", "%Y年%m月%d日 %H:%M:%S")
                    except ValueError:
                        pass
                
                # API 返回 100 单位外币兑人民币，需除以 100
                try:
                    rtb_bid = float(item.get("rtbBid", 0)) / 100
                    rth_bid = float(item.get("rthBid", 0)) / 100
                    rtc_ofr = float(item.get("rtcOfr", 0)) / 100
                    rth_ofr = float(item.get("rthOfr", 0)) / 100
                    mid_rate = (rtb_bid + rtc_ofr) / 2
                    time_str = f"{rat_dat} {rat_tim}" if rat_dat and rat_tim else ""
                    
                    rates.append({
                        "currency_pair": currency_pair,
                        "rate": round(mid_rate, 6),           # 中间价
                        "rtb_bid": round(rtb_bid, 6),         # 现汇买入价
                        "rth_bid": round(rth_bid, 6),         # 现钞买入价
                        "rtc_ofr": round(rtc_ofr, 6),         # 现汇卖出价
                        "rth_ofr": round(rth_ofr, 6),         # 现钞卖出价
                        "timestamp": rate_timestamp,          # datetime 对象
                        "time_str": time_str,                 # 原始时间字符串
                        "source": "CMB",
                    })
                    
                    # 动态添加到货币列表
                    currencies.append({
                        "pair": currency_pair,
                        "name": currency_name,
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Parse rate failed for {currency_name}: {e}")
                    continue
            
            # 更新支持的货币列表
            if currencies:
                self.supported_currencies = currencies
            
            logger.info(f"Fetched {len(rates)} rates from CMB, query_time: {self.last_update_time}")
            return rates
    
    async def fetch_rate(self, currency_pair: str, force: bool = False) -> Optional[dict]:
        """获取单个货币对的汇率"""
        # 检查缓存
        if not force and currency_pair in self.cached_rates:
            return self.cached_rates[currency_pair]
        
        # 刷新所有汇率
        await self.fetch_rates(force=force)
        
        return self.cached_rates.get(currency_pair)
    
    def get_supported_currencies(self) -> List[dict]:
        """获取支持的货币列表"""
        if self.supported_currencies:
            return self.supported_currencies
        
        # 默认列表（首次加载前使用）
        return [
            {"pair": f"{code}_CNY", "name": name}
            for name, code in CURRENCY_CODE_MAP.items()
        ]
    
    def get_last_update_time(self) -> Optional[datetime]:
        """获取 API 返回的最后更新时间"""
        return self.last_update_time


# 单例
fetcher = RateFetcher()
