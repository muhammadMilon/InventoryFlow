'use client'

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/format'

const CONTROL =
  'w-full rounded-lg border bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors ' +
  'focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 ' +
  'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400'

interface FieldWrapperProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, error, required, htmlFor, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-700">
          {label}
          {required && <span className="ml-0.5 text-critical-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-[12px] font-medium text-critical-700" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && <p className="text-[12px] text-ink-400">{hint}</p>
      )}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            CONTROL,
            'h-10',
            leftIcon && 'pl-9',
            rightSlot && 'pr-10',
            error ? 'border-critical-500 focus:border-critical-500 focus:ring-critical-500/10' : 'border-ink-300',
            className,
          )}
          {...props}
        />
        {rightSlot && <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>}
      </div>
    </Field>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, required, children, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          'h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
          error ? 'border-critical-500' : 'border-ink-300',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237c756c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
    </Field>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const areaId = id ?? generatedId

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={areaId}>
      <textarea
        ref={ref}
        id={areaId}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          'min-h-20 resize-y py-2 leading-relaxed',
          error ? 'border-critical-500' : 'border-ink-300',
          className,
        )}
        {...props}
      />
    </Field>
  )
})

/** Segmented control — used for time-range switches above the charts. */
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  label?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg border border-ink-200 bg-ink-50 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[6px] font-medium transition-all',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]',
              active
                ? 'bg-white text-ink-900 shadow-[var(--shadow-card)]'
                : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
