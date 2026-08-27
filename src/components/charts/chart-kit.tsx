'use client'

import { useState, type ReactNode } from 'react'
import { Table2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/format'
import { Card } from '@/components/ui/card'

/**
 * Shared chart chrome and specs.
 *
 * Everything visual that must be consistent across charts lives here rather
 * than being re-typed per chart: the categorical slot order, the axis
 * treatment, the tooltip, and the legend. A chart file then contains only the
 * marks and the data mapping.
 *
 * Palette note: the slots below are the validated categorical order (see
 * globals.css). They are assigned by position and NEVER cycled — a ninth series
 * folds into "Other" instead of reusing slot 1, because a repeated colour reads
 * as "same thing" to anyone scanning the legend.
 */
export const SERIES = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
  'var(--color-series-5)',
  'var(--color-series-6)',
  'var(--color-series-7)',
  'var(--color-series-8)',
] as const

/** Status colours are reserved and never used for a data series. */
export const STATUS_COLORS = {
  good: 'var(--color-good-500)',
  warn: 'var(--color-warn-500)',
  serious: 'var(--color-serious-500)',
  critical: 'var(--color-critical-500)',
  neutral: 'var(--color-ink-400)',
} as const

export const AXIS = {
  tickLine: false as const,
  axisLine: false as const,
  tick: { fontSize: 12, fill: 'var(--color-ink-500)' },
  tickMargin: 8,
}

export const GRID = {
  stroke: 'var(--color-ink-200)',
  strokeDasharray: '0',
  vertical: false as const,
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export interface TooltipRow {
  label: string
  value: string
  color?: string
  muted?: boolean
}

export function ChartTooltip({
  title,
  rows,
  footer,
}: {
  title: string
  rows: TooltipRow[]
  footer?: ReactNode
}) {
  return (
    <div className="pointer-events-none min-w-[168px] rounded-lg border border-ink-200 bg-white/98 px-3 py-2 shadow-[var(--shadow-pop)] backdrop-blur">
      <p className="mb-1.5 text-[12px] font-semibold text-ink-900">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-500">
              {row.color && (
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
              )}
              {row.label}
            </span>
            <span
              className={cn(
                'text-[12px] font-semibold tnum',
                row.muted ? 'text-ink-500' : 'text-ink-900',
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1.5 border-t border-ink-100 pt-1.5 text-[11px] text-ink-500">{footer}</div>}
    </div>
  )
}

/** Crosshair styling for line/area charts. */
export const CURSOR_LINE = {
  stroke: 'var(--color-ink-300)',
  strokeWidth: 1,
  strokeDasharray: '4 4',
}

/** Hover wash for bar charts — a tinted band, not a solid block. */
export const CURSOR_BAR = { fill: 'var(--color-brand-500)', fillOpacity: 0.06 }

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

export interface LegendItem {
  label: string
  color: string
  value?: string
}

/**
 * A legend is always present for two or more series, so identity is never
 * carried by colour alone. Labels wear ink tokens, never the series colour —
 * the swatch beside them does the identifying.
 */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-[12px] text-ink-600">{item.label}</span>
          {item.value && <span className="text-[12px] font-semibold text-ink-900 tnum">{item.value}</span>}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export interface ChartFrameProps {
  title: string
  description?: string
  legend?: LegendItem[]
  controls?: ReactNode
  children: ReactNode
  /**
   * The table view. Required for every chart whose palette includes a slot
   * below 3:1 contrast on white ("relief rule"), and useful everywhere else —
   * it is also how a screen-reader user reads the data.
   */
  table?: ReactNode
  className?: string
  footer?: ReactNode
}

export function ChartFrame({
  title,
  description,
  legend,
  controls,
  children,
  table,
  className,
  footer,
}: ChartFrameProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {controls}
          {table && (
            <button
              type="button"
              onClick={() => setView((current) => (current === 'chart' ? 'table' : 'chart'))}
              aria-pressed={view === 'table'}
              title={view === 'chart' ? 'Show as table' : 'Show as chart'}
              className="rounded-md border border-ink-200 p-1.5 text-ink-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {view === 'chart' ? <Table2 className="size-3.5" /> : <BarChart3 className="size-3.5" />}
              <span className="sr-only">{view === 'chart' ? 'Show as table' : 'Show as chart'}</span>
            </button>
          )}
        </div>
      </div>

      {legend && legend.length > 1 && <ChartLegend items={legend} className="px-5 pb-2" />}

      <div className="min-w-0 flex-1">
        {view === 'chart' ? children : <div className="max-h-[320px] overflow-auto">{table}</div>}
      </div>

      {footer && <div className="border-t border-ink-100 px-5 py-2.5 text-[12px] text-ink-500">{footer}</div>}
    </Card>
  )
}

/** Value renderers shared by chart labels and their table views. */
export function ChartEmpty({ message = 'No data for this period' }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-center">
      <p className="text-[13px] text-ink-400">{message}</p>
    </div>
  )
}
