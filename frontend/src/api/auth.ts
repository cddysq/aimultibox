import { apiClient as api } from '@/config/api'
import type { AuthMeResponse } from '@/types'

export async function getAuthMe(): Promise<AuthMeResponse> {
  const { data } = await api.get<AuthMeResponse>('/auth/me')
  return data
}

export async function loginWithGoogle(credential: string): Promise<AuthMeResponse> {
  const { data } = await api.post<AuthMeResponse>('/auth/google', { credential })
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
