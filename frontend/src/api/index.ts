/** API 客户端 */
import axios, { type AxiosError } from 'axios'
import type { AppInfo, ToolsResponse, ErrorResponse } from '@/types'

interface BackendConfig {
  apiPrefix: string
  version: string
}

const api = axios.create({
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse>) => {
    const message = error.response?.data?.error?.message || error.message
    console.error('API 错误:', message)
    return Promise.reject(error)
  }
)

/** 初始化 API（从后端获取配置） */
export async function initApi(): Promise<void> {
  const { data } = await axios.get<BackendConfig>('/config')
  api.defaults.baseURL = data.apiPrefix
}

export default api

export async function getAppInfo(): Promise<AppInfo> {
  const { data } = await api.get<AppInfo>('/app')
  return data
}

export async function getTools(): Promise<ToolsResponse> {
  const { data } = await api.get<ToolsResponse>('/tools')
  return data
}
