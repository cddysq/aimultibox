/**
 * IndexedDB 缓存工具（基于 idb-keyval）
 */
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

export const idb = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = await idbGet<T>(key)
      return value ?? null
    } catch {
      return null
    }
  },
  async set<T = unknown>(key: string, value: T): Promise<void> {
    try {
      await idbSet(key, value)
    } catch (e) {
      console.error('IndexedDB 存储失败', e)
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await idbDel(key)
    } catch {
      // ignore
    }
  },
  async getOrSet<T = unknown>(key: string, factory: () => Promise<T> | T): Promise<T> {
    const existing = await idb.get<T>(key)
    if (existing !== null) return existing
    const value = await factory()
    await idb.set(key, value)
    return value
  },
}
