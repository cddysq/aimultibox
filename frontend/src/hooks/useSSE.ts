/**
 * SSE 连接管理 Hook
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { getApiUrl } from '@/config/api'

export type SSEEventType = 'connected' | 'rates_updated' | 'alert_triggered'

export interface SSEEventData {
  connected: { client_id: string }
  rates_updated: { timestamp: string; source: string; count: number }
  alert_triggered: {
    event_id: number
    alert_id: number
    condition: string
    threshold: number
    current_rate: number
    currency_pair: string
    triggered_at: string
  }
}

type EventHandler<T extends SSEEventType> = (data: SSEEventData[T]) => void

interface UseSSEOptions {
  enabled?: boolean
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
}

interface UseSSEReturn {
  isConnected: boolean
  on: <T extends SSEEventType>(eventType: T, handler: EventHandler<T>) => void
  off: <T extends SSEEventType>(eventType: T, handler: EventHandler<T>) => void
  reconnect: () => void
}

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const { enabled = true, onConnected, onDisconnected, onError } = options

  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const handlersRef = useRef<Map<SSEEventType, Set<EventHandler<SSEEventType>>>>(new Map())
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | undefined>(undefined)

  // 注册事件处理器
  const on = useCallback(<T extends SSEEventType>(eventType: T, handler: EventHandler<T>) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set())
    }
    handlersRef.current.get(eventType)!.add(handler as EventHandler<SSEEventType>)
  }, [])

  // 移除事件处理器
  const off = useCallback(<T extends SSEEventType>(eventType: T, handler: EventHandler<T>) => {
    handlersRef.current.get(eventType)?.delete(handler as EventHandler<SSEEventType>)
  }, [])

  // 分发事件
  const dispatchEvent = useCallback((eventType: SSEEventType, data: unknown) => {
    const handlers = handlersRef.current.get(eventType)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data as SSEEventData[typeof eventType])
        } catch (e) {
          console.error(`SSE handler error [${eventType}]:`, e)
        }
      })
    }
  }, [])

  // 建立连接
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `${getApiUrl()}/events/stream`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      reconnectAttemptsRef.current = 0
      setIsConnected(true)
      onConnected?.()
    }

    eventSource.onerror = (event) => {
      setIsConnected(false)
      onError?.(event)
      onDisconnected?.()

      // 无限重连，使用指数退避
      reconnectAttemptsRef.current++
      const delay = Math.min(
        RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttemptsRef.current - 1),
        MAX_RECONNECT_DELAY_MS
      )
      reconnectTimeoutRef.current = window.setTimeout(connect, delay)
    }

    // 监听自定义事件
    const eventTypes: SSEEventType[] = ['connected', 'rates_updated', 'alert_triggered']
    eventTypes.forEach((eventType) => {
      eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          dispatchEvent(eventType, data)
        } catch (e) {
          console.error(`SSE parse error [${eventType}]:`, e)
        }
      })
    })
  }, [onConnected, onDisconnected, onError, dispatchEvent])

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  // 生命周期管理
  useEffect(() => {
    if (enabled) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  // 手动重连（重置尝试计数）
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect])

  return { isConnected, on, off, reconnect }
}
