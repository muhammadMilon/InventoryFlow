'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowRight, KeyRound, Mail, ShieldCheck, Sparkles, Boxes } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Wordmark } from '@/components/layout/brand'

/** Seeded demo accounts — filled in with one click so a reviewer is never stuck. */
const DEMO_ACCOUNTS = [
  {
    role: 'Admin',
    email: 'admin@inventoryflow.dev',
    password: 'Admin@12345',
    blurb: 'Full access — adjust stock, manage products, run the AI brief',
  },
  {
    role: 'Staff',
    email: 'staff@inventoryflow.dev',
    password: 'Staff@12345',
    blurb: 'Read-only catalogue plus order placement',
  },
] as const

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, status, user } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const redirectTo = searchParams.get('from') ?? '/dashboard'

  useEffect(() => {
    if (status === 'authenticated' && user) router.replace(redirectTo)
  }, [status, user, router, redirectTo])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const nextFieldErrors: typeof fieldErrors = {}
    if (!email.trim()) nextFieldErrors.email = 'Email is required'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextFieldErrors.email = 'Enter a valid email address'
    if (!password) nextFieldErrors.password = 'Password is required'

    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      router.replace(redirectTo)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(
          caught.code === 'RATE_LIMITED'
            ? 'Too many sign-in attempts. Wait a few minutes before trying again.'
            : caught.message,
        )
      } else {
        setError('Sign in failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email)
    setPassword(account.password)
    setFieldErrors({})
    setError(null)
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ---- Form ---- */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <Wordmark className="mb-9" />

          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Access the inventory, order and stock-ledger console.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              leftIcon={<Mail className="size-4" />}
              disabled={submitting}
              required
              data-autofocus
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              leftIcon={<KeyRound className="size-4" />}
              disabled={submitting}
              required
            />

            {error && (
              <div
                role="alert"
                data-testid="login-error"
                className="flex items-start gap-2 rounded-lg border border-critical-500/25 bg-critical-50 px-3 py-2.5"
              >
                <AlertCircle className="mt-px size-4 shrink-0 text-critical-700" aria-hidden />
                <p className="text-[13px] font-medium text-critical-700">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
              rightIcon={<ArrowRight className="size-4" />}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                Demo accounts
              </span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>

            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillDemo(account)}
                  disabled={submitting}
                  className="group flex w-full items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-left transition-all hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-white">
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-ink-900">{account.role}</span>
                      <span className="truncate font-mono text-[11px] text-ink-500">{account.email}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-400">{account.blurb}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Marketing panel ---- */}
      <aside className="relative hidden overflow-hidden border-l border-ink-200 bg-white lg:block">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(48rem 34rem at 78% 8%, rgb(235 104 52 / 0.12), transparent 60%),' +
              'radial-gradient(36rem 26rem at 12% 88%, rgb(235 104 52 / 0.08), transparent 62%)',
          }}
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-center px-12 py-16">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
            <Sparkles className="size-3" />
            Ledger-backed inventory
          </span>

          <h2 className="mt-5 max-w-md text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink-900">
            Every unit accounted for, every change on the record.
          </h2>

          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-500">
            Stock moves through a single append-only ledger. Two orders for the last unit cannot both
            succeed, and every adjustment names the admin who made it.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              {
                icon: <Boxes className="size-4" />,
                title: 'Race-safe stock',
                body: 'Conditional UPDATE inside one transaction — concurrent orders can never oversell.',
              },
              {
                icon: <ShieldCheck className="size-4" />,
                title: 'Auditable by design',
                body: 'Ledger entries reconcile against live levels; admin adjustments are logged with actor and IP.',
              },
              {
                icon: <Sparkles className="size-4" />,
                title: 'AI restock brief',
                body: 'Gemini turns velocity and days-of-cover into a purchase plan, with a deterministic fallback.',
              },
            ].map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-brand-600">
                  {feature.icon}
                </span>
                <span className="max-w-sm">
                  <span className="block text-[13px] font-semibold text-ink-900">{feature.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-500">{feature.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  )
}
