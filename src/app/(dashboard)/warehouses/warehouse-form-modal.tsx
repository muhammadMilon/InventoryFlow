'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/feedback'

export function WarehouseFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('Bangladesh')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (payload: { code: string; name: string; city: string; country: string }) =>
      api.post('/warehouses', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })

  useEffect(() => {
    if (!open) return
    mutation.reset()
    setErrors({})
    setCode('')
    setName('')
    setCity('')
    setCountry('Bangladesh')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const next: Record<string, string> = {}
    if (!/^[A-Z0-9-]{2,12}$/.test(code.trim().toUpperCase())) {
      next.code = '2–12 characters: A–Z, 0–9 and dashes'
    }
    if (name.trim().length < 2) next.name = 'Name is required'
    if (city.trim().length < 2) next.city = 'City is required'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    try {
      await mutation.mutateAsync({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        city: city.trim(),
        country: country.trim(),
      })
      toast.success('Warehouse created', { description: `${code.toUpperCase()} — ${name}` })
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
      title="New warehouse"
      description="Sites start empty. Move stock in with a transfer or a purchase-receipt adjustment."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="warehouse-form" loading={mutation.isPending}>
            Create warehouse
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
          hint="Short identifier shown throughout the app"
          required
          data-autofocus
        />
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          placeholder="Rajshahi Regional Store"
          required
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
      </form>
    </Modal>
  )
}
