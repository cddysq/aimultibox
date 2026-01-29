/**
 * React Query 缓存持久化（IndexedDB）
 *
 * 使用 idb-keyval 作为轻量存储，满足工具级缓存复用需求
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { cacheUtils } from '@/utils/cache'

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    return await cacheUtils.idb.get<string>(key)
  },
  setItem: async (key: string, value: string) => {
    await cacheUtils.idb.set(key, value)
  },
  removeItem: async (key: string) => {
    await cacheUtils.idb.remove(key)
  },
}

/** 全局缓存持久化器（IndexedDB） */
export const queryPersister = createAsyncStoragePersister({
  storage,
  key: 'aimultibox-query-cache',
})
