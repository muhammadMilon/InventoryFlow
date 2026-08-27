'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-xs hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-300',
  secondary:
    'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-900 disabled:bg-ink-400',
  outline:
    'border border-ink-300 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
  danger:
    'bg-critical-500 text-white hover:bg-critical-700 active:bg-critical-700 disabled:bg-critical-500/50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-[15px]',
  icon: 'h-9 w-9 justify-center',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      // A loading button stays disabled — this is the first line of defence
      // against the double-click that idempotency keys exist to survive.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center rounded-lg font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full justify-center',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  )
})

export function IconButton({
  label,
  className,
  ...props
}: Omit<ButtonProps, 'size' | 'children'> & { label: string; children: ReactNode }) {
  return (
    <Button size="icon" variant="ghost" aria-label={label} title={label} className={className} {...props}>
      {props.children}
    </Button>
  )
}
