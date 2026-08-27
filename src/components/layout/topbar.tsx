'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Menu, Plus, ShoppingCart, Wifi, WifiOff } from 'lucide-react'
import { cn, initials } from '@/lib/format'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'
import { useHealth } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/ui/badge'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const cartCount = useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0))
  const { data: health, isError: healthError } = useHealth()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClickAway = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onEscape)
    }
  }, [menuOpen])

  const onLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const apiHealthy = Boolean(health?.database.connected) && !healthError
  const basketLabel = `Resume basket — ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-1.5 border-b border-ink-200 bg-white/85 px-3 backdrop-blur-md sm:h-16 sm:gap-3 sm:px-5 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1" />

      {/* API health — an honest indicator beats a mystery blank screen. */}
      <span
        className={cn(
          'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex',
          apiHealthy ? 'bg-good-50 text-good-700' : 'bg-critical-50 text-critical-700',
        )}
        title={
          apiHealthy
            ? `API healthy · database ${health?.database.latencyMs}ms`
            : 'Cannot reach the API. Check the backend is running.'
        }
      >
        {apiHealthy ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
        {apiHealthy ? 'API online' : 'API offline'}
      </span>

      {/* Only shown with a basket to resume. Empty, it would be a second control
          pointing at the same page as the New order button beside it. */}
      {cartCount > 0 && (
        <Link
          href="/orders/new"
          className="relative shrink-0 rounded-lg p-2 text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-600"
          aria-label={basketLabel}
          title={basketLabel}
        >
          <ShoppingCart className="size-[18px]" />
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[17px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-[17px] text-white tnum">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        </Link>
      )}

      {/* Icon-only below sm, where the label will not fit. The cart icon used to
          be the only order entry point on mobile; it no longer always is. */}
      <Button
        size="sm"
        leftIcon={<Plus className="size-3.5" />}
        onClick={() => router.push('/orders/new')}
        aria-label="New order"
        className="w-9 shrink-0 justify-center px-0 sm:w-auto sm:justify-start sm:px-3"
      >
        <span className="hidden sm:inline">New order</span>
      </Button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex shrink-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-ink-100 sm:pr-2"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 text-[12px] font-semibold text-white">
            {user ? initials(user.name) : '··'}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[130px] truncate text-[13px] font-medium text-ink-900">
              {user?.name ?? 'Loading…'}
            </span>
            <span className="block text-[11px] text-ink-400">{user?.role === 'ADMIN' ? 'Admin' : 'Staff'}</span>
          </span>
          <ChevronDown className={cn('size-3.5 text-ink-400 transition-transform', menuOpen && 'rotate-180')} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="animate-fade-rise absolute right-0 top-[calc(100%+6px)] w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white shadow-[var(--shadow-pop)]"
          >
            <div className="border-b border-ink-100 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold text-ink-900">{user?.name}</p>
                {user && <RoleBadge role={user.role} />}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-ink-500">{user?.email}</p>
            </div>

            <div className="px-4 py-2.5 text-[11px] text-ink-400">
              <div className="flex justify-between">
                <span>API</span>
                <span className={apiHealthy ? 'text-good-700' : 'text-critical-700'}>
                  {apiHealthy ? 'Healthy' : 'Unreachable'}
                </span>
              </div>
              {health && (
                <>
                  <div className="mt-1 flex justify-between">
                    <span>Database</span>
                    <span className="tnum">{health.database.latencyMs}ms</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>AI provider</span>
                    <span>{health.ai.enabled ? (health.ai.model ?? 'Gemini') : 'Heuristic'}</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2.5 text-left text-[13px] font-medium text-critical-700 transition-colors hover:bg-critical-50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
