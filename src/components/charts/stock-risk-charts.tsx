'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipProps,
} from 'recharts'
import { currency, number } from '@/lib/format'
import { useIsMobile } from '@/lib/use-media-query'
import type { LowStockAlert, ProductVelocity } from '@/types/api'
import { AXIS, ChartEmpty, ChartFrame, ChartTooltip, CURSOR_BAR, GRID, SERIES, STATUS_COLORS } from './chart-kit'
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

/** Supplier lead time assumed by the restock engine. Mirrors the API constant. */
const LEAD_TIME_DAYS = 7

const SEVERITY_COLOR: Record<LowStockAlert['severity'], string> = {
  OUT_OF_STOCK: STATUS_COLORS.critical,
  CRITICAL: STATUS_COLORS.serious,
  LOW: STATUS_COLORS.warn,
}

/**
 * Days of cover per at-risk SKU.
 *
 * The useful question is not "which product has the fewest units" but "which
 * runs out first", so the bar length is *time*, not quantity — a fast seller
 * with 40 units is more urgent than a dead line with 4.
 *
 * The reference line marks the supplier lead time: anything to its left cannot
 * be replenished before it hits zero. That single line is what turns the chart
 * from a ranking into a decision.
 *
 * Bars use the reserved status palette, and every bar carries a direct label,
 * so severity is never communicated by colour alone.
 */
export function DaysOfCoverChart({ data, height = 320 }: { data: LowStockAlert[]; height?: number }) {
  // Out-of-stock rows have no meaningful "days" value; pin them at 0 so they
  // sort first and read as the emergency they are.
  const chartData = data
    .map((alert) => ({
      ...alert,
      cover: alert.available <= 0 ? 0 : (alert.daysOfCover ?? 60),
      label: alert.name.length > 22 ? `${alert.name.slice(0, 21)}…` : alert.name,
      hasVelocity: alert.velocity > 0,
    }))
    .sort((a, b) => a.cover - b.cover)
    .slice(0, 10)
    .reverse()

  // See the note in TopProductsChart: on a phone the label gutter has to give
  // way, or there is no bar left to read.
  const narrow = useIsMobile()

  return (
    <ChartFrame
      title="Days of cover"
      description={`At-risk SKUs, ordered by how soon they run out. Lead time is ${LEAD_TIME_DAYS} days.`}
      legend={[
        { label: 'Out of stock', color: SEVERITY_COLOR.OUT_OF_STOCK },
        { label: 'Critical', color: SEVERITY_COLOR.CRITICAL },
        { label: 'Low', color: SEVERITY_COLOR.LOW },
      ]}
      table={<CoverTable data={data} />}
    >
      {chartData.length === 0 ? (
        <ChartEmpty message="Nothing is running low — every SKU is above its reorder point" />
      ) : (
        <div style={{ height }} className="px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: narrow ? 40 : 56, bottom: 4, left: 4 }}>
              <CartesianGrid {...GRID} horizontal={false} vertical />
              <XAxis
                type="number"
                {...AXIS}
                tickFormatter={(value: number) => `${value}d`}
                domain={[0, 'dataMax']}
              />
              <YAxis
                type="category"
                dataKey="label"
                {...AXIS}
                width={narrow ? 92 : 140}
                tick={{ fontSize: narrow ? 11 : 12, fill: 'var(--color-ink-600)' }}
                tickFormatter={(value: string) =>
                  narrow && value.length > 12 ? `${value.slice(0, 11)}…` : value
                }
              />

              <ReferenceLine
                x={LEAD_TIME_DAYS}
                stroke="var(--color-ink-400)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Lead time',
                  position: 'top',
                  fill: 'var(--color-ink-500)',
                  fontSize: 11,
                }}
              />

              <Tooltip
                cursor={CURSOR_BAR}
                content={(props: TooltipProps<number, string>) => {
                  const row = props.payload?.[0]?.payload as (LowStockAlert & { cover: number }) | undefined
                  if (!row) return null
                  return (
                    <ChartTooltip
                      title={row.name}
                      rows={[
                        {
                          label: 'Days of cover',
                          value: row.available <= 0 ? 'Out of stock' : `${row.cover.toFixed(1)} days`,
                          color: SEVERITY_COLOR[row.severity],
                        },
                        { label: 'Available', value: number(row.available), muted: true },
                        { label: 'Reorder point', value: number(row.reorderPoint), muted: true },
                        { label: 'Sales velocity', value: `${row.velocity.toFixed(2)}/day`, muted: true },
                      ]}
                      footer={`${row.sku} · ${row.warehouseCode}`}
                    />
                  )
                }}
              />

              <Bar dataKey="cover" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((row) => (
                  <Cell key={`${row.productId}-${row.warehouseId}`} fill={SEVERITY_COLOR[row.severity]} />
                ))}
                <LabelList
                  dataKey="cover"
                  position="right"
                  offset={8}
                  formatter={(value: number) => (value <= 0 ? 'Empty' : `${value.toFixed(1)}d`)}
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

function CoverTable({ data }: { data: LowStockAlert[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[560px]">
        <THead>
          <Tr>
            <Th>Product</Th>
            <Th>Warehouse</Th>
            <Th align="right">Available</Th>
            <Th align="right">Reorder pt</Th>
            <Th align="right">Velocity</Th>
            <Th align="right">Cover</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((row) => (
            <Tr key={`${row.productId}-${row.warehouseId}`}>
              <Td>
                <span className="font-medium text-ink-900">{row.name}</span>
                <span className="ml-2 font-mono text-[11px] text-ink-400">{row.sku}</span>
              </Td>
              <Td className="text-[12px]">{row.warehouseCode}</Td>
              <Td align="right" numeric className={row.available <= 0 ? 'font-semibold text-critical-700' : ''}>
                {row.available}
              </Td>
              <Td align="right" numeric>
                {row.reorderPoint}
              </Td>
              <Td align="right" numeric>
                {row.velocity.toFixed(2)}/d
              </Td>
              <Td align="right" numeric>
                {row.available <= 0 ? 'Empty' : row.daysOfCover !== null ? `${row.daysOfCover}d` : '—'}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}

// ---------------------------------------------------------------------------
// Velocity vs cover — scatter
// ---------------------------------------------------------------------------

type RiskBand = 'urgent' | 'watch' | 'healthy'

const BAND_COLOR: Record<RiskBand, string> = {
  urgent: STATUS_COLORS.critical,
  watch: STATUS_COLORS.warn,
  healthy: SERIES[2],
}

const BAND_LABEL: Record<RiskBand, string> = {
  urgent: 'Reorder now',
  watch: 'Watch',
  healthy: 'Healthy',
}

function bandFor(item: ProductVelocity): RiskBand {
  if (item.onHand <= 0 || (item.daysOfCover !== null && item.daysOfCover <= LEAD_TIME_DAYS)) return 'urgent'
  if (item.onHand <= item.reorderPoint || (item.daysOfCover !== null && item.daysOfCover <= 21)) return 'watch'
  return 'healthy'
}

/**
 * Demand against cover: how fast a product sells (x) versus how long its stock
 * lasts (y). Bubble area is units on hand.
 *
 * Scatter puts every pair of colours on screen at once, so the series count is
 * capped at three — that is the all-pairs limit this palette validates to.
 * Three risk bands is also the number of decisions a buyer actually makes, so
 * the cap costs nothing.
 *
 * Only the bottom-right corner matters: fast-selling products with little cover
 * left. The lead-time line makes that corner explicit.
 */
export function VelocityScatter({ data, height = 320 }: { data: ProductVelocity[]; height?: number }) {
  const points = data
    .filter((item) => item.dailyVelocity > 0 || item.onHand > 0)
    .map((item) => ({
      ...item,
      band: bandFor(item),
      // Cap the y-axis so one dead-slow SKU with 400 days of cover does not
      // squash every interesting point into the bottom 5% of the plot.
      cover: Math.min(item.daysOfCover ?? 90, 90),
      bubble: Math.max(item.onHand, 1),
    }))

  const bands: RiskBand[] = ['urgent', 'watch', 'healthy']

  return (
    <ChartFrame
      title="Demand vs cover"
      description="Bubble size is units on hand. The bottom-right corner needs a purchase order."
      legend={bands.map((band) => ({
        label: BAND_LABEL[band],
        color: BAND_COLOR[band],
        value: number(points.filter((point) => point.band === band).length),
      }))}
      table={<VelocityTable data={data} />}
    >
      {points.length === 0 ? (
        <ChartEmpty />
      ) : (
        <div style={{ height }} className="px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 20, bottom: 16, left: 4 }}>
              <CartesianGrid {...GRID} vertical />
              <XAxis
                type="number"
                dataKey="dailyVelocity"
                name="Velocity"
                {...AXIS}
                tickFormatter={(value: number) => `${value}/d`}
                label={{
                  value: 'Units sold per day',
                  position: 'insideBottom',
                  offset: -8,
                  fill: 'var(--color-ink-500)',
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="cover"
                name="Cover"
                {...AXIS}
                width={48}
                tickFormatter={(value: number) => `${value}d`}
              />
              <ZAxis type="number" dataKey="bubble" range={[36, 420]} />

              <ReferenceLine
                y={LEAD_TIME_DAYS}
                stroke="var(--color-critical-500)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `${LEAD_TIME_DAYS}-day lead time`,
                  position: 'insideTopRight',
                  fill: 'var(--color-critical-700)',
                  fontSize: 11,
                }}
              />

              <Tooltip
                cursor={{ strokeDasharray: '4 4', stroke: 'var(--color-ink-300)' }}
                content={(props: TooltipProps<number, string>) => {
                  const point = props.payload?.[0]?.payload as
                    | (ProductVelocity & { band: RiskBand })
                    | undefined
                  if (!point) return null
                  return (
                    <ChartTooltip
                      title={point.name}
                      rows={[
                        { label: 'Status', value: BAND_LABEL[point.band], color: BAND_COLOR[point.band] },
                        { label: 'On hand', value: number(point.onHand), muted: true },
                        { label: 'Velocity', value: `${point.dailyVelocity.toFixed(2)}/day`, muted: true },
                        {
                          label: 'Days of cover',
                          value: point.daysOfCover !== null ? `${point.daysOfCover}d` : 'No recent sales',
                          muted: true,
                        },
                        { label: 'Unit price', value: currency(point.unitPrice), muted: true },
                      ]}
                      footer={point.sku}
                    />
                  )
                }}
              />

              {bands.map((band) => (
                <Scatter
                  key={band}
                  name={BAND_LABEL[band]}
                  data={points.filter((point) => point.band === band)}
                  fill={BAND_COLOR[band]}
                  fillOpacity={0.72}
                  // 2px surface ring so overlapping bubbles stay countable.
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartFrame>
  )
}

function VelocityTable({ data }: { data: ProductVelocity[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[520px]">
        <THead>
          <Tr>
            <Th>Product</Th>
            <Th align="right">On hand</Th>
            <Th align="right">Sold</Th>
            <Th align="right">Velocity</Th>
            <Th align="right">Cover</Th>
          </Tr>
        </THead>
        <TBody>
          {data.map((row) => (
            <Tr key={row.productId}>
              <Td>
                <span className="font-medium text-ink-900">{row.name}</span>
                <span className="ml-2 font-mono text-[11px] text-ink-400">{row.sku}</span>
              </Td>
              <Td align="right" numeric>
                {row.onHand}
              </Td>
              <Td align="right" numeric>
                {row.unitsSold}
              </Td>
              <Td align="right" numeric>
                {row.dailyVelocity.toFixed(2)}/d
              </Td>
              <Td align="right" numeric>
                {row.daysOfCover !== null ? `${row.daysOfCover}d` : '—'}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </TableWrap>
  )
}
