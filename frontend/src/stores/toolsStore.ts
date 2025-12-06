/**
 * 工具列表状态管理
 */
import { create } from 'zustand'
import { getTools } from '@/api'

/** 工具信息 */
export interface Tool {
  id: string
  name: string
  description: string
  icon: string
  version: string
  endpoint: string
  status: string
}

interface ToolsState {
  tools: Tool[]
  isLoading: boolean
  error: string | null
  fetchTools: () => Promise<void>
}

export const useToolsStore = create<ToolsState>((set) => ({
  tools: [],
  isLoading: false,
  error: null,
  
  /** 获取工具列表 */
  fetchTools: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await getTools()
      set({ tools: response.tools || [], isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'LOAD_FAILED', isLoading: false })
    }
  },
}))
