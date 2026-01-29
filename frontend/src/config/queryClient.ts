/**
 * 全局 QueryClient 配置
 *
 * 设计目标：
 * - 统一缓存策略
 * - 支持持久化
 * - 支持未来工具扩展复用
 */
import { QueryClient } from '@tanstack/react-query'

/** 全局 QueryClient（单例） */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 分钟内认为数据新鲜
      gcTime: 10 * 60_000, // 10 分钟无引用后回收
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
