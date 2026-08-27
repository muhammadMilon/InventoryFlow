'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import { number } from '@/lib/format'
import type { Warehouse } from '@/types/api'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Field, Input, SegmentedControl } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/feedback'

/**
 * Create and edit share one modal, following the product form.
 *
 * There is deliberately no delete. A warehouse is referenced by StockLevel,
 * StockMovement and Order, so removing the row would either orphan or cascade
 * away the ledger history the audit trail is built on. Archiving is the
 * disposal route instead: an inactive site keeps every movement it ever
 * recorded and drops out of the order builder's selectable list.
 */
export function WarehouseFormModal({
  open,
  onClose,
  warehouse,
}: {
  open: boolean
  onClose: () => void
  warehouse?: Warehouse | null
}) {
  const queryClient = useQueryClient()
  const editing = Boolean(warehouse)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Bangladesh')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSettled = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
  }

  const createMutation = useMutation({
    mutationFn: (payload: { code: string; name: string; city: string; country: string }) =>
      api.post('/warehouses', payload),
    onSuccess: onSettled,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; city: string; country: string; isActive: boolean }) =>
      api.patch(`/warehouses/${warehouse?.id}`, payload),
    onSuccess: onSettled,
  })

  const mutation = editing ? updateMutation : createMutation

  useEffect(() => {
    if (!open) return
    createMutation.reset()
    updateMutation.reset()
    setErrors({})
    setCode(warehouse?.code ?? '')
    setName(warehouse?.name ?? '')
    setCity(warehouse?.city ?? '')
    setCountry(warehouse?.country ?? 'Bangladesh')
    setIsActive(warehouse?.isActive ?? true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, warehouse])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const next: Record<string, string> = {}
    // Only validated on create — the server omits `code` from the update schema.
    if (!editing && !/^[A-Z0-9-]{2,12}$/.test(code.trim().toUpperCase())) {
      next.code = '2–12 characters: A–Z, 0–9 and dashes'
    }
    if (name.trim().length < 2) next.name = 'Name is required'
    if (city.trim().length < 2) next.city = 'City is required'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      if (editing && warehouse) {
        await updateMutation.mutateAsync({
          name: name.trim(),
          city: city.trim(),
          country: country.trim(),
          isActive,
        })
        // The status change is the consequential one, so it names itself.
        const message =
          isActive === warehouse.isActive
            ? 'Warehouse updated'
            : isActive
              ? 'Warehouse restored'
              : 'Warehouse archived'
        toast.success(message, { description: `${warehouse.code} — ${name.trim()}` })
      } else {
        await createMutation.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          city: city.trim(),
          country: country.trim(),
        })
        toast.success('Warehouse created', { description: `${code.toUpperCase()} — ${name}` })
      }
      onClose()
    } catch {
      /* rendered inline */
    }
  }

  const archivingWithStock = editing && !isActive && (warehouse?.totalUnits ?? 0) > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={mutation.isPending}
      title={editing ? `Edit ${warehouse?.name}` : 'New warehouse'}
      description={
        editing
          ? 'Archiving keeps every movement on the ledger and removes the site from new orders.'
          : 'Sites start empty. Move stock in with a transfer or a purchase-receipt adjustment.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="warehouse-form" loading={mutation.isPending}>
            {editing ? 'Save changes' : 'Create warehouse'}
          </Button>
        </>
      }
    >
      <form id="warehouse-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {mutation.isError && <ErrorState error={mutation.error} compact onRetry={() => mutation.reset()} />}

        <Input
          label="Code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          error={errors.code}
          placeholder="RAJ-01"
          disabled={editing}
          hint={
            editing
              ? 'Code cannot be changed — ledger rows and shipping labels already carry it'
              : 'Short identifier shown throughout the app'
          }
          required={!editing}
          data-autofocus={!editing}
        />
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          placeholder="Rajshahi Regional Store"
          required
          data-autofocus={editing}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="City"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            error={errors.city}
            placeholder="Rajshahi"
            required
          />
          <Input label="Country" value={country} onChange={(event) => setCountry(event.target.value)} />
        </div>

        {/* Create has no status control: a site nobody can order from is not a
            useful thing to create. It only becomes a choice once one exists. */}
        {editing && (
          <Field
            label="Status"
            hint={
              archivingWithStock
                ? `This site still holds ${number(warehouse?.totalUnits ?? 0)} units. Archiving does not move them — transfer the stock out first if the site is closing.`
                : 'Archived sites stay in reports and keep their history, but cannot receive new orders.'
            }
          >
            <SegmentedControl
              label="Status"
              value={isActive ? 'active' : 'archived'}
              onChange={(value) => setIsActive(value === 'active')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </Field>
        )}
      </form>
    </Modal>
  )
}
