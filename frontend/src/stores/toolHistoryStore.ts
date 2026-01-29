/**
 * 处理历史状态管理
 * 使用 IndexedDB 存储，支持大容量图片数据
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { cacheUtils } from '@/utils/cache'

/** 历史记录项 */
export interface HistoryItem {
  id: string
  toolId: string
  toolName: string
  originalImage: string
  processedImage: string
  mode?: string
  timestamp: number
}

interface HistoryState {
  history: HistoryItem[]
  addHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void
  removeHistory: (id: string) => void
  clearHistory: () => void
}

const MAX_ITEMS = 10

// IndexedDB 存储适配器
const indexedDBStorage: StateStorage = {
  getItem: async (name) => {
    return await cacheUtils.idb.get(name)
  },
  setItem: async (name, value) => {
    await cacheUtils.idb.set(name, value)
  },
  removeItem: async (name) => {
    await cacheUtils.idb.remove(name)
  },
}

export const useToolHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      history: [],
      
      addHistory: (item) => {
        const { history } = get()
        
        const newItem: HistoryItem = {
          ...item,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
        }
        
        const newHistory = [newItem, ...history].slice(0, MAX_ITEMS)
        set({ history: newHistory })
      },
      
      removeHistory: (id) => {
        const { history } = get()
        set({ history: history.filter(item => item.id !== id) })
      },
      
      clearHistory: () => {
        set({ history: [] })
      },
    }),
    {
      name: 'aimultibox-history',
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
)

/** 添加历史记录 */
export const addHistoryAsync = async (
  item: Omit<HistoryItem, 'id' | 'timestamp'>
): Promise<void> => {
  useToolHistoryStore.getState().addHistory(item)
}
