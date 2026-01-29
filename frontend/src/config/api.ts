import axios, { type AxiosError } from 'axios'
import type { ErrorResponse } from '@/types'
import { ApiError } from '@/types'

export interface BackendConfig {
  apiPrefix: string
  version: string
  googleClientId?: string
}

let backendConfig: BackendConfig | null = null

export function setBackendConfig(config: BackendConfig) {
  backendConfig = config
}

export function getBackendConfig(): BackendConfig | null {
  return backendConfig
}

/** 获取 API 基础 URL */
export function getApiUrl(): string {
  return backendConfig?.apiPrefix || '/api'
}


const api = axios.create({
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})
api.defaults.withCredentials = true

function applyBackendConfig(config: BackendConfig) {
  api.defaults.baseURL = config.apiPrefix
  api.defaults.withCredentials = true
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse>) => {
    const status = error.response?.status || 0
    const errorBody = error.response?.data
    const message = errorBody?.error?.message || error.message || 'Unknown error'
    const code = errorBody?.error?.code || 'UNKNOWN_ERROR'
    const details = errorBody?.error?.details
    console.error('API 错误:', message)

    // 网络错误或服务不可用时，刷新页面以触发服务不可用页面
    if (!error.response && error.code === 'ERR_NETWORK') {
      window.location.reload()
      return new Promise(() => {}) // 终止后续处理
    }

    return Promise.reject(new ApiError({ message, status, code, details }))
  }
)

/** API 客户端 */
export const apiClient = api

/** 初始化 API */
export async function initApi(): Promise<void> {
  const { data } = await axios.get<BackendConfig>('/config')
  setBackendConfig(data)
  applyBackendConfig(data)
}
