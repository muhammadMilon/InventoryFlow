'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { useCreateProduct, useUpdateProduct } from '@/lib/queries'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/feedback'
import type { Category, Product, Warehouse } from '@/types/api'

interface Props {
  open: boolean
  onClose: () => void
  product?: Product
  warehouses: Warehouse[]
  categories: Category[]
}

interface FormState {
  sku: string
  name: string
  description: string
  categoryId: string
  unitPrice: string
  costPrice: string
  reorderPoint: string
  reorderQty: string
  openingWarehouseId: string
  openingQty: string
}

const EMPTY: FormState = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  unitPrice: '',
  costPrice: '',
  reorderPoint: '10',
  reorderQty: '50',
  openingWarehouseId: '',
  openingQty: '',
}

/**
 * Create/edit form. Validation mirrors the Zod schema on the API — the client
 * copy exists to give instant feedback, not to be the authority. The server
 * revalidates everything, so a bypassed form cannot write a bad row.
 */
export function ProductFormModal({ open, onClose, product, warehouses, categories }: Props) {
  const editing = Boolean(product)
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const mutation = editing ? updateMutation : createMutation

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    mutation.reset()

    if (product) {
      setForm({
        sku: product.sku,
        name: product.name,
        description: product.description ?? '',
        categoryId: product.category?.id ?? '',
        unitPrice: String(product.unitPrice),
        costPrice: String(product.costPrice),
        reorderPoint: String(product.reorderPoint),
        reorderQty: String(product.reorderQty),
        openingWarehouseId: '',
        openingQty: '',
      })
    } else {
      setForm({ ...EMPTY, openingWarehouseId: warehouses[0]?.id ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}

    // Blank is legal on create — the server mints the SKU. Only a value the
    // admin actually typed has to satisfy the shape.
    const typedSku = form.sku.trim().toUpperCase()
    if (!editing && typedSku && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(typedSku)) {
      next.sku = '3–32 characters: A–Z, 0–9 and dashes'
    }

    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters'

    const unitPrice = Number(form.unitPrice)
    const costPrice = Number(form.costPrice)

    if (!form.unitPrice || Number.isNaN(unitPrice) || unitPrice < 0) next.unitPrice = 'Enter a valid price'
    if (!form.costPrice || Number.isNaN(costPrice) || costPrice < 0) next.costPrice = 'Enter a valid cost'
    if (!next.unitPrice && !next.costPrice && unitPrice < costPrice) {
      next.unitPrice = 'Selling price cannot be below cost price'
    }

    if (Number(form.reorderPoint) < 0) next.reorderPoint = 'Cannot be negative'
    if (Number(form.reorderQty) < 0) next.reorderQty = 'Cannot be negative'

    if (!editing && form.openingQty && Number(form.openingQty) > 0 && !form.openingWarehouseId) {
      next.openingWarehouseId = 'Choose where the opening stock sits'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    try {
      if (editing && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          categoryId: form.categoryId || null,
          unitPrice: Number(form.unitPrice),
          costPrice: Number(form.costPrice),
          reorderPoint: Number(form.reorderPoint),
          reorderQty: Number(form.reorderQty),
        })
        toast.success('Product updated', { description: form.name })
      } else {
        const openingQty = Number(form.openingQty)
        const created = await createMutation.mutateAsync({
          // Omitted rather than sent blank, so the server generates one.
          sku: form.sku.trim().toUpperCase() || undefined,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          categoryId: form.categoryId || undefined,
          unitPrice: Number(form.unitPrice),
          costPrice: Number(form.costPrice),
          reorderPoint: Number(form.reorderPoint),
          reorderQty: Number(form.reorderQty),
          initialStock:
            openingQty > 0 && form.openingWarehouseId
              ? [{ warehouseId: form.openingWarehouseId, quantity: openingQty }]
              : undefined,
        })
        // The SKU comes back from the response, not the form: when it was left
        // blank this is the admin's first sight of the generated one.
        toast.success(`Product created — ${created.sku}`, {
          description:
            openingQty > 0
              ? `${form.name} with ${openingQty} units of opening stock`
              : `${form.name} added to the catalogue`,
        })
      }
      onClose()
    } catch (caught) {
      // Field-level conflicts get pinned to the field; everything else is shown
      // in the banner at the top of the form.
      if (caught instanceof ApiError && caught.code === 'CONFLICT' && caught.message.includes('SKU')) {
        setErrors({ sku: caught.message })
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title={editing ? `Edit ${product?.name}` : 'New product'}
      description={
        editing
          ? 'Changes are recorded in the audit log with your name against them.'
          : 'Opening stock is written as an INITIAL_LOAD ledger entry, so the ledger balances from row one.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={mutation.isPending}>
            {editing ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {mutation.isError && !errors.sku && (
          <ErrorState error={mutation.error} compact onRetry={() => mutation.reset()} />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="SKU"
            value={form.sku}
            onChange={(event) => set('sku', event.target.value.toUpperCase())}
            error={errors.sku}
            placeholder="Leave blank to auto-generate"
            disabled={editing}
            hint={editing ? 'SKU cannot be changed after creation' : 'Auto-generated from category if empty'}
            data-autofocus
          />
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(event) => set('categoryId', event.target.value)}
          >
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Product name"
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name}
          placeholder="Nimbus Wireless Keyboard"
          required
        />

        <Textarea
          label="Description"
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
          placeholder="Optional — shown on the product detail view."
          rows={2}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Selling price (৳)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.unitPrice}
            onChange={(event) => set('unitPrice', event.target.value)}
            error={errors.unitPrice}
            required
          />
          <Input
            label="Cost price (৳)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.costPrice}
            onChange={(event) => set('costPrice', event.target.value)}
            error={errors.costPrice}
            hint="Used to value inventory at cost"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Reorder point"
            type="number"
            min="0"
            value={form.reorderPoint}
            onChange={(event) => set('reorderPoint', event.target.value)}
            error={errors.reorderPoint}
            hint="Flag as low at or below this level"
          />
          <Input
            label="Reorder quantity"
            type="number"
            min="0"
            value={form.reorderQty}
            onChange={(event) => set('reorderQty', event.target.value)}
            error={errors.reorderQty}
            hint="Suggested purchase size"
          />
        </div>

        {!editing && (
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
            <p className="text-[13px] font-medium text-ink-800">Opening stock (optional)</p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Recorded as a ledger movement, not a bare number — so it reconciles like every other change.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Select
                label="Warehouse"
                value={form.openingWarehouseId}
                onChange={(event) => set('openingWarehouseId', event.target.value)}
                error={errors.openingWarehouseId}
              >
                <option value="">Select a warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Quantity"
                type="number"
                min="0"
                value={form.openingQty}
                onChange={(event) => set('openingQty', event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
