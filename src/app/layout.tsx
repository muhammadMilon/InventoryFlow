import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'InventoryFlow — Inventory & Order Management',
    template: '%s · InventoryFlow',
  },
  description:
    'Multi-warehouse inventory and order management with a ledger-backed audit trail, race-safe stock decrements and AI restock recommendations.',
  applicationName: 'InventoryFlow',
  authors: [{ name: 'Muhammad Milon' }],
  keywords: ['inventory', 'order management', 'warehouse', 'stock ledger', 'Next.js', 'Prisma'],
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="app-wash min-h-dvh antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          closeButton
          richColors={false}
          toastOptions={{
            classNames: {
              toast:
                'rounded-[var(--radius-card)] border border-ink-200 bg-white shadow-[var(--shadow-pop)] text-ink-800',
              title: 'text-[13px] font-semibold text-ink-900',
              description: 'text-[12px] text-ink-500',
              actionButton: 'bg-brand-500 text-white rounded-md',
              cancelButton: 'bg-ink-100 text-ink-600 rounded-md',
            },
          }}
        />
      </body>
    </html>
  )
}
