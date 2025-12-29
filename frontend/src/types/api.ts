/**
 * 共享 API 类型定义
 */

/** API 基础响应 */
export interface BaseResponse<T = unknown> {
  status: 'success' | 'error'
  message?: string
  data?: T
}

/** API 错误响应 */
export interface ErrorResponse {
  status: 'error'
  error: {
    type: string
    message: string
    details?: Record<string, unknown>
  }
  request_id?: string
}

/** 分页响应 */
export interface PaginatedResponse<T> extends BaseResponse<T[]> {
  total: number
}

/** 应用信息 */
export interface AppInfo {
  name: string
  version: string
  description: string
  ai_mode: string
  debug: boolean
}

/** 工具信息 */
export interface ToolMeta {
  id: string
  name: string
  description: string
  icon?: string
  version: string
  endpoint: string
  status: 'active' | 'inactive'
}

/** 工具列表响应 */
export interface ToolsResponse {
  tools: ToolMeta[]
}
