'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Boxes, MapPin, Plus, Warehouse as WarehouseIcon } from 'lucide-react'
import { currency, number } from '@/lib/format'
import { useWarehouses } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { WarehouseChart } from '@/components/charts/breakdown-charts'
import { WarehouseFormModal } from './warehouse-form-modal'

export default function WarehousesPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN')
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useWarehouses()

  const totals = {
    units: data?.reduce((sum, warehouse) => sum + warehouse.totalUnits, 0) ?? 0,
    value: data?.reduce((sum, warehouse) => sum + warehouse.stockValue, 0) ?? 0,
    low: data?.reduce((sum, warehouse) => sum + warehouse.lowStockCount, 0) ?? 0,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink-900">Warehouses</h1>
          <p className="mt-1 text-sm text-ink-500">
            {data
              ? `${data.length} sites holding ${number(totals.units)} units worth ${currency(totals.value)}`
              : 'Loading sites…'}
          </p>
        </div>

        {isAdmin && (
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
            New warehouse
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[196px] w-full rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data?.map((warehouse) => (
              <Card key={warehouse.id} className="flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <WarehouseIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-ink-900">{warehouse.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
                        <MapPin className="size-3" />
                        {warehouse.city}, {warehouse.country}
                      </p>
                    </div>
                  </div>
                  <Badge tone={warehouse.isActive ? 'good' : 'neutral'} dot>
                    {warehouse.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
                  {[
                    { label: 'Units on hand', value: number(warehouse.totalUnits) },
                    { label: 'Distinct SKUs', value: number(warehouse.skuCount) },
                    { label: 'Stock value', value: currency(warehouse.stockValue) },
                    { label: 'Orders shipped', value: number(warehouse.orderCount) },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-[11px] uppercase tracking-wide text-ink-400">{stat.label}</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-ink-900 tnum">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3">
                  <span className="font-mono text-[11.5px] font-medium text-ink-500">{warehouse.code}</span>

                  {warehouse.lowStockCount > 0 ? (
                    <Link
                      href={`/stock?filter=low`}
                      className="inline-flex items-center gap-1 rounded-md bg-serious-50 px-2 py-1 text-[11.5px] font-semibold text-serious-700 transition-colors hover:bg-serious-50/70"
                    >
                      <AlertTriangle className="size-3" />
                      {warehouse.lowStockCount} low
                    </Link>
                  ) : (
                    <span className="text-[11.5px] font-medium text-good-700">All stocked</span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {data && data.length > 0 && <WarehouseChart data={mapToUtilisation(data)} height={280} />}

          <Card>
            <CardHeader
              title="Why stock lives per warehouse"
              description="A design note, since it drives most of the schema."
              icon={<Boxes className="size-4" />}
            />
            <div className="space-y-2.5 px-5 py-4 text-[13px] leading-relaxed text-ink-600">
              <p>
                Quantity is never a column on <code className="rounded bg-ink-100 px-1 py-0.5 text-[12px]">Product</code>.
                A product exists in many sites at once, so the on-hand figure belongs to the{' '}
                <code className="rounded bg-ink-100 px-1 py-0.5 text-[12px]">StockLevel</code> join entity,
                keyed uniquely by (product, warehouse).
              </p>
              <p>
                That normalisation is what makes the atomic decrement possible: the conditional{' '}
                <code className="rounded bg-ink-100 px-1 py-0.5 text-[12px]">UPDATE … WHERE quantity ≥ n</code>{' '}
                targets exactly one row, so Postgres can lock it and serialise two concurrent orders for the
                last unit. A denormalised total would need a lock on the product row and would still be wrong
                the moment two warehouses ship at once.
              </p>
            </div>
          </Card>
        </>
      )}

      <WarehouseFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function mapToUtilisation(warehouses: NonNullable<ReturnType<typeof useWarehouses>['data']>) {
  return warehouses.map((warehouse) => ({
    warehouseId: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    city: warehouse.city,
    units: warehouse.totalUnits,
    skus: warehouse.skuCount,
    stockValue: warehouse.stockValue,
    lowStock: warehouse.lowStockCount,
    orders: warehouse.orderCount,
  }))
}
