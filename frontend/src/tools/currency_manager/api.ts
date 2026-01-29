/**
 * 汇率管家 - API 封装
 */
import { apiClient as api } from '@/config/api'

const BASE_URL = '/tools/currency-manager'

export interface RateData {
  currency_pair: string
  rate: number
  rtb_bid: number
  rth_bid: number
  rtc_ofr: number
  rth_ofr: number
  timestamp: string  // UTC ISO 8601
  time_str?: string
}

export interface RateHistory {
  id: number
  currency_pair: string
  rate: number
  rtb_bid: number
  rth_bid: number
  rtc_ofr: number
  rth_ofr: number
  timestamp: string  // UTC ISO 8601
  time_str?: string
}

export interface RateStats {
  currency_pair: string
  current: number
  high: number
  low: number
  average: number
  change: number
  updated_at: string  // UTC ISO 8601
  streak_days: number
  streak_change: number
}

export interface TradeRecord {
  id: number
  type: 'buy' | 'sell'
  currency_pair: string
  amount: number
  rate: number
  timestamp: string
  note?: string
  cost_cny: number
  current_value: number
  profit_loss: number
}

export interface TradeCreate {
  type: 'buy' | 'sell'
  currency_pair?: string
  amount: number
  rate: number
  timestamp?: string
  note?: string
}

export interface ProfitSummary {
  currency_pair: string
  total_cost: number
  current_value: number
  profit_loss: number
  return_rate: number
  holding_amount: number
  avg_cost_rate: number
  current_rate: number
}

export interface AlertRule {
  id: number
  currency_pair: string
  condition: 'rate_above' | 'rate_below' | 'daily_change_above'
  threshold: number
  notify_email?: string
  enabled: boolean
  created_at: string
  last_triggered?: string
}

export interface AlertCreate {
  currency_pair?: string
  condition: 'rate_above' | 'rate_below' | 'daily_change_above'
  threshold: number
  notify_email?: string
  enabled?: boolean
}

export interface CurrencyInfo {
  pair: string
  name: string
}

export interface SchedulerStatus {
  enabled: boolean
  running: boolean
  interval: number
  next_refresh_time?: string
  consecutive_failures?: number
}

export interface RatesResponse {
  rates: RateData[]
  scheduler: SchedulerStatus
}

export interface HistoryResponse {
  currency_pair: string
  days: number
  history: RateHistory[]
  stats: RateStats | null
}

export interface SummaryResponse {
  rates: RateData[]
  scheduler: SchedulerStatus
  history: RateHistory[]
  stats: RateStats | null
  profit: ProfitSummary | null
  trades: TradeRecord[]
}

export interface ToolInfo {
  id: string
  name: string
  description: string
  icon: string
  version: string
  supported_currencies: CurrencyInfo[]
}

/** 获取工具信息 */
export async function getToolInfo(): Promise<ToolInfo> {
  const response = await api.get<ToolInfo>(`${BASE_URL}/`)
  return response.data
}

/** 获取当前汇率（轻量接口） */
export async function getRates(force = false): Promise<RatesResponse> {
  const params: Record<string, boolean> = {}
  if (force) params.force = true
  const response = await api.get<RatesResponse>(`${BASE_URL}/rates`, { params })
  return response.data
}

/** 获取汇率历史和统计 */
export async function getHistory(currencyPair: string, days = 7): Promise<HistoryResponse> {
  const response = await api.get<HistoryResponse>(`${BASE_URL}/history`, {
    params: { currency_pair: currencyPair, days },
  })
  return response.data
}

/** 获取汇总数据（首次加载用） */
export async function getSummary(currencyPair: string, days = 7): Promise<SummaryResponse> {
  const response = await api.get<SummaryResponse>(`${BASE_URL}/summary`, {
    params: { currency_pair: currencyPair, days },
  })
  return response.data
}

/** 创建交易记录 */
export async function createTrade(data: TradeCreate): Promise<{ data: TradeRecord }> {
  const response = await api.post<TradeRecord>(`${BASE_URL}/trades`, data)
  return { data: response.data }
}

/** 删除交易记录 */
export async function deleteTrade(tradeId: number): Promise<void> {
  await api.delete(`${BASE_URL}/trades/${tradeId}`)
}

/** 创建预警规则 */
export async function createAlert(data: AlertCreate): Promise<{ data: AlertRule }> {
  const response = await api.post<AlertRule>(`${BASE_URL}/alerts`, data)
  return { data: response.data }
}

/** 获取预警规则列表 */
export async function getAlerts(currencyPair?: string): Promise<{ items: AlertRule[]; total: number }> {
  const response = await api.get<{ items: AlertRule[]; total: number }>(`${BASE_URL}/alerts`, { params: { currency_pair: currencyPair } })
  return response.data
}

/** 更新预警规则 */
export async function updateAlert(alertId: number, data: Partial<AlertCreate>): Promise<void> {
  await api.put(`${BASE_URL}/alerts/${alertId}`, data)
}

/** 删除预警规则 */
export async function deleteAlert(alertId: number): Promise<void> {
  await api.delete(`${BASE_URL}/alerts/${alertId}`)
}

/** 导出交易记录 CSV */
export async function exportTradesCsv(currencyPair: string): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get(`${BASE_URL}/export/trades`, {
    params: { currency_pair: currencyPair },
    responseType: 'blob',
  })
  const disposition = response.headers?.['content-disposition'] || ''
  const filenameMatch = /filename=([^;]+)/i.exec(disposition)
  const filename = filenameMatch?.[1]?.trim() || `trades_${currencyPair}.csv`
  return { blob: response.data, filename }
}
