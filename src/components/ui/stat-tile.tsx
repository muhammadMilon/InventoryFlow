'use client'

import type { ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/format'
import { TrendChip } from './badge'
import { Skeleton } from './feedback'

export interface StatTileProps {
  label: string
  value: ReactNode
  /** Secondary line under the value — context, not decoration. */
  sub?: ReactNode
  icon?: ReactNode
  change?: number
  changeLabel?: string
  tone?: 'default' | 'good' | 'warn' | 'critical'
  sparkline?: number[]
  loading?: boolean
  className?: string
}

const TONE_RING: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'bg-brand-50 text-brand-600',
  good: 'bg-good-50 text-good-700',
  warn: 'bg-warn-50 text-warn-700',
  critical: 'bg-critical-50 text-critical-700',
}

/**
 * A stat tile, not a chart: a single number has no shape to plot. The optional
 * sparkline is deliberately unlabelled and axis-free — it shows direction, and
 * the exact figures live in the full chart below.
 */
export function StatTile({
  label,
  value,
  sub,
  icon,
  change,
  changeLabel,
  tone = 'default',
  sparkline,
  loading,
  className,
}: StatTileProps) {
  if (loading) {
    return (
      <div className={cn('rounded-[var(--radius-card)] border border-ink-200 bg-white p-3.5 sm:p-4', className)}>
        <div className="flex items-start justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
        <Skeleton className="mt-3 h-7 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    )
  }

  const sparkData = sparkline?.map((v, index) => ({ index, v }))

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white p-3.5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)] sm:p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[11.5px] font-medium uppercase tracking-wide text-ink-500 sm:text-[12px]">{label}</p>
        {icon && (
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', TONE_RING[tone])}>
            {icon}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.03em] text-ink-900 tnum sm:text-[26px]">
        {value}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {change !== undefined && <TrendChip value={change} />}
        {(sub || changeLabel) && (
          <span className="text-[12px] text-ink-500">{sub ?? changeLabel}</span>
        )}
      </div>

      {sparkData && sparkData.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-70" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--color-series-1)"
                strokeWidth={2}
                fill={`url(#spark-${label.replace(/\W/g, '')})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
