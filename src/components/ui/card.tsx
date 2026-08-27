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
      className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-ink-100 px-4 py-3.5 sm:flex-nowrap sm:px-5 sm:py-4', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon && (
          <span className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 xs:flex">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-ink-900 sm:truncate sm:text-[15px]">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500 sm:text-[13px]">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 border-t border-ink-100 bg-ink-50/60 px-4 py-3 sm:px-5', className)}
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
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink-900 sm:text-xl">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-ink-500 sm:text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
