/**
 * 统一错误模型与工具
 *
 * 设计目标：
 * - 前后端统一错误结构
 * - 业务层只处理 ApiError
 * - 支持 request_id 追踪
 */
import type { AxiosError } from 'axios'
import type { ErrorResponse } from './api'

/** 统一 API 错误对象 */
export class ApiError extends Error {
  /** HTTP 状态码 */
  status: number
  /** 错误码 */
  code: string
  /** 错误详情 */
  details?: Record<string, unknown>
  /** 追踪 ID */
  requestId?: string

  constructor(options: {
    message: string
    status: number
    code: string
    details?: Record<string, unknown>
    requestId?: string
  }) {
    super(options.message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
    this.requestId = options.requestId
  }
}

/** 判断是否为 ApiError */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** 判断是否为 Axios 错误 */
export function isAxiosError(error: unknown): error is AxiosError<ErrorResponse> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  )
}

/** 从错误中提取消息（统一出口） */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message
  if (isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

/** 获取 HTTP 状态码 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isApiError(error)) return error.status
  if (isAxiosError(error)) return error.response?.status
  return undefined
}

/** 获取 Retry-After 头 */
export function getRetryAfter(error: unknown): number {
  if (isAxiosError(error)) {
    const retryAfter = error.response?.headers?.['retry-after']
    return retryAfter ? parseInt(retryAfter, 10) : 10
  }
  return 10
}
