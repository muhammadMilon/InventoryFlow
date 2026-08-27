'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useProducts, useTransferStock, useWarehouses } from '@/lib/queries'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/feedback'

/**
 * Inter-warehouse transfer.
 *
 * Written as two balanced ledger entries (TRANSFER_OUT then TRANSFER_IN) inside
 * one transaction sharing a reference id — so the pair is always findable
 * together, and stock is never in flight in a way the ledger cannot explain.
 */
export function TransferStockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mutation = useTransferStock()
  const { data: warehouses } = useWarehouses()
  const { data: productsPage } = useProducts({ pageSize: 100 })

  const [productId, setProductId] = useState('')
  const [fromWarehouseId, setFrom] = useState('')
  const [toWarehouseId, setTo] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    mutation.reset()
    setError(null)
    setProductId('')
    setQuantity('')
    setNote('')
    setFrom(warehouses?.[0]?.id ?? '')
    setTo(warehouses?.[1]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const product = productsPage?.items.find((item) => item.id === productId)
  const sourceRow = product?.stockByWarehouse.find((row) => row.warehouseId === fromWarehouseId)
  const availableAtSource = sourceRow?.available ?? 0
  const parsed = Number(quantity)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!productId) return setError('Choose a product')
    if (!fromWarehouseId || !toWarehouseId) return setError('Choose both warehouses')
    if (fromWarehouseId === toWarehouseId) return setError('Source and destination must differ')
    if (!parsed || parsed <= 0) return setError('Enter a quantity greater than zero')
    if (parsed > availableAtSource) {
      return setError(`Only ${availableAtSource} units are available at the source warehouse`)
    }

    try {
      await mutation.mutateAsync({
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity: Math.round(parsed),
        note: note.trim() || undefined,
      })
      toast.success('Transfer recorded', {
        description: `${Math.round(parsed)} units moved`,
      })
      onClose()
    } catch {
      /* rendered inline */
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title="Transfer stock"
      description="Moves units between sites as two balanced ledger entries."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-form" loading={mutation.isPending}>
            Transfer
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {mutation.isError && <ErrorState error={mutation.error} compact onRetry={() => mutation.reset()} />}

        <Select
          label="Product"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          required
          data-autofocus
        >
          <option value="">Select a product…</option>
          {productsPage?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sku} — {item.name}
            </option>
          ))}
        </Select>

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Select label="From" value={fromWarehouseId} onChange={(event) => setFrom(event.target.value)}>
            {warehouses?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code}
              </option>
            ))}
          </Select>

          <span className="hidden pb-2.5 text-ink-300 sm:block" aria-hidden>
            <ArrowRight className="size-4" />
          </span>

          <Select label="To" value={toWarehouseId} onChange={(event) => setTo(event.target.value)}>
            {warehouses?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Quantity"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value)
            setError(null)
          }}
          error={error ?? undefined}
          hint={product ? `${availableAtSource} available at the source warehouse` : undefined}
          required
        />

        <Textarea
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. rebalancing ahead of Eid demand"
          rows={2}
        />
      </form>
    </Modal>
  )
}
