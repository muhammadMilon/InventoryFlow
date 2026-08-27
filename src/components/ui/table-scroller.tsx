'use client'

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type PointerEvent } from 'react'
import { cn } from '@/lib/format'

interface Metrics {
  scrollWidth: number
  clientWidth: number
  scrollLeft: number
}

const EMPTY: Metrics = { scrollWidth: 0, clientWidth: 0, scrollLeft: 0 }
const MIN_THUMB = 40

/**
 * A wide table inside its own horizontal scroller, with a scroll rail both
 * above and below it.
 *
 * Two problems make the native scrollbar the wrong tool here. It renders only
 * at the bottom of the scroll box, which on a fifteen-row table is a screen and
 * a half below the header — you have to scroll past every row to discover the
 * table scrolls sideways at all. And on touch platforms it is an overlay
 * scrollbar: invisible until you are already dragging, which is exactly when
 * you no longer need to be told.
 *
 * So the native bar is hidden (`.table-scroll-x`) and replaced by two rails
 * that are always visible, look the same on every platform, and both drive the
 * same scroller. Swiping the table still works — the rails are an extra
 * affordance, not a replacement for touch scrolling.
 */
export function TableScroller({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<Metrics>(EMPTY)
  const frame = useRef<number | null>(null)

  const measure = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    setMetrics((current) => {
      const next = {
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
        scrollLeft: body.scrollLeft,
      }
      return current.scrollWidth === next.scrollWidth &&
        current.clientWidth === next.clientWidth &&
        current.scrollLeft === next.scrollLeft
        ? current
        : next
    })
  }, [])

  /** Scroll fires per frame on a touch drag; coalesce to one measure per paint. */
  const onScroll = useCallback(() => {
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      measure()
    })
  }, [measure])

  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // Watch both boxes: the container changes with the viewport, the table
    // changes when a filter swaps the rows out underneath it.
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    if (body.firstElementChild) observer.observe(body.firstElementChild)
    return () => {
      observer.disconnect()
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [measure, children])

  const scrollTo = useCallback((left: number) => {
    const body = bodyRef.current
    if (!body) return
    body.scrollLeft = left
  }, [])

  const overflowing = metrics.scrollWidth - metrics.clientWidth > 1

  return (
    <div className={cn('relative', className)}>
      {overflowing && (
        <ScrollRail
          metrics={metrics}
          onScrollTo={scrollTo}
          interactive
          className="border-b border-ink-100 bg-ink-50/50"
        />
      )}

      <div
        ref={bodyRef}
        onScroll={onScroll}
        className="table-scroll-x w-full overflow-x-auto overscroll-x-contain"
        {...props}
      >
        {children}
      </div>

      {overflowing && (
        <ScrollRail
          metrics={metrics}
          onScrollTo={scrollTo}
          className="border-t border-ink-100 bg-ink-50/50"
        />
      )}

      {/* Edge fades — the honest signal that a column sits off-frame. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-white to-transparent transition-opacity duration-200',
          overflowing && metrics.scrollLeft > 1 ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-white to-transparent transition-opacity duration-200',
          overflowing && metrics.scrollLeft < metrics.scrollWidth - metrics.clientWidth - 1
            ? 'opacity-100'
            : 'opacity-0',
        )}
      />
    </div>
  )
}

/**
 * One rail. The track spans the full width of the scroller, so track width and
 * the scroller's clientWidth are the same number and no measurement of the rail
 * itself is needed.
 *
 * `interactive` marks the rail that carries the ARIA scrollbar role and the
 * keyboard handling; the second rail is a pointer affordance only, because two
 * tab stops and two announced scrollbars for one scroll region is worse than
 * one of each.
 */
function ScrollRail({
  metrics,
  onScrollTo,
  interactive,
  className,
}: {
  metrics: Metrics
  onScrollTo: (left: number) => void
  interactive?: boolean
  className?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerX: number; scrollLeft: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const { scrollWidth, clientWidth, scrollLeft } = metrics
  const maxScroll = Math.max(1, scrollWidth - clientWidth)
  const thumbWidth = Math.max(MIN_THUMB, Math.round((clientWidth / scrollWidth) * clientWidth))
  const travel = Math.max(1, clientWidth - thumbWidth)
  const thumbLeft = Math.round((scrollLeft / maxScroll) * travel)

  const onThumbDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerX: event.clientX, scrollLeft }
    setDragging(true)
  }

  const onThumbMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const delta = event.clientX - drag.current.pointerX
    onScrollTo(drag.current.scrollLeft + (delta * maxScroll) / travel)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    drag.current = null
    setDragging(false)
  }

  /** A click on the empty track centres the thumb on that point. */
  const onTrackDown = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) return
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const target = event.clientX - rect.left - thumbWidth / 2
    onScrollTo((Math.min(Math.max(target, 0), travel) * maxScroll) / travel)
  }

  const step = Math.max(48, Math.round(clientWidth * 0.6))

  return (
    <div
      ref={trackRef}
      onPointerDown={onTrackDown}
      className={cn('relative h-3.5 w-full touch-none select-none', className)}
      role={interactive ? 'scrollbar' : undefined}
      aria-orientation={interactive ? 'horizontal' : undefined}
      aria-label={interactive ? 'Scroll the table sideways' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? maxScroll : undefined}
      aria-valuenow={interactive ? Math.round(scrollLeft) : undefined}
      aria-hidden={interactive ? undefined : true}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'ArrowRight') onScrollTo(scrollLeft + step)
              else if (event.key === 'ArrowLeft') onScrollTo(scrollLeft - step)
              else if (event.key === 'Home') onScrollTo(0)
              else if (event.key === 'End') onScrollTo(maxScroll)
              else return
              event.preventDefault()
            }
          : undefined
      }
    >
      <div
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ width: thumbWidth, transform: `translateX(${thumbLeft}px)` }}
        className={cn(
          'absolute inset-y-1 left-0 cursor-grab rounded-full bg-ink-300 transition-colors',
          'hover:bg-ink-400',
          dragging && 'cursor-grabbing bg-brand-500',
        )}
      />
    </div>
  )
}
