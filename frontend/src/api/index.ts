/** API 客户端 */
import type { AppInfo, ToolsResponse } from '@/types'
import { apiClient as api } from '@/config/api'

export async function getAppInfo(): Promise<AppInfo> {
  const { data } = await api.get<AppInfo>('/app')
  return data
}

export async function getTools(): Promise<ToolsResponse> {
  const { data } = await api.get<ToolsResponse>('/tools')
  return data
}
