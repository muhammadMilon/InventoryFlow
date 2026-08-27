'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { axisDate, compactNumber, formatDate, number } from '@/lib/format'
import type { MovementFlowPoint } from '@/types/api'
import { AXIS, ChartEmpty, ChartFrame, ChartTooltip, CURSOR_BAR, GRID, SERIES } from './chart-kit'
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

/**
 * Warehouse throughput: units received vs units shipped, straight from the
 * ledger.
 *
 * Both series are unit counts, so they share one axis honestly. Outbound is
 * plotted as a negative so the two directions read as opposite about a zero
 * baseline — a grouped chart of two positive bars makes "more in than out"
 * something you have to compute rather than see. The net line is the same
 * numbers summed, on the same scale, so it is not a second axis.
 */
export function MovementFlowChart({ data, height = 260 }: { data: MovementFlowPoint[]; height?: number }) {
  const chartData = data.map((point) => ({ ...point, outboundNegative: -point.outbound }))

  const totalIn = data.reduce((sum, point) => sum + point.inbound, 0)
  const totalOut = data.reduce((sum, point) => sum + point.outbound, 0)

  return (
    <ChartFrame
      title="Stock movement"
      description="Units received vs units shipped, per day"
      legend={[
        { label: 'Inbound', color: SERIES[2], value: number(totalIn) },
        { label: 'Outbound', color: SERIES[0], value: number(totalOut) },
        { label: 'Net', color: 'var(--color-ink-400)' },
      ]}
      table={<FlowTable data={data} />}
      footer={`Net over the period: ${totalIn - totalOut >= 0 ? '+' : ''}${number(totalIn - totalOut)} units`}
    >
      {data.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div style={{ height }} className="px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }} stackOffset="sign">
              <CartesianGrid {...GRID} />

              <XAxis dataKey="date" {...AXIS} tickFormatter={axisDate} minTickGap={24} />
              <YAxis {...AXIS} tickFormatter={(value: number) => compactNumber(Math.abs(value))} width={48} />

              <ReferenceLine y={0} stroke="var(--color-ink-300)" strokeWidth={1} />

              <Tooltip
                cursor={CURSOR_BAR}
                content={(props: TooltipProps<number, string>) => {
                  const point = props.payload?.[0]?.payload as (MovementFlowPoint & { outboundNegative: number }) | undefined
                  if (!point) return null
                  return (
                    <ChartTooltip
                      title={formatDate(point.date)}
                      rows={[
                        { label: 'Inbound', value: `+${number(point.inbound)}`, color: SERIES[2] },
                        { label: 'Outbound', value: `−${number(point.outbound)}`, color: SERIES[0] },
                        {
                          label: 'Net',
                          value: `${point.net >= 0 ? '+' : ''}${number(point.net)}`,
                          muted: true,
                        },
                      ]}
                    />
                  )
                }}
              />

              {/* 2px white stroke = the surface gap between adjacent fills. */}
              <Bar
                dataKey="inbound"
                fill={SERIES[2]}
                radius={[4, 4, 0, 0]}
                stroke="#fff"
                strokeWidth={2}
                maxBarSize={26}
              />
              <Bar
                dataKey="outboundNegative"
                fill={SERIES[0]}
                radius={[0, 0, 4, 4]}
                stroke="#fff"
                strokeWidth={2}
                maxBarSize={26}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="var(--color-ink-400)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: 'var(--color-ink-500)' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  )
}

function FlowTable({ data }: { data: MovementFlowPoint[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[380px]">
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th align="right">Inbound</Th>
            <Th align="right">Outbound</Th>
            <Th align="right">Net</Th>
          </Tr>
        </THead>
        <TBody>
          {[...data].reverse().map((point) => (
            <Tr key={point.date}>
              <Td>{formatDate(point.date)}</Td>
              <Td align="right" numeric>
                +{point.inbound}
              </Td>
              <Td align="right" numeric>
                −{point.outbound}
              </Td>
              <Td align="right" numeric className={point.net < 0 ? 'text-critical-700' : 'text-good-700'}>
                {point.net >= 0 ? '+' : ''}
                {point.net}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}

/** Compact variant used on the stock page. */
export function MovementFlowMini({ data }: { data: MovementFlowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey="outbound" fill={SERIES[0]} radius={[3, 3, 0, 0]} maxBarSize={10} />
      </BarChart>
    </ResponsiveContainer>
  )
}
