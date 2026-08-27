import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/format'

/**
 * Wide tables scroll inside their own container — the page body must never
 * scroll horizontally on a phone.
 */
export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('w-full overflow-x-auto', className)} {...props} />
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full min-w-[640px] border-collapse text-sm', className)} {...props} />
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-ink-50/80', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-ink-100', className)} {...props} />
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  sorted?: 'asc' | 'desc' | false
}

export function Th({ className, align = 'left', sortable, sorted, children, ...props }: ThProps) {
  return (
    <th
      scope="col"
      aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        sortable && 'cursor-pointer select-none transition-colors hover:text-ink-800',
        className,
      )}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {children}
        {sortable && (
          <span aria-hidden className={cn('text-[9px] leading-none', sorted ? 'text-brand-500' : 'text-ink-300')}>
            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
          </span>
        )}
      </span>
    </th>
  )
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
}

export function Td({ className, align = 'left', numeric, ...props }: TdProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-ink-700',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        numeric && 'tnum',
        className,
      )}
      {...props}
    />
  )
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-brand-50/40', className)} {...props} />
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  label = 'results',
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  label?: string
}) {
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3">
      <p className="text-[13px] text-ink-500 tnum">
        <span className="font-medium text-ink-700">
          {from}–{to}
        </span>{' '}
        of <span className="font-medium text-ink-700">{total.toLocaleString()}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </PageButton>
        <span className="px-2 text-[13px] text-ink-500 tnum">
          {page} / {totalPages}
        </span>
        <PageButton disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </PageButton>
      </div>
    </div>
  )
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-ink-200 bg-white px-2.5 py-1 text-[13px] font-medium text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-white disabled:hover:text-ink-600"
    >
      {children}
    </button>
  )
}
