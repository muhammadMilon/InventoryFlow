'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import type { Order, Paginated, PlaceOrderPayload, Product, StockLevel } from '@/types/api'

export interface PlaceOrderVariables extends PlaceOrderPayload {
  /**
   * Generated once when the form is first submitted and reused for every retry
   * of that same basket. This is what makes a double-click — or a retry after a
   * flaky network — safe: the server recognises the key and replays the first
   * response instead of placing a second order.
   */
  idempotencyKey: string
  /** Product names, for building the optimistic row. */
  displayLines: Array<{ productId: string; sku: string; name: string; quantity: number; unitPrice: number }>
  customerLabel: string
  warehouseLabel: { id: string; code: string; name: string }
  userLabel: { id: string; name: string; email: string }
  taxRate: number
}

interface Snapshot {
  entries: Array<[readonly unknown[], unknown]>
}

/**
 * Order placement with optimistic UI and rollback.
 *
 * On submit the UI immediately shows the order in the list and decrements the
 * on-screen stock, because that is what will happen 99% of the time and waiting
 * on a round trip makes the app feel slow.
 *
 * The 1% is the interesting case, and it is a real one here: two staff members
 * can race for the last unit, and the loser's optimistic decrement was a lie.
 * So every cache entry touched is snapshotted before mutating, and `onError`
 * puts all of them back exactly as they were. The failure the user sees is the
 * server's real reason ("Not enough stock for X: requested 2, available 1"),
 * not a generic message.
 *
 * `onSettled` then invalidates regardless of outcome, so the optimistic guess is
 * always replaced by server truth rather than lingering as an approximation.
 */
export function useOptimisticPlaceOrder() {
  const queryClient = useQueryClient()

  return useMutation<Order, ApiError, PlaceOrderVariables, Snapshot>({
    mutationFn: ({ idempotencyKey, customerName, customerEmail, customerPhone, warehouseId, notes, items }) =>
      api.post<Order>(
        '/orders',
        { customerName, customerEmail, customerPhone, warehouseId, notes, items },
        { idempotencyKey },
      ),

    onMutate: async (variables) => {
      // Stop in-flight refetches from overwriting the optimistic state.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.stock.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.orders.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.products.all }),
      ])

      const snapshot: Snapshot = { entries: [] }

      const remember = (key: readonly unknown[], value: unknown) => snapshot.entries.push([key, value])

      const requested = new Map(variables.items.map((item) => [item.productId, item.quantity]))

      // --- 1. Stock levels: decrement the affected warehouse rows ----------
      queryClient
        .getQueriesData<StockLevel[]>({ queryKey: ['stock', 'levels'] })
        .forEach(([key, data]) => {
          if (!data) return
          remember(key, data)
          queryClient.setQueryData<StockLevel[]>(
            key,
            data.map((level) => {
              const qty = requested.get(level.productId)
              if (!qty || level.warehouseId !== variables.warehouseId) return level
              const quantity = level.quantity - qty
              return {
                ...level,
                quantity,
                available: quantity - level.reserved,
                isLow: quantity - level.reserved <= level.reorderPoint,
              }
            }),
          )
        })

      // --- 2. Product lists: same decrement, aggregate view -----------------
      queryClient
        .getQueriesData<Paginated<Product>>({ queryKey: ['products', 'list'] })
        .forEach(([key, data]) => {
          if (!data) return
          remember(key, data)
          queryClient.setQueryData<Paginated<Product>>(key, {
            ...data,
            items: data.items.map((product) => {
              const qty = requested.get(product.id)
              if (!qty) return product
              const totalStock = product.totalStock - qty
              const available = totalStock - product.totalReserved
              return {
                ...product,
                totalStock,
                available,
                isLow: available <= product.reorderPoint,
                isOutOfStock: available <= 0,
                stockByWarehouse: product.stockByWarehouse.map((row) =>
                  row.warehouseId === variables.warehouseId
                    ? { ...row, quantity: row.quantity - qty, available: row.available - qty }
                    : row,
                ),
              }
            }),
          })
        })

      // --- 3. Order lists: prepend a provisional row -----------------------
      const optimisticOrder = buildOptimisticOrder(variables)

      queryClient.getQueriesData<Paginated<Order>>({ queryKey: ['orders', 'list'] }).forEach(([key, data]) => {
        if (!data) return
        remember(key, data)
        queryClient.setQueryData<Paginated<Order>>(key, {
          ...data,
          items: [optimisticOrder, ...data.items].slice(0, data.pagination.pageSize),
          pagination: { ...data.pagination, total: data.pagination.total + 1 },
        })
      })

      return snapshot
    },

    onError: (_error, _variables, context) => {
      // Put every touched cache entry back byte-for-byte.
      context?.entries.forEach(([key, value]) => {
        queryClient.setQueryData(key, value)
      })
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

/** Prefix used to render the provisional row differently (dimmed + spinner). */
export const OPTIMISTIC_ID_PREFIX = 'optimistic-'

export function isOptimistic(order: Pick<Order, 'id'>): boolean {
  return order.id.startsWith(OPTIMISTIC_ID_PREFIX)
}

function buildOptimisticOrder(variables: PlaceOrderVariables): Order {
  const subtotal = variables.displayLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const taxTotal = Math.round(subtotal * variables.taxRate * 100) / 100

  return {
    id: `${OPTIMISTIC_ID_PREFIX}${variables.idempotencyKey}`,
    orderNumber: 'Placing…',
    status: 'CONFIRMED',
    customerName: variables.customerName,
    customerEmail: variables.customerEmail,
    customerPhone: variables.customerPhone ?? null,
    notes: variables.notes ?? null,
    subtotal: Math.round(subtotal * 100) / 100,
    taxTotal,
    totalAmount: Math.round((subtotal + taxTotal) * 100) / 100,
    itemCount: variables.displayLines.reduce((sum, line) => sum + line.quantity, 0),
    warehouse: variables.warehouseLabel,
    placedBy: variables.userLabel,
    createdAt: new Date().toISOString(),
    cancelledAt: null,
    fulfilledAt: null,
    items: variables.displayLines.map((line, index) => ({
      id: `${OPTIMISTIC_ID_PREFIX}line-${index}`,
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: Math.round(line.unitPrice * line.quantity * 100) / 100,
    })),
  }
}
