/**
 * 错误处理工具
 */
import type { AxiosError } from 'axios'

/** API 错误响应结构 */
interface ApiErrorResponse {
  detail?: string
  message?: string
}

/** 判断是否为 Axios 错误 */
export function isAxiosError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  )
}

/** 从错误中提取消息 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    return error.response?.data?.detail || error.response?.data?.message || fallback
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

/** 获取 HTTP 状态码 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isAxiosError(error)) {
    return error.response?.status
  }
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
