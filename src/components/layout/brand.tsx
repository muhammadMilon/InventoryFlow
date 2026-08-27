import { cn } from '@/lib/format'

/**
 * The mark: a stylised stacked-crate glyph. Inline SVG rather than an image so
 * it inherits currentColor and stays crisp at every size without an asset request.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-[0_1px_2px_rgb(180_67_24/0.35)]',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
        <path
          d="M12 2.6 21 7v10l-9 4.4L3 17V7l9-4.4Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M3 7l9 4.4L21 7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M12 11.4V21.4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Logo />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink-900">
            Inventory<span className="text-brand-500">Flow</span>
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
            Stock &amp; Orders
          </span>
        </span>
      )}
    </span>
  )
}
