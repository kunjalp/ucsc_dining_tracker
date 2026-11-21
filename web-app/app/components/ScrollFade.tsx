'use client'

import { useEffect, useRef, type HTMLAttributes } from 'react'

// A horizontally scrolling row with a soft 24px fade on whichever edge has
// more content. The fade is a CSS mask on the scroller itself (see
// .scroll-fade in globals.css), so it matches the page gradient instead of
// painting a color over it, and it never catches taps. The scroll listener
// only flips data attributes on the element, so React does not re-render.
export default function ScrollFade({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      // Counter RTL's negative scrollLeft; 1px slack for subpixel rounding
      const x = Math.abs(el.scrollLeft)
      el.dataset.fadeStart = x > 1 ? 'true' : 'false'
      el.dataset.fadeEnd = max - x > 1 ? 'true' : 'false'
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={ref} data-fade-start="false" data-fade-end="false" className={`scroll-fade scrollbar-none overflow-x-auto overscroll-x-contain ${className}`} {...rest}>
      {children}
    </div>
  )
}
