import { useSyncExternalStore } from 'react'

// True while the OS "Reduce Motion" setting (iOS Settings > Accessibility >
// Motion) is on. CSS handles most motion via @media (prefers-reduced-motion)
// / Tailwind's motion-reduce:, but SVG <animate> elements and JS-driven
// animations (count-ups) can't be reached from CSS, so they read this.
const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false // server render: assume motion is allowed
  )
}
