'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { axisDate, compactCurrency, currency, formatDate, number } from '@/lib/format'
import type { SalesTrendPoint } from '@/types/api'
import { AXIS, ChartEmpty, ChartFrame, ChartTooltip, CURSOR_LINE, GRID, SERIES } from './chart-kit'
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

/**
 * Revenue over time.
 *
 * Deliberately ONE plotted measure. Revenue (৳) and order count are different
 * scales, and a second y-axis is the single most misleading thing you can put
 * on a chart — the crossing point of two independently-scaled lines is an
 * artefact of the axis ranges, not a fact about the business. Orders and units
 * are surfaced in the tooltip, where they need no shared scale.
 */
export function SalesTrendChart({
  data,
  height = 280,
  controls,
}: {
  data: SalesTrendPoint[]
  height?: number
  controls?: React.ReactNode
}) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0)
  const totalOrders = data.reduce((sum, point) => sum + point.orders, 0)
  const best = data.reduce<SalesTrendPoint | null>(
    (top, point) => (!top || point.revenue > top.revenue ? point : top),
    null,
  )

  return (
    <ChartFrame
      title="Revenue trend"
      description={`${currency(total)} across ${number(totalOrders)} orders`}
      controls={controls}
      footer={
        best && best.revenue > 0
          ? `Best day: ${formatDate(best.date)} — ${currency(best.revenue)} from ${best.orders} orders`
          : undefined
      }
      table={<TrendTable data={data} />}
    >
      {data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div style={{ height }} className="px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid {...GRID} />

              <XAxis
                dataKey="date"
                {...AXIS}
                tickFormatter={axisDate}
                minTickGap={28}
                interval="preserveStartEnd"
              />
              <YAxis {...AXIS} tickFormatter={compactCurrency} width={58} />

              <Tooltip
                cursor={CURSOR_LINE}
                content={(props: TooltipProps<number, string>) => {
                  const point = props.payload?.[0]?.payload as SalesTrendPoint | undefined
                  if (!point) return null
                  return (
                    <ChartTooltip
                      title={formatDate(point.date, 'medium')}
                      rows={[
                        { label: 'Revenue', value: currency(point.revenue), color: SERIES[0] },
                        { label: 'Orders', value: number(point.orders), muted: true },
                        { label: 'Units', value: number(point.units), muted: true },
                      ]}
                    />
                  )
                }}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke={SERIES[0]}
                strokeWidth={2}
                fill="url(#revenueFill)"
                // Markers appear on hover only — a dot on all 60 points is noise.
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: SERIES[0] }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  )
}

function TrendTable({ data }: { data: SalesTrendPoint[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[420px]">
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">Orders</Th>
            <Th align="right">Units</Th>
          </Tr>
        </THead>
        <TBody>
          {[...data].reverse().map((point) => (
            <Tr key={point.date}>
              <Td>{formatDate(point.date)}</Td>
              <Td align="right" numeric>
                {currency(point.revenue)}
              </Td>
              <Td align="right" numeric>
                {point.orders}
              </Td>
              <Td align="right" numeric>
                {point.units}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
