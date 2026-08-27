import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginForm } from './login-form'
import { Wordmark } from '@/components/layout/brand'

export const metadata: Metadata = {
  title: 'Sign in',
}

/**
 * `LoginForm` reads `?from=` via `useSearchParams`, which opts the subtree into
 * client-side rendering. The Suspense boundary is what lets the rest of the
 * page prerender instead of the whole route falling back to dynamic.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginSkeleton() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-[400px]">
        <Wordmark className="mb-9" />
        <div className="skeleton h-8 w-32 rounded-md" />
        <div className="skeleton mt-3 h-4 w-64 rounded-md" />
        <div className="skeleton mt-8 h-10 w-full rounded-lg" />
        <div className="skeleton mt-4 h-10 w-full rounded-lg" />
        <div className="skeleton mt-4 h-11 w-full rounded-lg" />
      </div>
    </main>
  )
}
