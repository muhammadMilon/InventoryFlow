'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { Wordmark } from '@/components/layout/brand'
import { useAuthStore } from '@/store/auth-store'

/**
 * Client-side route guard.
 *
 * This is a UX gate, not a security boundary — it decides what to render, not
 * what the user may read. Every protected byte comes from the API, which
 * verifies the JWT and the role on each request. Hiding a button here does not
 * make the endpoint safe; `requireRole('ADMIN')` on the server does.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const status = useAuthStore((state) => state.status)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`)
    }
  }, [status, router, pathname])

  // Close the mobile drawer on navigation.
  useEffect(() => setSidebarOpen(false), [pathname])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Wordmark />
          <div className="h-1 w-32 overflow-hidden rounded-full bg-ink-200">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_infinite] rounded-full bg-brand-500" />
          </div>
          <p className="text-[13px] text-ink-400">Restoring your session…</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  return (
    <div className="min-h-dvh">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[248px]">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 2xl:max-w-[1680px]">
          {children}
        </main>
      </div>
    </div>
  )
}
