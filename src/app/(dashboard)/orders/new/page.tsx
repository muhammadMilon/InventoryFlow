'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Warehouse as WarehouseIcon,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { cn, currency, number } from '@/lib/format'
import { useProducts, useWarehouses } from '@/lib/queries'
import { useOptimisticPlaceOrder } from '@/lib/use-place-order'
import { TAX_RATE, useCartStore } from '@/store/cart-store'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/field'
import { StockBadge } from '@/components/ui/badge'
import { EmptyState, ErrorState, LiveDot, Skeleton } from '@/components/ui/feedback'
import type { StockShortfall } from '@/types/api'

export default function NewOrderPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const cart = useCartStore()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; warehouse?: string }>({})
  const [shortfalls, setShortfalls] = useState<StockShortfall[]>([])

  /**
   * One idempotency key per basket-submission attempt.
   *
   * Generated on the FIRST submit and kept until the order actually succeeds.
   * That is the whole point: a double-click, a fat-fingered Enter, or a retry
   * after a dropped connection all carry the same key, so the server returns
   * the original order instead of creating a second one. It is only rotated
   * once an order has been placed, because the next basket is a new intent.
   */
  const idempotencyKeyRef = useRef<string | null>(null)

  const { data: warehouses, isLoading: warehousesLoading } = useWarehouses()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Default to the first active warehouse if the basket has none.
  useEffect(() => {
    if (!cart.warehouseId && warehouses && warehouses.length > 0) {
      const firstActive = warehouses.find((warehouse) => warehouse.isActive) ?? warehouses[0]
      if (firstActive) cart.setWarehouse(firstActive.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouses])

  const { data: productsPage, isLoading: productsLoading } = useProducts(
    {
      search: debouncedSearch || undefined,
      warehouseId: cart.warehouseId ?? undefined,
      pageSize: 40,
    },
    { live: true },
  )

  const placeOrder = useOptimisticPlaceOrder()

  const selectedWarehouse = warehouses?.find((warehouse) => warehouse.id === cart.warehouseId)

  const availableByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const product of productsPage?.items ?? []) {
      const row = product.stockByWarehouse.find((entry) => entry.warehouseId === cart.warehouseId)
      map.set(product.id, row?.available ?? 0)
    }
    return map
  }, [productsPage, cart.warehouseId])

  /**
   * Live over-commitment check. Stock polls every 3s, so if someone else buys
   * the units in this basket the warning appears before submit — not as a
   * server rejection afterwards.
   */
  const overCommitted = cart.lines.filter((line) => {
    const available = availableByProduct.get(line.productId)
    return available !== undefined && line.quantity > available
  })

  const validate = (): boolean => {
    const next: typeof formErrors = {}
    if (customerName.trim().length < 2) next.name = 'Customer name is required'
    if (!/^\S+@\S+\.\S+$/.test(customerEmail.trim())) next.email = 'Enter a valid email address'
    if (!cart.warehouseId) next.warehouse = 'Choose a warehouse'
    setFormErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setShortfalls([])

    if (cart.lines.length === 0) {
      toast.error('The basket is empty', { description: 'Add at least one product before placing an order.' })
      return
    }
    if (!validate() || !user || !selectedWarehouse) return

    idempotencyKeyRef.current ??= crypto.randomUUID()

    try {
      const order = await placeOrder.mutateAsync({
        idempotencyKey: idempotencyKeyRef.current,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        customerPhone: customerPhone.trim() || undefined,
        warehouseId: selectedWarehouse.id,
        notes: notes.trim() || undefined,
        items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        displayLines: cart.lines,
        customerLabel: customerName.trim(),
        warehouseLabel: {
          id: selectedWarehouse.id,
          code: selectedWarehouse.code,
          name: selectedWarehouse.name,
        },
        userLabel: { id: user.id, name: user.name, email: user.email },
        taxRate: TAX_RATE,
      })

      // Success: this basket is done, so the key retires with it.
      idempotencyKeyRef.current = null
      cart.clear()

      toast.success(`Order ${order.orderNumber} placed`, {
        description: `${order.itemCount} units · ${currency(order.totalAmount)}`,
        action: { label: 'View', onClick: () => router.push('/orders') },
      })

      router.push('/orders')
    } catch (caught) {
      // The optimistic decrements have already been rolled back by the mutation.
      if (caught instanceof ApiError) {
        if (caught.code === 'INSUFFICIENT_STOCK') {
          const details = caught.details as { shortfalls?: StockShortfall[] } | undefined
          setShortfalls(details?.shortfalls ?? [])
          toast.error('Not enough stock', {
            description: 'Someone else took these units. Adjust the quantities and try again.',
          })
          return
        }
        if (caught.code === 'IDEMPOTENT_REPLAY_IN_PROGRESS') {
          toast.info('Already submitting', { description: 'This order is being processed — hold on.' })
          return
        }
        toast.error('Could not place the order', { description: caught.message })
      }
    }
  }

  const products = productsPage?.items ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/orders"
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            aria-label="Back to orders"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">New order</h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-500">
              Stock is decremented atomically when you submit
              <span aria-hidden>·</span>
              <LiveDot label="live availability" />
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        {/* ---------------- Catalogue ---------------- */}
        <div className="space-y-4">
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              <Select
                value={cart.warehouseId ?? ''}
                onChange={(event) => {
                  if (cart.lines.length > 0) {
                    const confirmed = window.confirm(
                      'Changing warehouse clears the basket, because availability is per site. Continue?',
                    )
                    if (!confirmed) return
                  }
                  cart.setWarehouse(event.target.value)
                  setFormErrors((current) => ({ ...current, warehouse: undefined }))
                }}
                error={formErrors.warehouse}
                aria-label="Fulfilment warehouse"
                className="w-[220px]"
                disabled={warehousesLoading}
              >
                <option value="">Select warehouse…</option>
                {warehouses?.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id} disabled={!warehouse.isActive}>
                    {warehouse.code} — {warehouse.name}
                    {warehouse.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </Select>

              <div className="min-w-[200px] flex-1">
                <Input
                  placeholder="Search the catalogue…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  leftIcon={<Search className="size-4" />}
                  aria-label="Search products"
                />
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Catalogue"
              description={
                selectedWarehouse
                  ? `Availability at ${selectedWarehouse.name}`
                  : 'Choose a warehouse to see availability'
              }
              icon={<Package className="size-4" />}
            />

            {productsLoading ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-[86px] w-full rounded-lg" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                icon={<Package className="size-5" />}
                title="No products found"
                description="Try a different search term."
              />
            ) : (
              <div className="grid max-h-[560px] gap-3 overflow-y-auto p-4 sm:grid-cols-2">
                {products.map((product) => {
                  const available = availableByProduct.get(product.id) ?? 0
                  const inCart = cart.lineFor(product.id)
                  const disabled = available <= 0 || !cart.warehouseId

                  return (
                    <div
                      key={product.id}
                      data-testid="catalogue-card"
                      data-sku={product.sku}
                      data-available={available}
                      data-out-of-stock={disabled ? 'true' : 'false'}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        inCart ? 'border-brand-300 bg-brand-50/50' : 'border-ink-200 bg-white hover:border-ink-300',
                        disabled && 'opacity-60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium text-ink-900">{product.name}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-400">{product.sku}</p>
                        </div>
                        <StockBadge available={available} reorderPoint={product.reorderPoint} />
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[15px] font-semibold text-ink-900 tnum">
                            {currency(product.unitPrice)}
                          </span>
                          <span className="ml-2 text-[11.5px] text-ink-400 tnum">{available} available</span>
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-1 rounded-lg border border-brand-300 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => cart.decrement(product.id)}
                              className="flex size-6 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
                              aria-label={`Remove one ${product.name}`}
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="min-w-[24px] text-center text-[13px] font-semibold text-ink-900 tnum">
                              {inCart.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => cart.increment(product.id)}
                              disabled={inCart.quantity >= available}
                              className="flex size-6 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30"
                              aria-label={`Add one ${product.name}`}
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="subtle"
                            disabled={disabled}
                            onClick={() =>
                              cart.add({
                                productId: product.id,
                                sku: product.sku,
                                name: product.name,
                                unitPrice: product.unitPrice,
                                available,
                              })
                            }
                            leftIcon={<Plus className="size-3.5" />}
                          >
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ---------------- Basket ---------------- */}
        <div className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader
              title="Basket"
              description={`${cart.count()} ${cart.count() === 1 ? 'unit' : 'units'} · ${cart.lines.length} ${cart.lines.length === 1 ? 'line' : 'lines'}`}
              icon={<ShoppingCart className="size-4" />}
              action={
                cart.lines.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => cart.clear()}>
                    Clear
                  </Button>
                ) : undefined
              }
            />

            {cart.lines.length === 0 ? (
              <EmptyState
                icon={<ShoppingCart className="size-5" />}
                title="Basket is empty"
                description="Add products from the catalogue to build the order."
                className="py-10"
              />
            ) : (
              <ul data-testid="basket" className="max-h-[280px] divide-y divide-ink-100 overflow-y-auto">
                {cart.lines.map((line) => {
                  const available = availableByProduct.get(line.productId)
                  const over = available !== undefined && line.quantity > available

                  return (
                    <li key={line.productId} data-testid="basket-line" data-sku={line.sku} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink-900">{line.name}</p>
                          <p className="mt-0.5 text-[11.5px] text-ink-400 tnum">
                            {currency(line.unitPrice)} each
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cart.remove(line.productId)}
                          className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-critical-50 hover:text-critical-700"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-ink-200 p-0.5">
                          <button
                            type="button"
                            onClick={() => cart.decrement(line.productId)}
                            className="flex size-6 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) =>
                              cart.setQuantity(line.productId, Number(event.target.value) || 0)
                            }
                            className="w-11 border-0 bg-transparent p-0 text-center text-[13px] font-semibold text-ink-900 tnum focus:outline-none"
                            aria-label={`Quantity of ${line.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => cart.increment(line.productId)}
                            className="flex size-6 items-center justify-center rounded text-ink-500 hover:bg-ink-100"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>

                        <span className="text-[13px] font-semibold text-ink-900 tnum">
                          {currency(line.unitPrice * line.quantity)}
                        </span>
                      </div>

                      {over && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-critical-700">
                          <AlertTriangle className="size-3" />
                          Only {available} available now
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {cart.lines.length > 0 && (
              <div className="space-y-1.5 border-t border-ink-100 px-4 py-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-ink-500">Subtotal</span>
                  <span className="text-ink-700 tnum">{currency(cart.subtotal(), true)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">VAT (5%)</span>
                  <span className="text-ink-700 tnum">{currency(cart.tax(), true)}</span>
                </div>
                <div className="flex justify-between border-t border-ink-200 pt-1.5">
                  <span className="font-semibold text-ink-900">Total</span>
                  <span className="text-[15px] font-semibold text-ink-900 tnum">
                    {currency(cart.total(), true)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* ---- Shortfall report from a failed submit ---- */}
          {shortfalls.length > 0 && (
            <div
              data-testid="shortfall-panel"
              className="rounded-[var(--radius-card)] border border-critical-500/25 bg-critical-50 p-4"
            >
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-critical-700">
                <AlertTriangle className="size-4" />
                Stock ran out while you were ordering
              </p>
              <ul className="mt-2 space-y-1">
                {shortfalls.map((shortfall) => (
                  <li key={shortfall.productId} className="flex justify-between text-[12px] text-critical-700">
                    <span className="truncate pr-2">{shortfall.name}</span>
                    <span className="shrink-0 font-semibold tnum">
                      wanted {shortfall.requested}, have {shortfall.available}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] leading-relaxed text-critical-700/80">
                Nothing was charged and no stock moved — the whole order was rolled back. Reduce the
                quantities and submit again.
              </p>
            </div>
          )}

          {/* ---- Customer + submit ---- */}
          <Card>
            <CardHeader title="Customer" icon={<WarehouseIcon className="size-4" />} />
            <form onSubmit={onSubmit} className="space-y-3 px-4 py-4" noValidate>
              <Input
                label="Name"
                value={customerName}
                onChange={(event) => {
                  setCustomerName(event.target.value)
                  setFormErrors((current) => ({ ...current, name: undefined }))
                }}
                error={formErrors.name}
                placeholder="Rahim Traders"
                required
              />
              <Input
                label="Email"
                type="email"
                value={customerEmail}
                onChange={(event) => {
                  setCustomerEmail(event.target.value)
                  setFormErrors((current) => ({ ...current, email: undefined }))
                }}
                error={formErrors.email}
                placeholder="orders@rahimtraders.com.bd"
                required
              />
              <Input
                label="Phone"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="+8801711000101"
              />
              <Textarea
                label="Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Delivery instructions, PO reference…"
                rows={2}
              />

              {placeOrder.isError && placeOrder.error?.code !== 'INSUFFICIENT_STOCK' && (
                <ErrorState error={placeOrder.error} compact />
              )}

              {overCommitted.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-warn-500/25 bg-warn-50 px-3 py-2">
                  <AlertTriangle className="mt-px size-3.5 shrink-0 text-warn-700" aria-hidden />
                  <p className="text-[11.5px] leading-relaxed text-warn-700">
                    {overCommitted.length} {overCommitted.length === 1 ? 'line exceeds' : 'lines exceed'}{' '}
                    what is on the shelf right now. Submitting will be rejected by the server.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                data-testid="place-order"
                fullWidth
                size="lg"
                loading={placeOrder.isPending}
                disabled={cart.lines.length === 0}
                leftIcon={placeOrder.isPending ? undefined : <Zap className="size-4" />}
              >
                {placeOrder.isPending ? 'Placing order…' : `Place order · ${currency(cart.total())}`}
              </Button>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-400">
                <CheckCircle2 className="mt-px size-3 shrink-0 text-good-500" aria-hidden />
                Safe to double-click: the request carries an idempotency key, so a duplicate submit returns
                the same order rather than creating a second one.
              </p>
            </form>
          </Card>

          {selectedWarehouse && (
            <p className="px-1 text-[11.5px] text-ink-400">
              Fulfilling from <span className="font-medium text-ink-600">{selectedWarehouse.name}</span> ·{' '}
              {number(selectedWarehouse.totalUnits)} units on site
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
