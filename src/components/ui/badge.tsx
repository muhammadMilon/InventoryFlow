import type { ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  OctagonAlert,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/format'
import type { MovementType, OrderStatus, Urgency } from '@/types/api'

type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'serious' | 'critical' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  good: 'bg-good-50 text-good-700 ring-good-500/20',
  warn: 'bg-warn-50 text-warn-700 ring-warn-500/25',
  serious: 'bg-serious-50 text-serious-700 ring-serious-500/25',
  critical: 'bg-critical-50 text-critical-700 ring-critical-500/25',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
}

export interface BadgeProps {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ children, tone = 'neutral', icon, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {icon}
      {children}
    </span>
  )
}

/**
 * Status is never communicated by colour alone — every badge carries an icon
 * and a word. That is the accessibility rule, and it also survives a greyscale
 * print of the orders table.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { tone: Tone; icon: ReactNode; label: string }> = {
    PENDING: { tone: 'warn', icon: <CircleDashed className="size-3" />, label: 'Pending' },
    CONFIRMED: { tone: 'info', icon: <CheckCircle2 className="size-3" />, label: 'Confirmed' },
    FULFILLED: { tone: 'good', icon: <CheckCircle2 className="size-3" />, label: 'Fulfilled' },
    CANCELLED: { tone: 'critical', icon: <XCircle className="size-3" />, label: 'Cancelled' },
  }

  const { tone, icon, label } = config[status]
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  )
}

export function StockBadge({
  available,
  reorderPoint,
}: {
  available: number
  reorderPoint: number
}) {
  if (available <= 0) {
    return (
      <Badge tone="critical" icon={<OctagonAlert className="size-3" />}>
        Out of stock
      </Badge>
    )
  }
  if (available <= reorderPoint) {
    return (
      <Badge tone="serious" icon={<AlertTriangle className="size-3" />}>
        Low stock
      </Badge>
    )
  }
  if (available <= reorderPoint * 2) {
    return (
      <Badge tone="warn" icon={<AlertTriangle className="size-3" />}>
        Watch
      </Badge>
    )
  }
  return (
    <Badge tone="good" icon={<CheckCircle2 className="size-3" />}>
      In stock
    </Badge>
  )
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const config: Record<Urgency, { tone: Tone; label: string }> = {
    CRITICAL: { tone: 'critical', label: 'Critical' },
    HIGH: { tone: 'serious', label: 'High' },
    MEDIUM: { tone: 'warn', label: 'Medium' },
    LOW: { tone: 'neutral', label: 'Low' },
  }
  const { tone, label } = config[urgency]
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}

export function MovementBadge({ type, delta }: { type: MovementType; delta: number }) {
  const inbound = delta > 0
  const labels: Record<MovementType, string> = {
    INBOUND: 'Inbound',
    OUTBOUND: 'Outbound',
    ADJUSTMENT: 'Adjustment',
    TRANSFER_IN: 'Transfer in',
    TRANSFER_OUT: 'Transfer out',
  }

  return (
    <Badge
      tone={inbound ? 'good' : type === 'ADJUSTMENT' ? 'warn' : 'brand'}
      icon={inbound ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
    >
      {labels[type]}
    </Badge>
  )
}

export function RoleBadge({ role }: { role: 'ADMIN' | 'STAFF' }) {
  return (
    <Badge tone={role === 'ADMIN' ? 'brand' : 'neutral'}>{role === 'ADMIN' ? 'Admin' : 'Staff'}</Badge>
  )
}

/** Delta chip for KPI tiles: arrow + sign + colour, never colour alone. */
export function TrendChip({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tnum',
        positive ? 'bg-good-50 text-good-700' : 'bg-critical-50 text-critical-700',
      )}
    >
      {positive ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
      {positive ? '+' : ''}
      {value.toFixed(1)}
      {suffix}
    </span>
  )
}
