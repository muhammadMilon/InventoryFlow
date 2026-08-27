'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeftRight,
  Boxes,
  CheckCircle2,
  ScrollText,
  Search,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react'
import { cn, currency, formatDate, formatTime, number, titleCase } from '@/lib/format'
import { useMovements, useReconcile, useStockLevels, useWarehouses } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, SegmentedControl, Select } from '@/components/ui/field'
import { Badge, MovementBadge, StockBadge } from '@/components/ui/badge'
import { EmptyState, ErrorState, LiveDot, TableSkeleton } from '@/components/ui/feedback'
import { Pagination, Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { TransferStockModal } from './transfer-modal'

type Tab = 'levels' | 'ledger' | 'reconcile'

export default function StockPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={6} />}>
      <StockPageInner />
    </Suspense>
  )
}

function StockPageInner() {
  const searchParams = useSearchParams()
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN')

  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'reconcile' ? 'reconcile' : 'levels'))
  const [transferOpen, setTransferOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('filter') === 'low') setTab('levels')
  }, [searchParams])

  const tabs = useMemo(
    () =>
      [
        { value: 'levels' as const, label: 'Stock levels' },
        { value: 'ledger' as const, label: 'Ledger' },
        ...(isAdmin ? [{ value: 'reconcile' as const, label: 'Reconcile' }] : []),
      ] satisfies Array<{ value: Tab; label: string }>,
    [isAdmin],
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink-900 sm:text-xl">Stock ledger</h1>
          <p className="mt-1 text-[13px] text-ink-500 sm:text-sm">
            Every unit that moved, why it moved, and who moved it.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={tabs}
            label="Stock view"
            className="w-full xs:w-auto xs:min-w-0 xs:flex-1 sm:flex-none"
          />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeftRight className="size-3.5" />}
              onClick={() => setTransferOpen(true)}
              className="shrink-0"
            >
              Transfer
            </Button>
          )}
        </div>
      </div>

      {tab === 'levels' && <StockLevelsPanel initialLowOnly={searchParams.get('filter') === 'low'} />}
      {tab === 'ledger' && <LedgerPanel />}
      {tab === 'reconcile' && isAdmin && <ReconcilePanel />}

      <TransferStockModal open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

function StockLevelsPanel({ initialLowOnly }: { initialLowOnly: boolean }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [lowOnly, setLowOnly] = useState(initialLowOnly)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: warehouses } = useWarehouses()
  const { data, isLoading, isError, error, refetch, isFetching } = useStockLevels({
    warehouseId: warehouseId || undefined,
    search: debounced || undefined,
    lowOnly,
  })

  const totals = useMemo(() => {
    const rows = data ?? []
    return {
      units: rows.reduce((sum, row) => sum + row.quantity, 0),
      value: rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0),
      low: rows.filter((row) => row.isLow).length,
    }
  }, [data])

  return (
    <>
      <Card className="p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          <div className="w-full sm:min-w-[200px] sm:flex-1">
            <Input
              placeholder="Search product or SKU…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="size-4" />}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100"
                    aria-label="Clear"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              aria-label="Search stock levels"
            />
          </div>

          <Select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            aria-label="Warehouse"
            className="w-full sm:w-[200px]"
          >
            <option value="">All warehouses</option>
            {warehouses?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.city}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={() => setLowOnly((value) => !value)}
            aria-pressed={lowOnly}
            className={cn(
              'inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors sm:w-auto',
              lowOnly
                ? 'border-serious-500/30 bg-serious-50 text-serious-700'
                : 'border-ink-300 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50',
            )}
          >
            <ShieldAlert className="size-3.5" />
            Low stock only
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Current levels"
          description={`${number(totals.units)} units · ${currency(totals.value)} at retail · ${totals.low} low`}
          icon={<Boxes className="size-4" />}
          action={<LiveDot label="live" active={isFetching} />}
        />

        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Boxes className="size-5" />}
            title={lowOnly ? 'Nothing is running low' : 'No stock rows match'}
            description={
              lowOnly
                ? 'Every product is above its reorder point.'
                : 'Try a different search term or warehouse.'
            }
          />
        ) : (
          <TableWrap>
            <Table className="min-w-[820px]">
              <THead>
                <Tr>
                  <Th>Product</Th>
                  <Th>Warehouse</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right">Reserved</Th>
                  <Th align="right">Available</Th>
                  <Th align="right">Reorder pt</Th>
                  <Th align="center">Status</Th>
                  <Th align="right">Updated</Th>
                </Tr>
              </THead>
              <TBody>
                {data?.map((row) => (
                  <Tr key={`${row.productId}-${row.warehouseId}`}>
                    <Td>
                      <span className="block font-medium text-ink-900">{row.productName}</span>
                      <span className="font-mono text-[11px] text-ink-400">{row.sku}</span>
                    </Td>
                    <Td className="text-[12.5px]">
                      <span className="font-medium text-ink-700">{row.warehouse.code}</span>
                      <span className="ml-1.5 text-ink-400">{row.warehouse.name}</span>
                    </Td>
                    <Td align="right" numeric className="font-semibold text-ink-900">
                      {row.quantity}
                    </Td>
                    <Td align="right" numeric className="text-ink-400">
                      {row.reserved}
                    </Td>
                    <Td align="right" numeric className="font-semibold">
                      {row.available}
                    </Td>
                    <Td align="right" numeric className="text-ink-400">
                      {row.reorderPoint}
                    </Td>
                    <Td align="center">
                      <StockBadge available={row.available} reorderPoint={row.reorderPoint} />
                    </Td>
                    <Td align="right" className="text-[11.5px] text-ink-400">
                      {formatDate(row.updatedAt, 'short')}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

const MOVEMENT_TYPES = [
  { value: '', label: 'All movement types' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'TRANSFER_IN', label: 'Transfer in' },
  { value: 'TRANSFER_OUT', label: 'Transfer out' },
]

function LedgerPanel() {
  const [type, setType] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [page, setPage] = useState(1)

  const { data: warehouses } = useWarehouses()
  const { data, isLoading, isError, error, refetch, isFetching } = useMovements({
    type: type || undefined,
    warehouseId: warehouseId || undefined,
    page,
    pageSize: 20,
  })

  return (
    <>
      <Card className="p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              setPage(1)
            }}
            aria-label="Movement type"
            className="w-full sm:w-[200px]"
          >
            {MOVEMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value)
              setPage(1)
            }}
            aria-label="Warehouse"
            className="w-full sm:w-[200px]"
          >
            <option value="">All warehouses</option>
            {warehouses?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.city}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Movement ledger"
          description="Append-only. Entries are never edited or deleted — corrections are new rows."
          icon={<ScrollText className="size-4" />}
          action={<LiveDot label="live" active={isFetching} />}
        />

        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={10} cols={7} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-5" />} title="No movements recorded yet" />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[900px]">
                <THead>
                  <Tr>
                    <Th>When</Th>
                    <Th>Product</Th>
                    <Th>Warehouse</Th>
                    <Th align="center">Type</Th>
                    <Th>Reason</Th>
                    <Th align="right">Change</Th>
                    <Th align="right">Balance</Th>
                    <Th>Actor</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data?.items.map((movement) => (
                    <Tr key={movement.id}>
                      <Td className="whitespace-nowrap text-[12px]">
                        <span className="block text-ink-700">{formatDate(movement.createdAt, 'short')}</span>
                        <span className="block text-[11px] text-ink-400">
                          {formatTime(movement.createdAt)}
                        </span>
                      </Td>

                      <Td>
                        <span className="block max-w-[190px] truncate font-medium text-ink-900">
                          {movement.product.name}
                        </span>
                        <span className="font-mono text-[11px] text-ink-400">{movement.product.sku}</span>
                      </Td>

                      <Td className="text-[12.5px]">{movement.warehouse.code}</Td>

                      <Td align="center">
                        <MovementBadge type={movement.type} delta={movement.quantityDelta} />
                      </Td>

                      <Td>
                        <span className="block text-[12.5px] text-ink-600">{titleCase(movement.reason)}</span>
                        {movement.referenceId && (
                          <span className="block font-mono text-[11px] text-ink-400">
                            {movement.referenceId}
                          </span>
                        )}
                      </Td>

                      <Td
                        align="right"
                        numeric
                        className={cn(
                          'font-semibold',
                          movement.quantityDelta > 0 ? 'text-good-700' : 'text-critical-700',
                        )}
                      >
                        {movement.quantityDelta > 0 ? '+' : ''}
                        {movement.quantityDelta}
                      </Td>

                      <Td align="right" numeric className="font-medium text-ink-900">
                        {movement.balanceAfter}
                      </Td>

                      <Td className="max-w-[140px] truncate text-[12px] text-ink-500">
                        {movement.actor?.name ?? 'system'}
                      </Td>
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
                label="movements"
              />
            )}
          </>
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

/**
 * The integrity check that makes the ledger claim testable rather than
 * aspirational: for every (product, warehouse), does the sum of all movements
 * equal the current stock level? If it does not, something wrote to stock
 * outside `applyMovement` — which is a bug worth failing loudly over.
 */
function ReconcilePanel() {
  const [enabled, setEnabled] = useState(false)
  const { data, isFetching, isError, error, refetch } = useReconcile(enabled)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Ledger reconciliation"
        description="Sum of every movement vs the current stock level, for each product/warehouse pair."
        icon={<Sliders className="size-4" />}
        action={
          <Button
            size="sm"
            loading={isFetching}
            onClick={() => {
              setEnabled(true)
              void refetch()
            }}
          >
            Run check
          </Button>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : !enabled ? (
        <EmptyState
          icon={<Sliders className="size-5" />}
          title="Reconciliation not run yet"
          description="This walks the entire ledger and compares it against live stock levels. On a seeded database it should come back balanced."
          action={
            <Button size="sm" onClick={() => setEnabled(true)}>
              Run check
            </Button>
          }
        />
      ) : isFetching && !data ? (
        <TableSkeleton rows={4} cols={4} />
      ) : data ? (
        <div className="p-4 sm:p-5">
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 sm:p-4',
              data.balanced
                ? 'border-good-500/25 bg-good-50'
                : 'border-critical-500/25 bg-critical-50',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg bg-white',
                data.balanced ? 'text-good-700' : 'text-critical-700',
              )}
            >
              {data.balanced ? <CheckCircle2 className="size-4" /> : <ShieldAlert className="size-4" />}
            </span>
            <div>
              <p
                className={cn(
                  'text-[14px] font-semibold',
                  data.balanced ? 'text-good-700' : 'text-critical-700',
                )}
              >
                {data.balanced
                  ? `Ledger balanced across all ${number(data.checked)} stock rows`
                  : `${data.discrepancies.length} of ${number(data.checked)} rows have drifted`}
              </p>
              <p
                className={cn(
                  'mt-0.5 text-[12.5px] leading-relaxed',
                  data.balanced ? 'text-good-700/80' : 'text-critical-700/80',
                )}
              >
                {data.balanced
                  ? 'Every stock level equals the sum of its movements. Nothing has mutated stock outside the ledger.'
                  : 'A stock level does not match its movement history. Something wrote to stock_levels without recording a movement.'}
              </p>
            </div>
          </div>

          {!data.balanced && (
            <div className="mt-4 overflow-hidden rounded-lg border border-ink-200">
              <TableWrap>
                <Table className="min-w-[520px]">
                  <THead>
                    <Tr>
                      <Th>Product</Th>
                      <Th>Warehouse</Th>
                      <Th align="right">Stock level</Th>
                      <Th align="right">Ledger sum</Th>
                      <Th align="right">Drift</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {data.discrepancies.map((row) => (
                      <Tr key={`${row.productId}-${row.warehouseId}`}>
                        <Td>
                          <span className="block font-medium text-ink-900">{row.productName}</span>
                          <span className="font-mono text-[11px] text-ink-400">{row.sku}</span>
                        </Td>
                        <Td>{row.warehouseCode}</Td>
                        <Td align="right" numeric>
                          {row.level}
                        </Td>
                        <Td align="right" numeric>
                          {row.ledger}
                        </Td>
                        <Td align="right" numeric className="font-semibold text-critical-700">
                          {row.drift > 0 ? '+' : ''}
                          {row.drift}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </div>
          )}

          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px] leading-relaxed text-ink-400">
            <Badge tone="neutral">Admin only</Badge>
            In production this would run nightly and page on-call if it ever reported drift.
          </p>
        </div>
      ) : null}
    </Card>
  )
}
