# -*- coding: utf-8 -*-
"""汇率管家 - 数据库操作"""

import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_DIR = Path(__file__).parent.parent.parent.parent / "data"
DB_PATH = DB_DIR / "currency.db"


def init_db():
    """初始化数据库"""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 汇率历史表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rate_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_pair TEXT NOT NULL,
                rate REAL NOT NULL,
                rtb_bid REAL,
                rth_bid REAL,
                rtc_ofr REAL,
                rth_ofr REAL,
                timestamp DATETIME NOT NULL,
                time_str TEXT,
                source TEXT DEFAULT 'CMB',
                UNIQUE(currency_pair, timestamp)
            )
        """)
        
        # 交易记录表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
                currency_pair TEXT NOT NULL,
                amount REAL NOT NULL,
                rate REAL NOT NULL,
                timestamp DATETIME NOT NULL,
                note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 预警规则表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_pair TEXT NOT NULL,
                condition TEXT NOT NULL,
                threshold REAL NOT NULL,
                notify_email TEXT,
                enabled INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_triggered DATETIME
            )
        """)
        
        # 创建索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rate_history_pair_time ON rate_history(currency_pair, timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_pair ON transactions(currency_pair)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_pair ON alerts(currency_pair)")
        
        conn.commit()


@contextmanager
def get_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(str(DB_PATH), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ========== 汇率操作 ==========

def save_rate(currency_pair: str, rate: float,
              rtb_bid: float, rth_bid: float, rtc_ofr: float, rth_ofr: float,
              timestamp: datetime, time_str: str = "", source: str = "CMB") -> bool:
    """保存汇率数据"""
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO rate_history 
                (currency_pair, rate, rtb_bid, rth_bid, rtc_ofr, rth_ofr, timestamp, time_str, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (currency_pair, rate, rtb_bid, rth_bid, rtc_ofr, rth_ofr, timestamp, time_str, source))
            conn.commit()
            logger.debug(f"Saved rate: {currency_pair} = {rate} at {timestamp}")
            return True
        except Exception as e:
            logger.error(f"Failed to save rate {currency_pair}: {e}")
            return False


def get_rate_history(currency_pair: str, days: int = 7, 
                     start_time: Optional[datetime] = None,
                     end_time: Optional[datetime] = None,
                     max_points: int = 200) -> List[dict]:
    """获取汇率历史（带智能采样）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        if start_time and end_time:
            cursor.execute("""
                SELECT * FROM rate_history 
                WHERE currency_pair = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            """, (currency_pair, start_time, end_time))
        else:
            since = datetime.now() - timedelta(days=days)
            cursor.execute("""
                SELECT * FROM rate_history 
                WHERE currency_pair = ? AND timestamp >= ?
                ORDER BY timestamp ASC
            """, (currency_pair, since))
        
        rows = [dict(row) for row in cursor.fetchall()]
        
        # 智能采样：如果数据点超过 max_points，进行均匀采样
        if len(rows) <= max_points:
            return rows
        
        # 计算采样间隔
        step = len(rows) / max_points
        sampled = []
        for i in range(max_points):
            idx = int(i * step)
            if idx < len(rows):
                sampled.append(rows[idx])
        
        # 确保包含最后一个数据点
        if sampled[-1] != rows[-1]:
            sampled.append(rows[-1])
        
        return sampled


def get_latest_rate(currency_pair: str) -> Optional[dict]:
    """获取最新汇率"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM rate_history 
            WHERE currency_pair = ?
            ORDER BY timestamp DESC LIMIT 1
        """, (currency_pair,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_rate_stats(currency_pair: str, days: int = 7) -> Optional[dict]:
    """获取汇率统计"""
    with get_connection() as conn:
        cursor = conn.cursor()
        since = datetime.now() - timedelta(days=days)
        
        cursor.execute("""
            SELECT 
                MAX(rate) as high,
                MIN(rate) as low,
                AVG(rate) as average
            FROM rate_history 
            WHERE currency_pair = ? AND timestamp >= ?
        """, (currency_pair, since))
        
        row = cursor.fetchone()
        if row and row["high"]:
            return dict(row)
        return None


def get_daily_closing_rates(currency_pair: str, days: int = 30) -> List[dict]:
    """获取每日收盘价（用于计算连涨/连跌）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        since = datetime.now() - timedelta(days=days)
        
        # 单条 SQL: 按日期分组，取每组最后一条记录
        cursor.execute("""
            SELECT date(timestamp) as date, rate
            FROM rate_history
            WHERE currency_pair = ? AND timestamp >= ?
            GROUP BY date(timestamp)
            HAVING timestamp = MAX(timestamp)
            ORDER BY date ASC
        """, (currency_pair, since))
        
        return [dict(row) for row in cursor.fetchall()]


# ========== 交易操作 ==========

def create_transaction(type: str, currency_pair: str, amount: float, 
                       rate: float, timestamp: datetime, note: Optional[str] = None) -> int:
    """创建交易记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO transactions (type, currency_pair, amount, rate, timestamp, note)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (type, currency_pair, amount, rate, timestamp, note))
        conn.commit()
        trade_id = cursor.lastrowid
        logger.info(f"Created transaction: id={trade_id}, {type} {amount} {currency_pair} @ {rate}")
        return trade_id


def get_transactions(currency_pair: str, type_filter: Optional[str] = None,
                     limit: int = 100, offset: int = 0) -> Tuple[List[dict], int]:
    """获取交易记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 构建查询
        where_clauses = ["currency_pair = ?"]
        params = [currency_pair]
        
        if type_filter:
            where_clauses.append("type = ?")
            params.append(type_filter)
        
        where_sql = " AND ".join(where_clauses)
        
        # 获取总数
        cursor.execute(f"SELECT COUNT(*) as count FROM transactions WHERE {where_sql}", params)
        total = cursor.fetchone()["count"]
        
        # 获取数据
        cursor.execute(f"""
            SELECT * FROM transactions 
            WHERE {where_sql}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        return [dict(row) for row in cursor.fetchall()], total


def get_transaction(id: int) -> Optional[dict]:
    """获取单条交易记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_transaction(id: int, **kwargs) -> bool:
    """更新交易记录"""
    if not kwargs:
        return False
    
    with get_connection() as conn:
        cursor = conn.cursor()
        set_clauses = [f"{k} = ?" for k in kwargs.keys()]
        values = list(kwargs.values()) + [id]
        
        cursor.execute(f"""
            UPDATE transactions SET {", ".join(set_clauses)}
            WHERE id = ?
        """, values)
        conn.commit()
        return cursor.rowcount > 0


def delete_transaction(id: int) -> bool:
    """删除交易记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM transactions WHERE id = ?", (id,))
        conn.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            logger.info(f"Deleted transaction: id={id}")
        return deleted


def get_holding_summary(currency_pair: str) -> dict:
    """获取持仓汇总"""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 买入汇总
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_buy, 
                   COALESCE(SUM(amount * rate), 0) as total_buy_cost
            FROM transactions 
            WHERE currency_pair = ? AND type = 'buy'
        """, (currency_pair,))
        buy_row = cursor.fetchone()
        
        # 卖出汇总
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_sell,
                   COALESCE(SUM(amount * rate), 0) as total_sell_value
            FROM transactions 
            WHERE currency_pair = ? AND type = 'sell'
        """, (currency_pair,))
        sell_row = cursor.fetchone()
        
        return {
            "total_buy": buy_row["total_buy"],
            "total_buy_cost": buy_row["total_buy_cost"],
            "total_sell": sell_row["total_sell"],
            "total_sell_value": sell_row["total_sell_value"],
            "holding": buy_row["total_buy"] - sell_row["total_sell"],
        }


# ========== 预警操作 ==========

def create_alert(currency_pair: str, condition: str, threshold: float,
                 notify_email: Optional[str] = None, enabled: bool = True) -> int:
    """创建预警规则"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (currency_pair, condition, threshold, notify_email, enabled)
            VALUES (?, ?, ?, ?, ?)
        """, (currency_pair, condition, threshold, notify_email, 1 if enabled else 0))
        conn.commit()
        return cursor.lastrowid


def get_alerts(currency_pair: Optional[str] = None, enabled_only: bool = False) -> List[dict]:
    """获取预警规则"""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        where_clauses = []
        params = []
        
        if currency_pair:
            where_clauses.append("currency_pair = ?")
            params.append(currency_pair)
        
        if enabled_only:
            where_clauses.append("enabled = 1")
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        cursor.execute(f"""
            SELECT * FROM alerts WHERE {where_sql}
            ORDER BY created_at DESC
        """, params)
        
        return [dict(row) for row in cursor.fetchall()]


def get_alert(id: int) -> Optional[dict]:
    """获取单条预警规则"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alerts WHERE id = ?", (id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_alert(id: int, **kwargs) -> bool:
    """更新预警规则"""
    if not kwargs:
        return False
    
    with get_connection() as conn:
        cursor = conn.cursor()
        set_clauses = [f"{k} = ?" for k in kwargs.keys()]
        values = list(kwargs.values()) + [id]
        
        cursor.execute(f"""
            UPDATE alerts SET {", ".join(set_clauses)}
            WHERE id = ?
        """, values)
        conn.commit()
        return cursor.rowcount > 0


def delete_alert(id: int) -> bool:
    """删除预警规则"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM alerts WHERE id = ?", (id,))
        conn.commit()
        return cursor.rowcount > 0


def update_alert_triggered(id: int) -> bool:
    """更新预警触发时间"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE alerts SET last_triggered = ?
            WHERE id = ?
        """, (datetime.now(), id))
        conn.commit()
        return cursor.rowcount > 0


def get_rate_24h_ago(currency_pair: str) -> Optional[dict]:
    """获取24小时前的汇率（用于计算日涨跌幅）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        target_time = datetime.now() - timedelta(hours=24)
        
        # 获取最接近24小时前的汇率记录
        cursor.execute("""
            SELECT * FROM rate_history 
            WHERE currency_pair = ? AND timestamp <= ?
            ORDER BY timestamp DESC LIMIT 1
        """, (currency_pair, target_time))
        row = cursor.fetchone()
        return dict(row) if row else None


def cleanup_old_rates(days: int = 90) -> int:
    """清理超过指定天数的汇率历史记录"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cutoff_time = datetime.now() - timedelta(days=days)
        
        cursor.execute("""
            DELETE FROM rate_history WHERE timestamp < ?
        """, (cutoff_time,))
        conn.commit()
        
        deleted_count = cursor.rowcount
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old rate records (older than {days} days)")
        return deleted_count


# 初始化数据库
init_db()
