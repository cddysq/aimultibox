/**
 * localStorage 缓存工具
 */
export const local = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
  getJson<T>(key: string, fallback?: T): T | null {
    const raw = local.get(key)
    if (raw == null) return fallback ?? null
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback ?? null
    }
  },
  setJson<T>(key: string, value: T): void {
    try {
      local.set(key, JSON.stringify(value))
    } catch {
      // ignore
    }
  },
  getNumber(key: string, fallback?: number): number | null {
    const raw = local.get(key)
    if (raw == null) return fallback ?? null
    const num = Number(raw)
    return Number.isFinite(num) ? num : (fallback ?? null)
  },
  setNumber(key: string, value: number): void {
    local.set(key, String(value))
  },
  getBool(key: string, fallback?: boolean): boolean | null {
    const raw = local.get(key)
    if (raw == null) return fallback ?? null
    if (raw === 'true') return true
    if (raw === 'false') return false
    return fallback ?? null
  },
  setBool(key: string, value: boolean): void {
    local.set(key, value ? 'true' : 'false')
  },
  getOrSet<T>(key: string, factory: () => T): T {
    const raw = local.get(key)
    if (raw != null) {
      const trimmed = raw.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(raw) as T
        } catch {
          return raw as unknown as T
        }
      }
      return raw as unknown as T
    }
    const value = factory()
    if (typeof value === 'string') {
      local.set(key, value)
    } else {
      local.setJson(key, value)
    }
    return value
  },
}
