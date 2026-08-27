'use client'

import { create } from 'zustand'
import { api, setAccessToken } from '@/lib/api'
import type { LoginResponse, User } from '@/types/api'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: User | null
  status: AuthStatus
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Called once on mount: exchanges the httpOnly refresh cookie for a session. */
  bootstrap: () => Promise<void>
  clearError: () => void

  isAdmin: () => boolean
}

/**
 * Session state.
 *
 * Note there is no `persist` middleware and the access token is not kept here —
 * it lives in the api module. Persisting a token to localStorage is exactly the
 * XSS footgun the httpOnly-cookie design exists to avoid. What survives a
 * reload is the cookie; `bootstrap()` turns it back into a session.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const data = await api.post<LoginResponse>('/auth/login', { email, password }, { skipAuthRetry: true })
      setAccessToken(data.accessToken)
      set({ user: data.user, status: 'authenticated', error: null })
    } catch (error) {
      setAccessToken(null)
      set({
        user: null,
        status: 'unauthenticated',
        error: error instanceof Error ? error.message : 'Sign in failed',
      })
      throw error
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', undefined, { skipAuthRetry: true })
    } catch {
      // A failed logout call must still clear the client session.
    } finally {
      setAccessToken(null)
      set({ user: null, status: 'unauthenticated', error: null })
    }
  },

  bootstrap: async () => {
    if (get().status === 'loading') return
    set({ status: 'loading' })
    try {
      const data = await api.post<LoginResponse>('/auth/refresh', undefined, { skipAuthRetry: true })
      setAccessToken(data.accessToken)
      set({ user: data.user, status: 'authenticated' })
    } catch {
      setAccessToken(null)
      set({ user: null, status: 'unauthenticated' })
    }
  },

  clearError: () => set({ error: null }),

  isAdmin: () => get().user?.role === 'ADMIN',
}))
