'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Calculator,
  Cpu,
  Eye,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, currency, number, relativeTime } from '@/lib/format'
import { useAiStatus, useRegenerateRestock, useRestockReport } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/field'
import { Badge, UrgencyBadge } from '@/components/ui/badge'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'

const WINDOWS = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
]

export default function AiRestockPage() {
  const [days, setDays] = useState(30)
  const limit = 12
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN')

  const { data: status } = useAiStatus()
  const { data: report, isLoading, isError, error, refetch } = useRestockReport(days, limit)
  const regenerate = useRegenerateRestock()

  const onRegenerate = async () => {
    try {
      const fresh = await regenerate.mutateAsync({ days, limit })
      toast.success('Restock plan regenerated', {
        description: fresh.source === 'gemini' ? `Written by ${fresh.model}` : 'Heuristic engine',
      })
    } catch {
      toast.error('Could not regenerate the plan')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-ink-900">
            <Sparkles className="size-5 text-brand-500" />
            Restock intelligence
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Sales velocity and days of cover, turned into a purchase plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SegmentedControl value={days} onChange={setDays} options={WINDOWS} label="Analysis window" />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={cn('size-3.5', regenerate.isPending && 'animate-spin')} />}
              onClick={onRegenerate}
              loading={regenerate.isPending}
            >
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* ---- Provider strip ---- */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              status?.enabled ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500',
            )}
          >
            {status?.enabled ? <Bot className="size-4" /> : <Calculator className="size-4" />}
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink-900">
              {status?.enabled ? (status.model ?? 'Gemini') : 'Heuristic engine'}
            </p>
            <p className="text-[11.5px] text-ink-500">
              {status?.enabled
                ? 'Google Gemini via REST'
                : 'GEMINI_API_KEY not set — deterministic fallback active'}
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-ink-200" aria-hidden />

        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-good-500" aria-hidden />
          <p className="max-w-md text-[11.5px] leading-relaxed text-ink-500">
            <span className="font-medium text-ink-700">Numbers come from the database, not the model.</span>{' '}
            Reorder quantities, days of cover and urgency are computed in code from the ledger. The model
            only prioritises and explains them — a hallucinated purchase order costs real money.
          </p>
        </div>

        {report && (
          <div className="ml-auto text-right">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Generated</p>
            <p className="text-[12.5px] font-medium text-ink-700">{relativeTime(report.generatedAt)}</p>
          </div>
        )}
      </Card>

      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingReport />
      ) : report ? (
        <>
          {report.degradedReason && (
            <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-warn-500/25 bg-warn-50 px-4 py-3">
              <AlertTriangle className="mt-px size-4 shrink-0 text-warn-700" aria-hidden />
              <div>
                <p className="text-[13px] font-semibold text-warn-700">Running on the fallback engine</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-warn-700/85">
                  {report.degradedReason}. The figures below are unaffected — they are computed from the
                  ledger either way. Only the wording is templated rather than written by the model.
                </p>
              </div>
            </div>
          )}

          {/* ---- Headline ---- */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-50 via-white to-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge tone={report.source === 'gemini' ? 'brand' : 'neutral'} icon={<Cpu className="size-3" />}>
                    {report.source === 'gemini' ? (report.model ?? 'Gemini') : 'Heuristic'}
                  </Badge>
                  <UrgencyBadge urgency={report.riskLevel} />
                  <span className="text-[11.5px] text-ink-400">{report.windowDays}-day window</span>
                </div>
              </div>

              <h2 className="mt-3 max-w-3xl text-[19px] font-semibold leading-snug tracking-[-0.02em] text-ink-900">
                {report.headline}
              </h2>

              <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-600">{report.summary}</p>

              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {[
                  { label: 'SKUs to reorder', value: number(report.recommendations.length) },
                  { label: 'Units', value: number(report.totalSuggestedUnits) },
                  { label: 'Estimated spend', value: currency(report.totalEstimatedSpend) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[11px] uppercase tracking-wide text-ink-400">{item.label}</p>
                    <p className="mt-0.5 text-[17px] font-semibold text-ink-900 tnum">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* ---- Recommendations ---- */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Recommended purchase orders"
              description="Quantities computed to restore ~21 days of cover, never below the configured reorder quantity."
              icon={<TrendingUp className="size-4" />}
            />

            {report.recommendations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-[15px] font-semibold text-ink-800">Nothing needs reordering</p>
                <p className="mt-1 text-[13px] text-ink-500">
                  Every active SKU is above its reorder point with healthy cover.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {report.recommendations.map((line) => (
                  <li key={line.sku} className="px-5 py-4 transition-colors hover:bg-brand-50/30">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-ink-900">{line.name}</span>
                          <span className="font-mono text-[11px] text-ink-400">{line.sku}</span>
                          <UrgencyBadge urgency={line.urgency} />
                          {line.category && (
                            <span className="text-[11.5px] text-ink-400">{line.category}</span>
                          )}
                        </div>

                        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-600">
                          {line.rationale}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-500">
                          <span>
                            On hand <span className="font-semibold text-ink-800 tnum">{line.onHand}</span>
                          </span>
                          <span>
                            Reorder point{' '}
                            <span className="font-semibold text-ink-800 tnum">{line.reorderPoint}</span>
                          </span>
                          <span>
                            Velocity{' '}
                            <span className="font-semibold text-ink-800 tnum">
                              {line.dailyVelocity.toFixed(2)}/day
                            </span>
                          </span>
                          <span>
                            Cover{' '}
                            <span className="font-semibold text-ink-800 tnum">
                              {line.daysOfCover !== null ? `${line.daysOfCover} days` : 'n/a'}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-right">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-600">
                          Order
                        </p>
                        <p className="text-[20px] font-semibold leading-tight text-brand-700 tnum">
                          {number(line.suggestedQty)}
                        </p>
                        <p className="text-[11px] text-brand-600 tnum">{currency(line.estimatedCost)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---- Watch list ---- */}
          {report.watchList.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Watch list"
                description="Not urgent yet, but worth keeping an eye on."
                icon={<Eye className="size-4" />}
              />
              <TableWrap>
                <Table className="min-w-[520px]">
                  <THead>
                    <Tr>
                      <Th>SKU</Th>
                      <Th>Product</Th>
                      <Th>Note</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {report.watchList.map((item) => (
                      <Tr key={item.sku}>
                        <Td className="font-mono text-[12px] text-ink-500">{item.sku}</Td>
                        <Td className="font-medium text-ink-900">{item.name}</Td>
                        <Td className="text-[12.5px] text-ink-600">{item.note}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </Card>
          )}

          <p className="px-1 text-[11.5px] leading-relaxed text-ink-400">
            Responses are cached for {status?.cacheTtlSeconds ?? 300} seconds and the endpoint is rate limited
            to 10 requests per minute per user — an LLM call is a billable operation, and a polling dashboard
            should not pay for one on every tick.
          </p>
        </>
      ) : null}
    </div>
  )
}

function LoadingReport() {
  return (
    <>
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-5/6" />
        <div className="mt-5 flex gap-8">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-1.5 h-5 w-16" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-ink-100">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex-1">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="mt-2 h-3 w-full max-w-md" />
              <Skeleton className="mt-1.5 h-3 w-64" />
            </div>
            <Skeleton className="h-14 w-20 rounded-lg" />
          </div>
        ))}
      </Card>
    </>
  )
}
