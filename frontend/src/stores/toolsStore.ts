/**
 * 工具列表状态管理
 */
import { create } from 'zustand'
import { getTools } from '@/api'
import type { ToolMeta } from '@/types'

interface ToolsState {
  tools: ToolMeta[]
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
