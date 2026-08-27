'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  ClipboardList,
  OctagonAlert,
  PackageSearch,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { compactCurrency, currency, formatDate, number, relativeTime } from '@/lib/format'
import { useDashboard, useVelocity } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { StatTile } from '@/components/ui/stat-tile'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/field'
import { ChartSkeleton, ErrorState, LiveDot, Skeleton } from '@/components/ui/feedback'
import { Badge, UrgencyBadge } from '@/components/ui/badge'
import { SalesTrendChart } from '@/components/charts/sales-trend-chart'
import { MovementFlowChart } from '@/components/charts/movement-flow-chart'
import { TopProductsChart } from '@/components/charts/top-products-chart'
import { CategoryDonut, OrderStatusDonut, WarehouseChart } from '@/components/charts/breakdown-charts'
import { DaysOfCoverChart, VelocityScatter } from '@/components/charts/stock-risk-charts'

const RANGES = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
]

export default function DashboardPage() {
  const [days, setDays] = useState(30)
  const user = useAuthStore((state) => state.user)

  const { data, isLoading, isError, error, refetch, dataUpdatedAt, isFetching } = useDashboard(days)
  const { data: velocity } = useVelocity(days, 60)

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />
  }

  const summary = data?.summary
  const revenueSpark = data?.salesTrend.map((point) => point.revenue) ?? []
  const orderSpark = data?.salesTrend.map((point) => point.orders) ?? []

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink-900 sm:text-xl">
            {greeting()}, {user?.name.split(' ')[0] ?? 'there'}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-500 sm:text-sm">
            Trading summary for the last {days} days
            {dataUpdatedAt > 0 && (
              <>
                <span aria-hidden>·</span>
                <LiveDot label={`updated ${relativeTime(new Date(dataUpdatedAt))}`} active={isFetching} />
              </>
            )}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <SegmentedControl
            value={days}
            onChange={setDays}
            options={RANGES}
            label="Time range"
            className="w-full xs:w-auto xs:min-w-0 xs:flex-1 sm:flex-none"
          />
          <Link href="/orders/new" className="shrink-0">
            <Button size="sm" leftIcon={<ClipboardList className="size-3.5" />}>
              New order
            </Button>
          </Link>
        </div>
      </div>

      {/* ---- KPI row ---- */}
      <section className="grid gap-3 xs:grid-cols-2 sm:gap-4 xl:grid-cols-4" aria-label="Key metrics">
        <StatTile
          label={`Revenue · ${days}d`}
          value={summary ? compactCurrency(summary.revenue30d) : '—'}
          change={summary?.revenueChangePct}
          sub="vs previous period"
          icon={<Banknote className="size-4" />}
          sparkline={revenueSpark}
          loading={isLoading}
        />
        <StatTile
          label={`Orders · ${days}d`}
          value={summary ? number(summary.orders30d) : '—'}
          change={summary?.orderChangePct}
          sub={summary ? `${summary.openOrders} still open` : undefined}
          icon={<ClipboardList className="size-4" />}
          sparkline={orderSpark}
          loading={isLoading}
        />
        <StatTile
          label="Stock value"
          value={summary ? compactCurrency(summary.stockValue) : '—'}
          sub={summary ? `${number(summary.totalUnits)} units on hand` : undefined}
          icon={<Boxes className="size-4" />}
          loading={isLoading}
        />
        <StatTile
          label="Needs attention"
          value={summary ? number(summary.lowStockCount + summary.outOfStockCount) : '—'}
          sub={
            summary
              ? `${summary.outOfStockCount} out of stock · ${summary.lowStockCount} low`
              : undefined
          }
          icon={<AlertTriangle className="size-4" />}
          tone={
            summary && summary.outOfStockCount > 0
              ? 'critical'
              : summary && summary.lowStockCount > 0
                ? 'warn'
                : 'good'
          }
          loading={isLoading}
        />
      </section>

      {/* ---- Out-of-stock banner ---- */}
      {summary && summary.outOfStockCount > 0 && (
        <Link
          href="/stock?filter=low"
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-critical-500/25 bg-critical-50 px-3 py-3 transition-colors hover:bg-critical-50/70 sm:px-4"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-critical-700">
            <OctagonAlert className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-critical-700">
              {summary.outOfStockCount} {summary.outOfStockCount === 1 ? 'product is' : 'products are'} out of
              stock
            </span>
            <span className="mt-0.5 block text-[12px] text-critical-700/80">
              Every order for these lines is a lost sale. Review the restock plan.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-critical-700" aria-hidden />
        </Link>
      )}

      {/* ---- Primary charts ---- */}
      <section className="grid gap-3 sm:gap-4 xl:grid-cols-3" aria-label="Sales performance">
        <div className="min-w-0 xl:col-span-2">
          {isLoading ? (
            <Card>
              <CardHeader title="Revenue trend" />
              <ChartSkeleton height={280} />
            </Card>
          ) : (
            <SalesTrendChart data={data?.salesTrend ?? []} />
          )}
        </div>

        <div className="min-w-0">
          {isLoading ? (
            <Card>
              <CardHeader title="Order pipeline" />
              <ChartSkeleton height={240} />
            </Card>
          ) : (
            <OrderStatusDonut data={data?.orderStatus ?? []} />
          )}
        </div>
      </section>

      <section className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2" aria-label="Stock movement and best sellers">
        {isLoading ? (
          <Card>
            <CardHeader title="Stock movement" />
            <ChartSkeleton height={260} />
          </Card>
        ) : (
          <MovementFlowChart data={data?.movementFlow ?? []} />
        )}

        {isLoading ? (
          <Card>
            <CardHeader title="Best sellers" />
            <ChartSkeleton height={300} />
          </Card>
        ) : (
          <TopProductsChart data={data?.topProducts ?? []} />
        )}
      </section>

      <section className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2" aria-label="Inventory distribution">
        {isLoading ? (
          <Card>
            <CardHeader title="Stock value by category" />
            <ChartSkeleton height={240} />
          </Card>
        ) : (
          <CategoryDonut data={data?.categories ?? []} />
        )}

        {isLoading ? (
          <Card>
            <CardHeader title="Stock by warehouse" />
            <ChartSkeleton height={250} />
          </Card>
        ) : (
          <WarehouseChart data={data?.warehouses ?? []} />
        )}
      </section>

      <section className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2" aria-label="Stock risk">
        {isLoading ? (
          <Card>
            <CardHeader title="Days of cover" />
            <ChartSkeleton height={320} />
          </Card>
        ) : (
          <DaysOfCoverChart data={data?.lowStock ?? []} />
        )}

        {velocity ? (
          <VelocityScatter data={velocity} />
        ) : (
          <Card>
            <CardHeader title="Demand vs cover" />
            <ChartSkeleton height={320} />
          </Card>
        )}
      </section>

      {/* ---- Alert feed + AI teaser ---- */}
      <section className="grid gap-3 sm:gap-4 xl:grid-cols-3" aria-label="Alerts">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader
            title="Low stock alerts"
            description="Ordered by urgency — soonest to run out first"
            icon={<PackageSearch className="size-4" />}
            action={
              <Link href="/stock?filter=low">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="size-3.5" />}>
                  View all
                </Button>
              </Link>
            }
          />

          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (data?.lowStock.length ?? 0) === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] font-medium text-ink-800">Everything is above its reorder point</p>
              <p className="mt-1 text-[12.5px] text-ink-500">No restocking needed right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data?.lowStock.slice(0, 6).map((alert) => (
                <li
                  key={`${alert.productId}-${alert.warehouseId}`}
                  className="flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-brand-50/40 sm:gap-3 sm:px-5"
                >
                  <span
                    className={
                      'flex size-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tnum ' +
                      (alert.severity === 'OUT_OF_STOCK'
                        ? 'bg-critical-50 text-critical-700'
                        : alert.severity === 'CRITICAL'
                          ? 'bg-serious-50 text-serious-700'
                          : 'bg-warn-50 text-warn-700')
                    }
                  >
                    {alert.available}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink-900">{alert.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
                      <span className="font-mono text-[11px]">{alert.sku}</span>
                      <span aria-hidden>·</span>
                      <span>{alert.warehouseCode}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {alert.daysOfCover !== null
                          ? `${alert.daysOfCover} days of cover`
                          : 'no recent sales'}
                      </span>
                    </p>
                  </div>

                  <UrgencyBadge
                    urgency={
                      alert.severity === 'OUT_OF_STOCK'
                        ? 'CRITICAL'
                        : alert.severity === 'CRITICAL'
                          ? 'HIGH'
                          : 'MEDIUM'
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="relative flex-1 bg-gradient-to-br from-brand-50 via-white to-white p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700">
              <Sparkles className="size-3" />
              AI restock brief
            </span>

            <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em] text-ink-900">
              Turn velocity into a purchase order
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
              Gemini reads current stock, sales velocity and days of cover, then writes the restock plan in
              plain language. Quantities are computed by the system — the model never invents a number.
            </p>

            <div className="mt-4 space-y-2">
              {[
                { label: 'Products analysed', value: number(velocity?.length ?? 0) },
                {
                  label: 'Flagged for reorder',
                  value: number(
                    velocity?.filter(
                      (item) =>
                        item.onHand <= item.reorderPoint ||
                        (item.daysOfCover !== null && item.daysOfCover <= 10),
                    ).length ?? 0,
                  ),
                },
                { label: 'Window', value: `${days} days` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-ink-500">{row.label}</span>
                  <span className="font-semibold text-ink-900 tnum">{row.value}</span>
                </div>
              ))}
            </div>

            <Link href="/ai" className="mt-5 block">
              <Button fullWidth size="sm" rightIcon={<ArrowRight className="size-3.5" />}>
                Generate restock plan
              </Button>
            </Link>
          </div>

          {summary && (
            <div className="border-t border-ink-100 px-5 py-3">
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <TrendingUp className="size-3.5" />
                  Avg order value
                </span>
                <span className="font-semibold text-ink-900 tnum">{currency(summary.avgOrderValue)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px]">
                <span className="text-ink-500">Retail value of stock</span>
                <span className="font-semibold text-ink-900 tnum">{compactCurrency(summary.retailValue)}</span>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ---- Today strip ---- */}
      {summary && (
        <Card>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 xs:grid-cols-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-3 sm:px-5">
            <div className="col-span-2 flex items-center gap-2 xs:col-span-3 sm:col-span-1">
              <Badge tone="brand" dot>
                Today
              </Badge>
              <span className="text-[12px] text-ink-400">{formatDate(new Date())}</span>
            </div>
            {[
              { label: 'Orders', value: number(summary.ordersToday) },
              { label: 'Revenue', value: currency(summary.revenueToday) },
              { label: 'Active SKUs', value: number(summary.activeProducts) },
              { label: 'Warehouses', value: number(summary.totalWarehouses) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">{item.label}</p>
                <p className="mt-0.5 text-[15px] font-semibold text-ink-900 tnum">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
