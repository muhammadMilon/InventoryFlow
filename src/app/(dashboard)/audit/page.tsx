'use client'

import { useState } from 'react'
import { Fingerprint, ScrollText, ShieldCheck } from 'lucide-react'
import { formatDate, formatTime, relativeTime, titleCase } from '@/lib/format'
import { useAuditLog } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/field'
import { Badge, RoleBadge } from '@/components/ui/badge'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/feedback'
import { Pagination, Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

const ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'STOCK_ADJUSTED', label: 'Stock adjusted' },
  { value: 'STOCK_TRANSFERRED', label: 'Stock transferred' },
  { value: 'PRODUCT_CREATED', label: 'Product created' },
  { value: 'PRODUCT_UPDATED', label: 'Product updated' },
  { value: 'ORDER_PLACED', label: 'Order placed' },
  { value: 'ORDER_CANCELLED', label: 'Order cancelled' },
  { value: 'ORDER_STATUS_CHANGED', label: 'Order status changed' },
  { value: 'USER_LOGIN', label: 'Sign in' },
  { value: 'USER_LOGIN_FAILED', label: 'Failed sign in' },
]

const TONE_BY_ACTION: Record<string, 'brand' | 'good' | 'warn' | 'critical' | 'neutral'> = {
  STOCK_ADJUSTED: 'warn',
  STOCK_TRANSFERRED: 'brand',
  PRODUCT_CREATED: 'good',
  PRODUCT_UPDATED: 'neutral',
  PRODUCT_ARCHIVED: 'warn',
  ORDER_PLACED: 'good',
  ORDER_CANCELLED: 'critical',
  ORDER_STATUS_CHANGED: 'neutral',
  USER_LOGIN: 'neutral',
  USER_LOGIN_FAILED: 'critical',
  USER_LOGOUT: 'neutral',
}

/**
 * Admin-only audit trail.
 *
 * Login failures are in here alongside stock adjustments on purpose — a burst
 * of USER_LOGIN_FAILED against one account is the signal that the login rate
 * limiter is earning its keep.
 */
export default function AuditPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error, refetch } = useAuditLog({
    action: action || undefined,
    page,
    pageSize: 25,
  })

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-5" />}
        title="Admins only"
        description="The audit log records who changed what. Staff accounts cannot read it."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">Audit log</h1>
        <p className="mt-1 text-sm text-ink-500">
          Who did what, when, and from where. Written in the same transaction as the change it describes.
        </p>
      </div>

      <Card className="p-3">
        <Select
          value={action}
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by action"
          className="w-[230px]"
        >
          {ACTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Recorded events"
          description="Append-only, newest first."
          icon={<ScrollText className="size-4" />}
        />

        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={10} cols={5} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={<Fingerprint className="size-5" />} title="No audit entries match this filter" />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[860px]">
                <THead>
                  <Tr>
                    <Th>When</Th>
                    <Th>Action</Th>
                    <Th>Entity</Th>
                    <Th>Actor</Th>
                    <Th>Details</Th>
                    <Th>IP</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data?.items.map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="whitespace-nowrap text-[12px]">
                        <span className="block text-ink-700">{formatDate(entry.createdAt, 'short')}</span>
                        <span className="block text-[11px] text-ink-400" title={formatDate(entry.createdAt, 'long')}>
                          {formatTime(entry.createdAt)} · {relativeTime(entry.createdAt)}
                        </span>
                      </Td>

                      <Td>
                        <Badge tone={TONE_BY_ACTION[entry.action] ?? 'neutral'}>
                          {titleCase(entry.action)}
                        </Badge>
                      </Td>

                      <Td className="text-[12.5px]">
                        <span className="block font-medium text-ink-800">{entry.entity}</span>
                        {entry.entityId && (
                          <span className="block max-w-[120px] truncate font-mono text-[10.5px] text-ink-400">
                            {entry.entityId}
                          </span>
                        )}
                      </Td>

                      <Td>
                        <span className="flex items-center gap-1.5">
                          <span className="max-w-[130px] truncate text-[12.5px] font-medium text-ink-800">
                            {entry.actor.name}
                          </span>
                          {entry.actor.role && <RoleBadge role={entry.actor.role} />}
                        </span>
                        {entry.actor.email && (
                          <span className="block max-w-[160px] truncate text-[11px] text-ink-400">
                            {entry.actor.email}
                          </span>
                        )}
                      </Td>

                      <Td className="max-w-[260px]">
                        <AuditDetails entry={entry} />
                      </Td>

                      <Td className="font-mono text-[11px] text-ink-400">{entry.ip ?? '—'}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            {data && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                pageSize={data.pagination.pageSize}
                onPageChange={setPage}
                label="entries"
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function AuditDetails({ entry }: { entry: { metadata: Record<string, unknown> | null; before: unknown; after: unknown } }) {
  const metadata = entry.metadata ?? {}

  // Stock adjustments get a purpose-built summary — it is the entry an auditor
  // actually reads, and raw JSON is a poor answer to "what changed?".
  if (typeof metadata.delta === 'number') {
    const before = entry.before as { quantity?: number } | null
    const after = entry.after as { quantity?: number } | null
    return (
      <div className="text-[12px] leading-relaxed">
        <span className="font-medium text-ink-800">
          {String(metadata.sku ?? '')} {before?.quantity ?? '?'} → {after?.quantity ?? '?'}
        </span>
        <span
          className={`ml-1.5 font-semibold tnum ${metadata.delta > 0 ? 'text-good-700' : 'text-critical-700'}`}
        >
          ({metadata.delta > 0 ? '+' : ''}
          {metadata.delta})
        </span>
        {typeof metadata.note === 'string' && metadata.note && (
          <span className="block truncate text-[11px] text-ink-400">{metadata.note}</span>
        )}
      </div>
    )
  }

  if (typeof metadata.orderNumber === 'string' || typeof (entry.after as { orderNumber?: string })?.orderNumber === 'string') {
    const after = entry.after as { orderNumber?: string; totalAmount?: string; lines?: number } | null
    return (
      <div className="text-[12px] leading-relaxed">
        <span className="font-mono font-medium text-ink-800">{after?.orderNumber}</span>
        {after?.lines !== undefined && (
          <span className="ml-1.5 text-ink-500">
            {after.lines} {after.lines === 1 ? 'line' : 'lines'}
          </span>
        )}
      </div>
    )
  }

  if (typeof metadata.reason === 'string') {
    return <span className="text-[12px] text-ink-600">{titleCase(metadata.reason)}</span>
  }

  if (typeof metadata.transferRef === 'string') {
    return (
      <span className="text-[12px] text-ink-600">
        {String(metadata.quantity ?? '')} units · {metadata.transferRef}
      </span>
    )
  }

  return <span className="text-[12px] text-ink-400">—</span>
}
