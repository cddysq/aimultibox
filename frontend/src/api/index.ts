/**
 * API 客户端配置
 */
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 错误:', error)
    return Promise.reject(error)
  }
)

export default api

/** 获取应用信息 */
export async function getAppInfo() {
  const response = await api.get('/app')
  return response.data
}

/** 获取工具列表 */
export async function getTools() {
  const response = await api.get('/tools')
  return response.data
}
