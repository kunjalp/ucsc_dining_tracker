'use client'

import { createContext, useCallback, useContext, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { animateSpring, createVelocityTracker, project, rubberband, type Spring } from '@/lib/spring'
import { useReducedMotion } from '@/lib/useReducedMotion'

interface BottomSheetProps {
  onClose: () => void
  labelledBy: string
  children: ReactNode
  // Background + max height, e.g. "bg-surface-2 max-h-[85dvh]"
  className?: string
}

// Letting go closes the sheet if where it's heading (position + momentum)
// is past this fraction of its height -- capped, so tall sheets don't need a
// huge drag...
const DISMISS_FRACTION = 0.4
const DISMISS_MAX_PX = 160
// ...as long as it was actually pulled down a little, so a tiny accidental
// flick doesn't close it
const DISMISS_MIN_PX = 20
// Movement before a touch on the content counts as a drag rather than a tap
const DRAG_SLOP_PX = 6
// Released faster than this (px/s), the snap-back gets a touch of bounce
const MOMENTUM_PX_S = 300

// The enclosing sheet's animated close (slide down, then onClose)
const SheetDismissContext = createContext<() => void>(() => {})

// A close button (X, Cancel, Done) inside a BottomSheet: slides the sheet
// down the same way a swipe does instead of unmounting it on the spot.
// Takes any <button> props except onClick.
export function SheetCloseButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const dismiss = useContext(SheetDismissContext)
  return <button type="button" {...props} onClick={dismiss} />
}

// iOS-style bottom sheet: docks to the bottom edge, slides up, and pads its
// content past the home indicator (safe-area-inset-bottom) so the last
// button is never under it. Swipe down to dismiss works from the 44px grab
// handle strip, and from the content itself while it's scrolled to the top
// (like native sheets) -- once the content is scrolled down, swipes scroll.
//
// Motion is springs written straight to the DOM (no React state), so a drag
// never re-renders the content, the sheet can be grabbed mid-animation and
// carries on from where it is, and a release hands the finger's speed to
// the spring. Closing slides it back down the way it came, then unmounts.
export default function BottomSheet({ onClose, labelledBy, children, className = 'bg-surface-2 max-h-[85dvh]' }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // What's on screen right now: px below the resting position (negative =
  // stretched up past it)
  const offsetRef = useRef(0)
  const heightRef = useRef(0)
  const springRef = useRef<Spring | null>(null)
  const closingRef = useRef(false)
  const dragRef = useRef({ active: false, startY: 0, startOffset: 0 })
  const trackerRef = useRef(createVelocityTracker())
  const onCloseRef = useRef(onClose)
  const reduceMotion = useReducedMotion()
  const reduceMotionRef = useRef(reduceMotion)
  useEffect(() => {
    onCloseRef.current = onClose
    reduceMotionRef.current = reduceMotion
  }, [onClose, reduceMotion])

  const measure = () => {
    heightRef.current = panelRef.current?.offsetHeight || window.innerHeight
  }

  // The backdrop fades with the sheet: fully dim at rest, clear once the
  // sheet is all the way down
  const setOffset = useCallback((y: number) => {
    offsetRef.current = y
    if (panelRef.current) panelRef.current.style.transform = y ? `translateY(${y}px)` : ''
    if (scrimRef.current) {
      scrimRef.current.style.opacity = y > 0 ? String(Math.max(0, 1 - y / heightRef.current)) : ''
    }
  }, [])

  const stopSpring = () => {
    springRef.current?.stop()
    springRef.current = null
  }
  useEffect(() => stopSpring, [])

  // Slide down past the bottom edge (the way it came in), then unmount.
  // Reduce Motion: closes instantly, as before.
  const dismiss = useCallback((velocity = 0) => {
    if (closingRef.current) return
    closingRef.current = true
    stopSpring()
    if (reduceMotionRef.current) {
      onCloseRef.current()
      return
    }
    measure()
    springRef.current = animateSpring({
      from: offsetRef.current,
      to: heightRef.current,
      velocity,
      damping: 1,
      response: 0.3,
      onUpdate: setOffset,
      onComplete: () => onCloseRef.current(),
    })
  }, [setOffset])

  const dismissFromButton = useCallback(() => dismiss(), [dismiss])

  const settle = useCallback((velocity: number) => {
    stopSpring()
    if (reduceMotionRef.current) {
      setOffset(0)
      return
    }
    springRef.current = animateSpring({
      from: offsetRef.current,
      to: 0,
      velocity,
      damping: Math.abs(velocity) > MOMENTUM_PX_S ? 0.8 : 1,
      response: 0.3,
      onUpdate: setOffset,
    })
  }, [setOffset])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [dismiss])

  // Grabbing stops any running spring -- including the close -- and picks
  // up from wherever the sheet is on screen, so it never jumps
  const beginDrag = useCallback((y: number) => {
    stopSpring()
    closingRef.current = false
    measure()
    dragRef.current = { active: true, startY: y, startOffset: offsetRef.current }
    trackerRef.current.reset()
    trackerRef.current.add(y)
  }, [])

  const moveDrag = useCallback((y: number) => {
    const d = dragRef.current
    if (!d.active) return
    trackerRef.current.add(y)
    const raw = d.startOffset + y - d.startY
    // Above the resting position: resist instead of stopping dead
    setOffset(raw < 0 ? rubberband(raw, heightRef.current) : raw)
  }, [setOffset])

  const endDrag = useCallback(() => {
    const d = dragRef.current
    if (!d.active) return
    d.active = false
    const velocity = trackerRef.current.velocity()
    const offset = offsetRef.current
    const heading = offset + project(velocity)
    const threshold = Math.min(heightRef.current * DISMISS_FRACTION, DISMISS_MAX_PX)
    if (offset > DISMISS_MIN_PX && heading > threshold) dismiss(velocity)
    else settle(velocity)
  }, [dismiss, settle])

  // Content area: a downward swipe that starts while scrolled to the top
  // drags the sheet. Native listeners because the touchmove has to be
  // non-passive to stop iOS from also rubber-banding the content. The
  // decision is made on the first move, before iOS commits to a scroll;
  // taps never move past the slop, so buttons and inputs work as usual.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    let startX = 0
    let startY = 0
    // 'undecided' until the first move, then 'sheet' or 'scroll' for the
    // rest of that touch
    let mode: 'undecided' | 'sheet' | 'scroll' = 'scroll'

    const handleStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        mode = 'scroll'
        return
      }
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      mode = el.scrollTop <= 0 ? 'undecided' : 'scroll'
    }

    const handleMove = (e: TouchEvent) => {
      if (mode === 'scroll') return
      const t = e.touches[0]
      const dy = t.clientY - startY
      const dx = t.clientX - startX
      if (mode === 'undecided') {
        // Upward or sideways: leave it to normal scrolling
        if (dy <= 0 || Math.abs(dx) > dy) {
          mode = 'scroll'
          return
        }
        mode = 'sheet'
      }
      if (e.cancelable) e.preventDefault()
      if (!dragRef.current.active) {
        if (dy < DRAG_SLOP_PX) return
        beginDrag(startY)
      }
      moveDrag(t.clientY)
    }

    const handleEnd = () => {
      mode = 'scroll'
      endDrag()
    }

    el.addEventListener('touchstart', handleStart, { passive: true })
    el.addEventListener('touchmove', handleMove, { passive: false })
    el.addEventListener('touchend', handleEnd)
    el.addEventListener('touchcancel', handleEnd)
    return () => {
      el.removeEventListener('touchstart', handleStart)
      el.removeEventListener('touchmove', handleMove)
      el.removeEventListener('touchend', handleEnd)
      el.removeEventListener('touchcancel', handleEnd)
    }
  }, [beginDrag, moveDrag, endDrag])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {/* Fade-in and drag-linked opacity live on separate elements -- an
          animation's fill-mode would otherwise override the inline opacity */}
      <div className="absolute inset-0 animate-sheet-backdrop">
        <div
          ref={scrimRef}
          className="glass-scrim absolute inset-0 bg-[#060e20]/70 backdrop-blur-sm"
          onClick={() => dismiss()}
        />
      </div>
      {/* Same split for the entrance animation and the drag offset */}
      <div className="relative w-full max-w-md animate-sheet-up">
        <div
          ref={panelRef}
          className={`relative flex flex-col rounded-t-2xl border border-b-0 border-white/10 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.6)] text-fg ${className}`}
        >
          {/* Sheet-colored strip hanging below the bottom edge, so stretching
              the sheet up (or a bouncy snap-back) never shows a gap under it */}
          <div aria-hidden="true" className="absolute -inset-x-px top-full h-24 bg-inherit border-x border-white/10" />
          {/* Grab handle: same thin line, centered in a 44px-tall drag strip.
              touch-none so a vertical drag here moves the sheet, not the page.
              Pointer events cover touch and mouse. */}
          <div
            onPointerDown={(e) => {
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                // Capture is a nicety (keeps the drag if the finger leaves the strip)
              }
              beginDrag(e.clientY)
            }}
            onPointerMove={(e) => moveDrag(e.clientY)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="shrink-0 h-[max(44px,2.75rem)] flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
            aria-hidden="true"
          >
            <span className="h-1 w-9 rounded-full bg-white/25" />
          </div>
          <div
            ref={contentRef}
            className="relative overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
          >
            <SheetDismissContext.Provider value={dismissFromButton}>{children}</SheetDismissContext.Provider>
          </div>
        </div>
      </div>
    </div>
  )
}
