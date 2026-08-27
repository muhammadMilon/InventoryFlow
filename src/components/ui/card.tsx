import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/format'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-ink-200 bg-white shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Omitted from HTMLAttributes because the native `title` attribute is a string. */
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}

export function CardHeader({ title, description, action, icon, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4', className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-ink-100 bg-ink-50/60 px-5 py-3', className)}
      {...props}
    />
  )
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
