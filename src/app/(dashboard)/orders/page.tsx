'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { currency, formatDate, formatTime, number, relativeTime } from '@/lib/format'
import { useCancelOrder, useOrders, useUpdateOrderStatus, useWarehouses } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { isOptimistic } from '@/lib/use-place-order'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { OrderStatusBadge } from '@/components/ui/badge'
import { EmptyState, ErrorState, LiveDot, TableSkeleton } from '@/components/ui/feedback'
import { Pagination, Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { Modal } from '@/components/ui/modal'
import type { Order } from '@/types/api'

const PAGE_SIZE = 15

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default function OrdersPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Order | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      warehouseId: warehouseId || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, status, warehouseId, page],
  )

  const { data, isLoading, isError, error, refetch, isFetching } = useOrders(filters, { live: true })
  const { data: warehouses } = useWarehouses()
  const updateStatus = useUpdateOrderStatus()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">Orders</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            {data ? `${number(data.pagination.total)} orders` : 'Loading orders…'}
            <span aria-hidden>·</span>
            <LiveDot label="auto-refreshing" active={isFetching} />
          </p>
        </div>

        <Link href="/orders/new">
          <Button leftIcon={<Plus className="size-4" />}>New order</Button>
        </Link>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              placeholder="Search order number, customer name or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="size-4" />}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              aria-label="Search orders"
            />
          </div>

          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by status"
            className="w-[170px]"
          >
            {STATUSES.map((option) => (
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
            aria-label="Filter by warehouse"
            className="w-[190px]"
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
        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No orders found"
            description={
              status || debouncedSearch || warehouseId
                ? 'Nothing matches these filters.'
                : 'Place the first order to see it here.'
            }
            action={
              <Link href="/orders/new">
                <Button size="sm" leftIcon={<Plus className="size-3.5" />}>
                  New order
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[880px]">
                <THead>
                  <Tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Warehouse</Th>
                    <Th align="right">Items</Th>
                    <Th align="right">Total</Th>
                    <Th align="center">Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>

                <TBody>
                  {data?.items.map((order) => {
                    const provisional = isOptimistic(order)

                    return (
                      <Tr
                        key={order.id}
                        data-testid={provisional ? 'order-row-optimistic' : 'order-row'}
                        data-order-number={order.orderNumber}
                        className={provisional ? 'bg-brand-50/40 opacity-70' : 'cursor-pointer'}
                        onClick={() => !provisional && setDetail(order)}
                      >
                        <Td>
                          <span className="flex items-center gap-2">
                            {provisional && (
                              <Loader2 className="size-3.5 shrink-0 animate-spin text-brand-500" aria-hidden />
                            )}
                            <span>
                              <span className="block font-mono text-[12.5px] font-medium text-ink-900">
                                {order.orderNumber}
                              </span>
                              <span className="mt-0.5 block text-[11.5px] text-ink-400">
                                {provisional ? 'Submitting…' : relativeTime(order.createdAt)}
                              </span>
                            </span>
                          </span>
                        </Td>

                        <Td>
                          <span className="block max-w-[180px] truncate font-medium text-ink-800">
                            {order.customerName}
                          </span>
                          <span className="mt-0.5 block max-w-[180px] truncate text-[11.5px] text-ink-400">
                            {order.customerEmail}
                          </span>
                        </Td>

                        <Td className="text-[12.5px]">{order.warehouse.code}</Td>

                        <Td align="right" numeric>
                          {order.itemCount}
                        </Td>

                        <Td align="right" numeric className="font-semibold text-ink-900">
                          {currency(order.totalAmount)}
                        </Td>

                        <Td align="center">
                          <OrderStatusBadge status={order.status} />
                        </Td>

                        <Td align="right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && order.status === 'CONFIRMED' && !provisional && (
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={updateStatus.isPending && updateStatus.variables?.id === order.id}
                                onClick={async () => {
                                  try {
                                    await updateStatus.mutateAsync({ id: order.id, status: 'FULFILLED' })
                                    toast.success(`${order.orderNumber} fulfilled`)
                                  } catch {
                                    /* handled by the query cache error toast */
                                  }
                                }}
                              >
                                Fulfil
                              </Button>
                            )}

                            {(order.status === 'CONFIRMED' || order.status === 'PENDING') && !provisional && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-critical-700 hover:bg-critical-50"
                                onClick={() => setCancelling(order)}
                              >
                                Cancel
                              </Button>
                            )}

                            {!provisional && (
                              <Button size="sm" variant="ghost" onClick={() => setDetail(order)}>
                                View
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
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
                label="orders"
              />
            )}
          </>
        )}
      </Card>

      <OrderDetailModal order={detail} onClose={() => setDetail(null)} />
      <CancelOrderModal order={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function OrderDetailModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={order?.orderNumber ?? 'Order'}
      description={order ? `${formatDate(order.createdAt)} at ${formatTime(order.createdAt)}` : undefined}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {order && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-[12px] text-ink-400">
              Placed by {order.placedBy.name} · {order.warehouse.name}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailBlock label="Customer">
              <p className="text-[13px] font-medium text-ink-900">{order.customerName}</p>
              <p className="text-[12px] text-ink-500">{order.customerEmail}</p>
              {order.customerPhone && <p className="text-[12px] text-ink-500">{order.customerPhone}</p>}
            </DetailBlock>

            <DetailBlock label="Fulfilment">
              <p className="text-[13px] font-medium text-ink-900">{order.warehouse.name}</p>
              <p className="text-[12px] text-ink-500">{order.warehouse.code}</p>
              {order.fulfilledAt && (
                <p className="text-[12px] text-good-700">Fulfilled {formatDate(order.fulfilledAt)}</p>
              )}
              {order.cancelledAt && (
                <p className="text-[12px] text-critical-700">Cancelled {formatDate(order.cancelledAt)}</p>
              )}
            </DetailBlock>
          </div>

          {order.notes && (
            <DetailBlock label="Notes">
              <p className="text-[12.5px] leading-relaxed text-ink-600">{order.notes}</p>
            </DetailBlock>
          )}

          <div className="overflow-hidden rounded-lg border border-ink-200">
            <TableWrap>
              <Table className="min-w-[440px]">
                <THead>
                  <Tr>
                    <Th>Item</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Unit</Th>
                    <Th align="right">Total</Th>
                  </Tr>
                </THead>
                <TBody>
                  {order.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <span className="block font-medium text-ink-900">{item.name}</span>
                        <span className="font-mono text-[11px] text-ink-400">{item.sku}</span>
                      </Td>
                      <Td align="right" numeric>
                        {item.quantity}
                      </Td>
                      <Td align="right" numeric>
                        {currency(item.unitPrice)}
                      </Td>
                      <Td align="right" numeric className="font-medium">
                        {currency(item.lineTotal)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </div>

          <div className="ml-auto w-full max-w-[260px] space-y-1.5 text-[13px]">
            <Row label="Subtotal" value={currency(order.subtotal, true)} />
            <Row label="VAT (5%)" value={currency(order.taxTotal, true)} />
            <div className="border-t border-ink-200 pt-1.5">
              <Row label="Total" value={currency(order.totalAmount, true)} bold />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      {children}
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'font-semibold text-ink-900' : 'text-ink-500'}>{label}</span>
      <span className={`tnum ${bold ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{value}</span>
    </div>
  )
}

function CancelOrderModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const cancelOrder = useCancelOrder()

  useEffect(() => {
    if (order) {
      setReason('')
      cancelOrder.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  const onConfirm = async () => {
    if (!order) return
    try {
      await cancelOrder.mutateAsync({ id: order.id, reason: reason.trim() || undefined })
      toast.success(`${order.orderNumber} cancelled`, {
        description: `${order.itemCount} units returned to ${order.warehouse.code}`,
      })
      onClose()
    } catch {
      /* shown inline below */
    }
  }

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      busy={cancelOrder.isPending}
      title={`Cancel ${order?.orderNumber ?? 'order'}?`}
      description="Every unit goes back to stock through compensating ledger entries. The original movements are never deleted."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={cancelOrder.isPending}>
            Keep order
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={cancelOrder.isPending}>
            Cancel order
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {cancelOrder.isError && <ErrorState error={cancelOrder.error} compact />}

        {order && (
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
            <p className="text-[13px] font-medium text-ink-900">{order.customerName}</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              {order.itemCount} units · {currency(order.totalAmount)} · {order.warehouse.name}
            </p>
          </div>
        )}

        <Input
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Customer changed their mind"
          data-autofocus
        />
      </div>
    </Modal>
  )
}
