'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ScrollText,
  Sparkles,
  Warehouse,
  X,
} from 'lucide-react'
import { cn } from '@/lib/format'
import { useAuthStore } from '@/store/auth-store'
import { useLowStock } from '@/lib/queries'
import { Wordmark } from './brand'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  /** Rendered only for these roles. Omitted means everyone. */
  roles?: Array<'ADMIN' | 'STAFF'>
  badge?: 'lowStock'
}

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-4" /> }],
  },
  {
    section: 'Operations',
    items: [
      { href: '/products', label: 'Products', icon: <Package className="size-4" /> },
      { href: '/orders', label: 'Orders', icon: <ClipboardList className="size-4" /> },
      { href: '/stock', label: 'Stock ledger', icon: <Boxes className="size-4" />, badge: 'lowStock' },
      { href: '/warehouses', label: 'Warehouses', icon: <Warehouse className="size-4" /> },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { href: '/ai', label: 'Restock AI', icon: <Sparkles className="size-4" /> },
      { href: '/audit', label: 'Audit log', icon: <ScrollText className="size-4" />, roles: ['ADMIN'] },
    ],
  },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const role = useAuthStore((state) => state.user?.role)
  const { data: lowStock } = useLowStock(30, 200)

  const lowStockCount = lowStock?.length ?? 0

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-ink-900/30 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-ink-200 bg-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
          <Link href="/dashboard" onClick={onClose} className="rounded-lg">
            <Wordmark />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV.map((group) => {
            const visible = group.items.filter((item) => !item.roles || (role && item.roles.includes(role)))
            if (visible.length === 0) return null

            return (
              <div key={group.section}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  {group.section}
                </p>
                <ul className="space-y-0.5">
                  {visible.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    const showBadge = item.badge === 'lowStock' && lowStockCount > 0

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors',
                            active
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                          )}
                        >
                          <span className={cn('shrink-0', active ? 'text-brand-500' : 'text-ink-400')}>
                            {item.icon}
                          </span>
                          <span className="flex-1 truncate">{item.label}</span>
                          {showBadge && (
                            <span className="rounded-full bg-critical-50 px-1.5 py-0.5 text-[10px] font-bold text-critical-700 tnum">
                              {lowStockCount > 99 ? '99+' : lowStockCount}
                            </span>
                          )}
                          {active && <span className="h-4 w-0.5 rounded-full bg-brand-500" aria-hidden />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <div className="rounded-lg bg-gradient-to-br from-brand-50 to-white p-3 ring-1 ring-brand-100">
            <p className="text-[12px] font-semibold text-ink-900">Ledger reconciled</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
              Stock levels are checked against the movement ledger on every load.
            </p>
            <Link
              href="/stock?tab=reconcile"
              onClick={onClose}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
            >
              Run a check
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
