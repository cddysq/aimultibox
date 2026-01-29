import { create } from 'zustand'
import type { AuthUser } from '@/types'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  googleClientId: string | null
  setStatus: (status: AuthStatus) => void
  setUser: (user: AuthUser | null) => void
  setGoogleClientId: (clientId: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  googleClientId: null,
  setStatus: (status) => set({ status }),
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'anonymous' }),
  setGoogleClientId: (clientId) => set({ googleClientId: clientId }),
}))
