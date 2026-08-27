'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { compactCurrency, currency, number } from '@/lib/format'
import type { TopProduct } from '@/types/api'
import { AXIS, ChartEmpty, ChartFrame, ChartTooltip, CURSOR_BAR, GRID, SERIES } from './chart-kit'
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

/**
 * Best sellers by revenue.
 *
 * Horizontal bars because the labels are product names — rotated 45° text under
 * a vertical bar chart is a readability tax paid by every reader to save the
 * author a layout decision.
 *
 * One measure, one series, so no legend: the title already names what is
 * plotted. Values are direct-labelled at the end of each bar, which is also the
 * "relief" this palette owes for slots that sit under 3:1 on white.
 */
export function TopProductsChart({
  data,
  height = 300,
  controls,
}: {
  data: TopProduct[]
  height?: number
  controls?: React.ReactNode
}) {
  const chartData = [...data].reverse() // Recharts renders the first item at the bottom.

  return (
    <ChartFrame
      title="Best sellers"
      description="By revenue over the selected period"
      controls={controls}
      table={<TopTable data={data} />}
    >
      {data.length === 0 ? (
        <ChartEmpty message="No sales in this period" />
      ) : (
        <div style={{ height }} className="px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }}>
              <CartesianGrid {...GRID} horizontal={false} vertical />

              <XAxis type="number" {...AXIS} tickFormatter={compactCurrency} />
              <YAxis
                type="category"
                dataKey="name"
                {...AXIS}
                width={140}
                tick={{ fontSize: 12, fill: 'var(--color-ink-600)' }}
                tickFormatter={(value: string) => (value.length > 20 ? `${value.slice(0, 19)}…` : value)}
              />

              <Tooltip
                cursor={CURSOR_BAR}
                content={(props: TooltipProps<number, string>) => {
                  const point = props.payload?.[0]?.payload as TopProduct | undefined
                  if (!point) return null
                  return (
                    <ChartTooltip
                      title={point.name}
                      rows={[
                        { label: 'Revenue', value: currency(point.revenue), color: SERIES[0] },
                        { label: 'Units sold', value: number(point.unitsSold), muted: true },
                        { label: 'Orders', value: number(point.orders), muted: true },
                      ]}
                      footer={`${point.sku}${point.category ? ` · ${point.category}` : ''}`}
                    />
                  )
                }}
              />

              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((entry) => (
                  // Colour follows the entity, not the rank: every bar is the
                  // same series, so shading by position would imply a second
                  // dimension that is not there.
                  <Cell key={entry.productId} fill={SERIES[0]} />
                ))}
                <LabelList
                  dataKey="revenue"
                  position="right"
                  offset={8}
                  formatter={(value: number) => compactCurrency(value)}
                  style={{ fill: 'var(--color-ink-600)', fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  )
}

function TopTable({ data }: { data: TopProduct[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[460px]">
        <THead>
          <Tr>
            <Th>Product</Th>
            <Th>SKU</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">Units</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((product) => (
            <Tr key={product.productId}>
              <Td className="font-medium text-ink-900">{product.name}</Td>
              <Td className="font-mono text-[12px] text-ink-500">{product.sku}</Td>
              <Td align="right" numeric>
                {currency(product.revenue)}
              </Td>
              <Td align="right" numeric>
                {product.unitsSold}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
