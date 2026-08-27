'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { compactCurrency, compactNumber, currency, number, titleCase } from '@/lib/format'
import type { CategoryBreakdown, OrderStatusSlice, WarehouseUtilisation } from '@/types/api'
import { AXIS, ChartEmpty, ChartFrame, ChartTooltip, CURSOR_BAR, GRID, SERIES, STATUS_COLORS } from './chart-kit'
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Stock value by category — donut
// ---------------------------------------------------------------------------

/**
 * A donut is defensible here and rarely elsewhere: five parts of one whole
 * (total stock value), where the reader wants "which category holds the money"
 * rather than a precise ranking. The centre carries the total — the number
 * people actually came for — and the legend carries per-slice values, so no one
 * has to estimate an angle.
 *
 * Colour is assigned by categorical slot in fixed order. With five slices the
 * palette is inside its validated adjacent-pair range.
 */
export function CategoryDonut({ data }: { data: CategoryBreakdown[] }) {
  const ranked = [...data].sort((a, b) => b.stockValue - a.stockValue)
  const total = ranked.reduce((sum, row) => sum + row.stockValue, 0)

  return (
    <ChartFrame
      title="Stock value by category"
      description="Inventory held at cost price"
      legend={ranked.map((row, index) => ({
        label: row.category,
        color: SERIES[index % SERIES.length]!,
        value: compactCurrency(row.stockValue),
      }))}
      table={<CategoryTable data={ranked} total={total} />}
    >
      {ranked.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div className="relative" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={(props: TooltipProps<number, string>) => {
                  const row = props.payload?.[0]?.payload as CategoryBreakdown | undefined
                  if (!row) return null
                  const share = total > 0 ? (row.stockValue / total) * 100 : 0
                  return (
                    <ChartTooltip
                      title={row.category}
                      rows={[
                        { label: 'Stock value', value: currency(row.stockValue) },
                        { label: 'Share', value: `${share.toFixed(1)}%`, muted: true },
                        { label: 'Units', value: number(row.units), muted: true },
                        { label: 'SKUs', value: number(row.products), muted: true },
                      ]}
                    />
                  )
                }}
              />
              <Pie
                data={ranked}
                dataKey="stockValue"
                nameKey="category"
                innerRadius="58%"
                outerRadius="86%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {ranked.map((row, index) => (
                  <Cell key={row.category} fill={SERIES[index % SERIES.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Total</span>
            <span className="text-xl font-semibold tracking-[-0.02em] text-ink-900 tnum">
              {compactCurrency(total)}
            </span>
          </div>
        </div>
      )}
    </ChartFrame>
  )
}

function CategoryTable({ data, total }: { data: CategoryBreakdown[]; total: number }) {
  return (
    <TableWrap>
      <Table className="min-w-[420px]">
        <THead>
          <Tr>
            <Th>Category</Th>
            <Th align="right">Stock value</Th>
            <Th align="right">Share</Th>
            <Th align="right">Units</Th>
            <Th align="right">SKUs</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((row) => (
            <Tr key={row.category}>
              <Td className="font-medium text-ink-900">{row.category}</Td>
              <Td align="right" numeric>
                {currency(row.stockValue)}
              </Td>
              <Td align="right" numeric>
                {total > 0 ? `${((row.stockValue / total) * 100).toFixed(1)}%` : '—'}
              </Td>
              <Td align="right" numeric>
                {row.units}
              </Td>
              <Td align="right" numeric>
                {row.products}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}

// ---------------------------------------------------------------------------
// Warehouse utilisation — grouped bars
// ---------------------------------------------------------------------------

/**
 * Units held per site, with low-stock SKUs alongside.
 *
 * Units and low-stock-count are different quantities on very different scales,
 * so they are NOT two bars on one axis. Units are plotted; the low-stock count
 * rides in the tooltip and the table, where it needs no scale of its own.
 */
export function WarehouseChart({ data, height = 250 }: { data: WarehouseUtilisation[]; height?: number }) {
  return (
    <ChartFrame
      title="Stock by warehouse"
      description="Units on hand at each site"
      table={<WarehouseTable data={data} />}
      footer={`${data.length} active sites · ${number(data.reduce((sum, row) => sum + row.units, 0))} units total`}
    >
      {data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div style={{ height }} className="px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="code" {...AXIS} />
              <YAxis {...AXIS} tickFormatter={compactNumber} width={48} />

              <Tooltip
                cursor={CURSOR_BAR}
                content={(props: TooltipProps<number, string>) => {
                  const row = props.payload?.[0]?.payload as WarehouseUtilisation | undefined
                  if (!row) return null
                  return (
                    <ChartTooltip
                      title={`${row.name} (${row.code})`}
                      rows={[
                        { label: 'Units on hand', value: number(row.units), color: SERIES[1] },
                        { label: 'Stock value', value: currency(row.stockValue), muted: true },
                        { label: 'Distinct SKUs', value: number(row.skus), muted: true },
                        { label: 'Low stock', value: number(row.lowStock), muted: true },
                      ]}
                      footer={row.city}
                    />
                  )
                }}
              />

              <Bar dataKey="units" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {data.map((row) => (
                  <Cell key={row.warehouseId} fill={SERIES[1]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  )
}

function WarehouseTable({ data }: { data: WarehouseUtilisation[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[480px]">
        <THead>
          <Tr>
            <Th>Warehouse</Th>
            <Th align="right">Units</Th>
            <Th align="right">Value</Th>
            <Th align="right">SKUs</Th>
            <Th align="right">Low</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((row) => (
            <Tr key={row.warehouseId}>
              <Td>
                <span className="font-medium text-ink-900">{row.code}</span>
                <span className="ml-2 text-[12px] text-ink-500">{row.city}</span>
              </Td>
              <Td align="right" numeric>
                {number(row.units)}
              </Td>
              <Td align="right" numeric>
                {currency(row.stockValue)}
              </Td>
              <Td align="right" numeric>
                {row.skus}
              </Td>
              <Td align="right" numeric className={row.lowStock > 0 ? 'font-semibold text-serious-700' : ''}>
                {row.lowStock}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}

// ---------------------------------------------------------------------------
// Order status — donut using the reserved status palette
// ---------------------------------------------------------------------------

const STATUS_SLICE_COLOR: Record<OrderStatusSlice['status'], string> = {
  PENDING: STATUS_COLORS.warn,
  CONFIRMED: SERIES[1],
  FULFILLED: STATUS_COLORS.good,
  CANCELLED: STATUS_COLORS.critical,
}

/**
 * Order state is a *status*, not an arbitrary category, so it draws from the
 * reserved status palette rather than the categorical slots — "cancelled" must
 * read as bad wherever it appears in the product, and never be recycled as
 * "series 4" in some other chart.
 */
export function OrderStatusDonut({ data }: { data: OrderStatusSlice[] }) {
  const present = data.filter((slice) => slice.count > 0)
  const total = present.reduce((sum, slice) => sum + slice.count, 0)

  return (
    <ChartFrame
      title="Order pipeline"
      description="Every order by current state"
      legend={present.map((slice) => ({
        label: titleCase(slice.status),
        color: STATUS_SLICE_COLOR[slice.status],
        value: number(slice.count),
      }))}
      table={<StatusTable data={data} total={total} />}
    >
      {present.length === 0 ? (
        <ChartEmpty message="No orders yet" />
      ) : (
        <div className="relative" style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={(props: TooltipProps<number, string>) => {
                  const slice = props.payload?.[0]?.payload as OrderStatusSlice | undefined
                  if (!slice) return null
                  return (
                    <ChartTooltip
                      title={titleCase(slice.status)}
                      rows={[
                        { label: 'Orders', value: number(slice.count) },
                        {
                          label: 'Share',
                          value: total > 0 ? `${((slice.count / total) * 100).toFixed(1)}%` : '—',
                          muted: true,
                        },
                        { label: 'Value', value: currency(slice.value), muted: true },
                      ]}
                    />
                  )
                }}
              />
              <Legend content={() => null} />
              <Pie
                data={present}
                dataKey="count"
                nameKey="status"
                innerRadius="58%"
                outerRadius="86%"
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {present.map((slice) => (
                  <Cell key={slice.status} fill={STATUS_SLICE_COLOR[slice.status]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Orders</span>
            <span className="text-xl font-semibold tracking-[-0.02em] text-ink-900 tnum">{number(total)}</span>
          </div>
        </div>
      )}
    </ChartFrame>
  )
}

function StatusTable({ data, total }: { data: OrderStatusSlice[]; total: number }) {
  return (
    <TableWrap>
      <Table className="min-w-[380px]">
        <THead>
          <Tr>
            <Th>Status</Th>
            <Th align="right">Orders</Th>
            <Th align="right">Share</Th>
            <Th align="right">Value</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((slice) => (
            <Tr key={slice.status}>
              <Td className="font-medium text-ink-900">{titleCase(slice.status)}</Td>
              <Td align="right" numeric>
                {slice.count}
              </Td>
              <Td align="right" numeric>
                {total > 0 ? `${((slice.count / total) * 100).toFixed(1)}%` : '—'}
              </Td>
              <Td align="right" numeric>
                {currency(slice.value)}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
