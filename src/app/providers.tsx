'use client'

import { useEffect, useState } from 'react'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { toast } from 'sonner'
import { ApiError, setUnauthorizedHandler } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // Never retry what will fail identically: auth, permissions,
              // validation, or a business conflict such as insufficient stock.
              if (error instanceof ApiError) {
                if (error.status === 401 || error.status === 403 || error.status === 404) return false
                if (error.status === 409 || error.status === 400) return false
                if (error.status === 429) return false
              }
              return failureCount < 2
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
          mutations: {
            // Mutations are never retried automatically. Anything unsafe here
            // carries an Idempotency-Key and is retried explicitly by the user.
            retry: false,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Only surface a toast for background refetches that fail — a first
            // load renders its own inline error state, and two error surfaces
            // for one failure is noise.
            if (query.state.data === undefined) return
            if (error instanceof ApiError && (error.isAuthError || error.code === 'NETWORK_ERROR')) return
            toast.error('Could not refresh data', {
              description: error instanceof Error ? error.message : 'Unknown error',
            })
          },
        }),
      }),
  )

  const bootstrap = useAuthStore((state) => state.bootstrap)

  useEffect(() => {
    // Exchange the httpOnly refresh cookie for a session on first paint.
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    // When a refresh finally fails, drop the session and clear cached data so
    // the next user of this browser cannot see the previous one's numbers.
    setUnauthorizedHandler(() => {
      useAuthStore.setState({ user: null, status: 'unauthenticated' })
      queryClient.clear()
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
