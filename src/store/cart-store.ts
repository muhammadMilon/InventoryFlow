'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartLine {
  productId: string
  sku: string
  name: string
  unitPrice: number
  quantity: number
  /** Snapshot of availability when the line was added — used for soft warnings. */
  available: number
}

interface CartState {
  warehouseId: string | null
  lines: CartLine[]

  setWarehouse: (warehouseId: string) => void
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  increment: (productId: string) => void
  decrement: (productId: string) => void
  remove: (productId: string) => void
  clear: () => void

  count: () => number
  subtotal: () => number
  tax: () => number
  total: () => number
  has: (productId: string) => boolean
  lineFor: (productId: string) => CartLine | undefined
}

/** Must match the server-side rate in orders.service.ts. */
export const TAX_RATE = 0.05

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * Cart/session state.
 *
 * Persisted to localStorage so a refresh mid-order does not lose the basket.
 * Only product ids, names and quantities live here — no prices are trusted from
 * this store when the order is placed. The server re-reads every unit price
 * from the database, so a tampered localStorage entry cannot change what the
 * customer is charged. The prices kept here are purely for showing a running
 * total before submission.
 *
 * Switching warehouse clears the basket: availability is per warehouse, so
 * carrying lines across sites would show stock that does not exist there.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      warehouseId: null,
      lines: [],

      setWarehouse: (warehouseId) =>
        set((state) => (state.warehouseId === warehouseId ? state : { warehouseId, lines: [] })),

      add: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.productId === line.productId)
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === line.productId
                  ? { ...l, quantity: Math.min(l.quantity + quantity, 10_000), available: line.available }
                  : l,
              ),
            }
          }
          return { lines: [...state.lines, { ...line, quantity: Math.max(1, quantity) }] }
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.productId !== productId)
              : state.lines.map((l) =>
                  l.productId === productId ? { ...l, quantity: Math.min(quantity, 10_000) } : l,
                ),
        })),

      increment: (productId) => get().setQuantity(productId, (get().lineFor(productId)?.quantity ?? 0) + 1),

      decrement: (productId) => get().setQuantity(productId, (get().lineFor(productId)?.quantity ?? 0) - 1),

      remove: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),

      clear: () => set({ lines: [] }),

      count: () => get().lines.reduce((sum, line) => sum + line.quantity, 0),

      subtotal: () => round2(get().lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)),

      tax: () => round2(get().subtotal() * TAX_RATE),

      total: () => round2(get().subtotal() + get().tax()),

      has: (productId) => get().lines.some((l) => l.productId === productId),

      lineFor: (productId) => get().lines.find((l) => l.productId === productId),
    }),
    {
      name: 'inventoryflow-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ warehouseId: state.warehouseId, lines: state.lines }),
      version: 1,
    },
  ),
)
