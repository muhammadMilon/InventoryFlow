'use client'

import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/format'
import { Button } from './button'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-brand-500', className)} aria-hidden />
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton rounded-md', className)} style={style} aria-hidden />
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-ink-100" aria-busy>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-4', colIndex === 0 ? 'w-1/3' : 'flex-1', colIndex > 1 && 'hidden xs:block', colIndex > 2 && 'hidden sm:block')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex flex-col justify-end gap-2 px-4 py-4 sm:px-5" style={{ height }} aria-busy>
      <span className="sr-only">Loading chart…</span>
      <div className="flex flex-1 items-end gap-2">
        {[62, 84, 48, 96, 71, 58, 88, 44, 78, 66, 91, 53].map((value, index) => (
          <Skeleton key={index} className="flex-1 rounded-t-[4px]" style={{ height: `${value}%` }} />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-5 py-12 text-center sm:px-6 sm:py-14', className)}>
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <p className="text-[15px] font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * A single place that turns any thrown error into something a user can act on.
 * Network failures, 403s and rate limits each get their own wording — a generic
 * "Something went wrong" tells the user nothing about whether to retry, log in
 * again, or call an admin.
 */
export function ErrorState({
  error,
  onRetry,
  className,
  compact,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
  compact?: boolean
}) {
  const { title, description, icon } = describeError(error)

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border border-critical-500/25 bg-critical-50 px-3 py-2.5',
          className,
        )}
        role="alert"
      >
        <AlertTriangle className="mt-px size-4 shrink-0 text-critical-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-critical-700">{title}</p>
          {description && <p className="mt-0.5 text-[12px] text-critical-700/80">{description}</p>}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md p-1 text-critical-700 hover:bg-critical-500/10"
            aria-label="Retry"
          >
            <RefreshCw className="size-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center px-5 py-12 text-center sm:px-6 sm:py-14', className)} role="alert">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-critical-50 text-critical-700">
        {icon}
      </span>
      <p className="text-[15px] font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-500">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" leftIcon={<RefreshCw className="size-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function describeError(error: unknown): { title: string; description?: string; icon: ReactNode } {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return {
          title: 'Cannot reach the API',
          description:
            'The backend is not responding. Check that it is running and that NEXT_PUBLIC_API_URL points at it.',
          icon: <WifiOff className="size-5" />,
        }
      case 'FORBIDDEN':
        return {
          title: 'Not allowed',
          description: `${error.message} Ask an administrator if you need this permission.`,
          icon: <AlertTriangle className="size-5" />,
        }
      case 'RATE_LIMITED':
        return {
          title: 'Too many requests',
          description: 'You have hit the rate limit. Wait a moment and try again.',
          icon: <AlertTriangle className="size-5" />,
        }
      case 'INSUFFICIENT_STOCK':
        return {
          title: 'Not enough stock',
          description: error.message,
          icon: <AlertTriangle className="size-5" />,
        }
      case 'AI_UNAVAILABLE':
        return {
          title: 'AI service unavailable',
          description: error.message,
          icon: <AlertTriangle className="size-5" />,
        }
      default:
        return { title: error.message, description: error.requestId ? `Request ${error.requestId}` : undefined, icon: <AlertTriangle className="size-5" /> }
    }
  }

  return {
    title: 'Something went wrong',
    description: error instanceof Error ? error.message : undefined,
    icon: <AlertTriangle className="size-5" />,
  }
}

/** Small live indicator for polled views. */
export function LiveDot({ label = 'Live', active = true }: { label?: string; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
      <span className="relative flex size-2">
        {active && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-good-500 opacity-60" />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', active ? 'bg-good-500' : 'bg-ink-300')} />
      </span>
      {label}
    </span>
  )
}
