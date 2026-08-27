'use client'

import { useEffect, useState } from 'react'

/**
 * Matches a CSS media query from React.
 *
 * Starts `false` on the server and on the first client render so markup is
 * identical either side of hydration; the real value lands in the effect. Any
 * layout that depends on this must therefore be correct — not just tolerable —
 * at the `false` branch, which here means "assume the roomy desktop layout and
 * narrow it once we know better".
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const list = window.matchMedia(query)
    setMatches(list.matches)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind's `sm` breakpoint, inverted: true below 640px. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)')
}

/** True below Tailwind's `lg` — phones and portrait tablets. */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}
