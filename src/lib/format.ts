import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Money is always BDT here. Intl is created once per format — constructing a
 * NumberFormat inside a table cell renderer is a measurable cost at 200 rows.
 */
const bdt = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
})

const bdtPrecise = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const decimal = new Intl.NumberFormat('en-US')

export function currency(value: number, precise = false): string {
  if (!Number.isFinite(value)) return '৳0'
  return (precise ? bdtPrecise : bdt).format(value).replace('BDT', '৳').replace(/\s+/, '')
}

/** Axis labels and stat tiles: ৳1.2M reads better than ৳1,204,880. */
export function compactCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10_000_000) return `৳${(value / 10_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}Cr`
  if (abs >= 100_000) return `৳${(value / 100_000).toFixed(abs >= 1_000_000 ? 0 : 1)}L`
  if (abs >= 1_000) return `৳${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return `৳${Math.round(value)}`
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

export function number(value: number): string {
  return decimal.format(Math.round(value))
}

export function percent(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

// --- Dates ------------------------------------------------------------------

export function formatDate(input: string | Date, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'

  if (style === 'short') {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }
  if (style === 'long') {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "3 minutes ago" / "in 2 days" */
export function relativeTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(diffSeconds)

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (abs < 60) return formatter.format(Math.round(diffSeconds), 'second')
  if (abs < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute')
  if (abs < 86_400) return formatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (abs < 2_592_000) return formatter.format(Math.round(diffSeconds / 86_400), 'day')
  return formatDate(date)
}

/** Axis tick for an ISO date string, without constructing a Date per tick. */
export function axisDate(iso: string): string {
  const [, month, day] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = Number(month) - 1
  return `${day} ${months[monthIndex] ?? ''}`
}

// --- Misc -------------------------------------------------------------------

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}
