/**
 * 共享 API 类型定义
 */


/** API 错误响应 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
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

/** 用户信息 */
export interface AuthUser {
  id: string
  name?: string
  email?: string
  avatar_url?: string
}

/** 认证状态响应 */
export interface AuthMeResponse {
  user: AuthUser | null
}
