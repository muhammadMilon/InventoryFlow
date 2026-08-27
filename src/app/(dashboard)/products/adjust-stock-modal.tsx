'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn, number } from '@/lib/format'
import { useAdjustStock } from '@/lib/queries'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/feedback'
import type { Product, Warehouse } from '@/types/api'

const REASONS = [
  { value: 'PURCHASE_RECEIPT', label: 'Purchase receipt (goods in)' },
  { value: 'STOCK_TAKE', label: 'Stock take / cycle count' },
  { value: 'DAMAGED', label: 'Damaged or written off' },
  { value: 'RETURN', label: 'Customer return' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual correction' },
] as const

type Mode = 'relative' | 'absolute'

/**
 * Admin stock adjustment.
 *
 * Two modes, because they are genuinely different operations:
 *  - relative  — "12 units arrived" / "3 were damaged"
 *  - absolute  — "the shelf actually holds 47" (a stock take)
 *
 * The API takes either `delta` or `setTo` and computes the other, so the ledger
 * always stores a signed delta and a resulting balance regardless of how the
 * user expressed the change.
 */
export function AdjustStockModal({
  open,
  onClose,
  product,
  warehouses,
}: {
  open: boolean
  onClose: () => void
  product?: Product
  warehouses: Warehouse[]
}) {
  const mutation = useAdjustStock()

  const [warehouseId, setWarehouseId] = useState('')
  const [mode, setMode] = useState<Mode>('relative')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('PURCHASE_RECEIPT')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    mutation.reset()
    setError(null)
    setAmount('')
    setNote('')
    setMode('relative')
    setDirection(1)
    setReason('PURCHASE_RECEIPT')
    setWarehouseId(product?.stockByWarehouse[0]?.warehouseId ?? warehouses[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product])

  const currentRow = product?.stockByWarehouse.find((row) => row.warehouseId === warehouseId)
  const currentQty = currentRow?.quantity ?? 0
  const parsed = Number(amount)
  const validAmount = amount !== '' && !Number.isNaN(parsed) && parsed >= 0

  const resultingQty = !validAmount
    ? currentQty
    : mode === 'absolute'
      ? Math.round(parsed)
      : currentQty + direction * Math.round(parsed)

  const delta = resultingQty - currentQty

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!product || !warehouseId) return
    if (!validAmount || Math.round(parsed) === 0) {
      setError('Enter a quantity greater than zero')
      return
    }
    if (delta === 0) {
      setError('That would leave the stock unchanged')
      return
    }
    if (resultingQty < 0) {
      setError(`Cannot remove ${Math.abs(delta)} units — only ${currentQty} are on hand`)
      return
    }

    try {
      await mutation.mutateAsync({
        productId: product.id,
        warehouseId,
        ...(mode === 'absolute' ? { setTo: resultingQty } : { delta }),
        reason,
        note: note.trim() || undefined,
      })

      toast.success('Stock adjusted', {
        description: `${product.name}: ${currentQty} → ${resultingQty} (${delta > 0 ? '+' : ''}${delta})`,
      })
      onClose()
    } catch {
      /* surfaced by mutation.isError below */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title="Adjust stock"
      description={product ? `${product.name} · ${product.sku}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="adjust-form"
            loading={mutation.isPending}
            disabled={!validAmount || delta === 0}
          >
            Apply adjustment
          </Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
          <ShieldCheck className="mt-px size-4 shrink-0 text-brand-600" aria-hidden />
          <p className="text-[12px] leading-relaxed text-brand-800">
            Admin action. This writes a ledger movement <em>and</em> an audit entry in the same transaction —
            your name, IP and the before/after values are recorded permanently.
          </p>
        </div>

        {mutation.isError && <ErrorState error={mutation.error} compact onRetry={() => mutation.reset()} />}

        <Select
          label="Warehouse"
          value={warehouseId}
          onChange={(event) => setWarehouseId(event.target.value)}
          required
          data-autofocus
        >
          {warehouses.map((warehouse) => {
            const row = product?.stockByWarehouse.find((entry) => entry.warehouseId === warehouse.id)
            return (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.name} ({row?.quantity ?? 0} on hand)
              </option>
            )
          })}
        </Select>

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'relative', label: 'Add / remove', hint: 'Goods in, damage, returns' },
              { value: 'absolute', label: 'Set exact count', hint: 'Stock take result' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                mode === option.value
                  ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-500/15'
                  : 'border-ink-200 bg-white hover:border-ink-300',
              )}
            >
              <span
                className={cn(
                  'block text-[13px] font-semibold',
                  mode === option.value ? 'text-brand-700' : 'text-ink-800',
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-500">{option.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          {mode === 'relative' && (
            <div className="flex shrink-0 gap-1 pb-0.5">
              <button
                type="button"
                onClick={() => setDirection(1)}
                aria-pressed={direction === 1}
                aria-label="Add stock"
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg border transition-colors',
                  direction === 1
                    ? 'border-good-500/40 bg-good-50 text-good-700'
                    : 'border-ink-200 text-ink-400 hover:border-ink-300',
                )}
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setDirection(-1)}
                aria-pressed={direction === -1}
                aria-label="Remove stock"
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg border transition-colors',
                  direction === -1
                    ? 'border-critical-500/40 bg-critical-50 text-critical-700'
                    : 'border-ink-200 text-ink-400 hover:border-ink-300',
                )}
              >
                <ArrowDown className="size-4" />
              </button>
            </div>
          )}

          <div className="flex-1">
            <Input
              label={mode === 'absolute' ? 'Counted quantity' : 'Quantity'}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setError(null)
              }}
              error={error ?? undefined}
              placeholder="0"
              required
            />
          </div>
        </div>

        <Select
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as typeof reason)}
          hint="Stored on the ledger entry — this is what makes the audit trail readable months later."
        >
          {REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Textarea
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. GRN-4471, water damage in transit"
          rows={2}
        />

        {/* Preview */}
        <div className="rounded-lg border border-ink-200 bg-ink-50/70 p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-600">
            <ClipboardCheck className="size-3.5" />
            Result
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[22px] font-semibold text-ink-400 tnum">{number(currentQty)}</span>
            <span className="text-ink-300" aria-hidden>
              →
            </span>
            <span
              className={cn(
                'text-[22px] font-semibold tnum',
                delta > 0 ? 'text-good-700' : delta < 0 ? 'text-critical-700' : 'text-ink-400',
              )}
            >
              {number(resultingQty)}
            </span>
            {delta !== 0 && validAmount && (
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[12px] font-semibold tnum',
                  delta > 0 ? 'bg-good-50 text-good-700' : 'bg-critical-50 text-critical-700',
                )}
              >
                {delta > 0 ? '+' : ''}
                {number(delta)}
              </span>
            )}
          </div>
          {product && resultingQty <= product.reorderPoint && (
            <p className="mt-2 text-[12px] font-medium text-serious-700">
              This leaves the product at or below its reorder point of {product.reorderPoint}.
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
