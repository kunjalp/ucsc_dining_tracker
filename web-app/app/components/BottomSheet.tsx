'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { animateSpring, createVelocityTracker, project, rubberband, type Spring } from '@/lib/spring'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { lockScroll, unlockScroll } from '@/lib/scrollLock'

interface BottomSheetProps {
  onClose: () => void
  labelledBy: string
  children: ReactNode
  // Background + max height, e.g. "bg-surface-2 max-h-[85dvh]"
  className?: string
  // Opt-in second snap point: swipe up (or tap the handle) to grow the sheet
  // to nearly full screen, swipe down to come back. Off for every other sheet.
  expandable?: boolean
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

// Expanded height: the full screen minus the status bar and a small gap, so
// it still reads as a sheet. A hidden probe element has this height so JS
// gets the exact same number in px.
const FULL_HEIGHT_CSS = 'calc(100dvh - env(safe-area-inset-top) - 0.5rem)'

// The enclosing sheet's animated close (slide down, then onClose)
const SheetDismissContext = createContext<() => void>(() => {})
// Whether an expandable sheet is at (or heading to) full height
const SheetExpandedContext = createContext(false)

// Render prop for content that lays out differently when the sheet is
// expanded (for content written inline by the sheet's parent)
export function SheetExpanded({ children }: { children: (expanded: boolean) => ReactNode }) {
  return <>{children(useContext(SheetExpandedContext))}</>
}

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
export default function BottomSheet({
  onClose,
  labelledBy,
  children,
  className = 'bg-surface-2 max-h-[85dvh]',
  expandable = false,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const fullProbeRef = useRef<HTMLDivElement>(null)
  // What's on screen right now: px below the resting position (negative =
  // stretched up past it)
  const offsetRef = useRef(0)
  const heightRef = useRef(0)
  const springRef = useRef<Spring | null>(null)
  const closingRef = useRef(false)
  const dragRef = useRef({ active: false, startY: 0, startOffset: 0, moved: false })
  // Expandable only. offsetRef runs from -extra (full) through 0 (default)
  // to heightRef (closed); heightRef is the default height. Resting at
  // default, CSS sizes the panel (auto, capped by className); resting at
  // full it's FULL_HEIGHT_CSS; while dragging or animating it's px.
  const snapRef = useRef<'default' | 'full'>('default')
  const extraRef = useRef(0)
  const autoRestRef = useRef(true)
  const fullRestRef = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const trackerRef = useRef(createVelocityTracker())
  const onCloseRef = useRef(onClose)
  const reduceMotion = useReducedMotion()
  const reduceMotionRef = useRef(reduceMotion)
  useEffect(() => {
    onCloseRef.current = onClose
    reduceMotionRef.current = reduceMotion
  }, [onClose, reduceMotion])

  const measure = useCallback(() => {
    const panel = panelRef.current
    if (!expandable) {
      heightRef.current = panel?.offsetHeight || window.innerHeight
      return
    }
    // The default height can only be read while CSS is sizing the panel;
    // otherwise keep the last reading
    if (autoRestRef.current || !heightRef.current) {
      heightRef.current = panel?.offsetHeight || window.innerHeight
    }
    const full = fullProbeRef.current?.offsetHeight || window.innerHeight
    extraRef.current = Math.max(0, full - heightRef.current)
    if (autoRestRef.current) {
      offsetRef.current = 0
    } else if (fullRestRef.current) {
      offsetRef.current = -extraRef.current
    }
  }, [expandable])

  // Expandable: hand the panel's height to JS (px) for a drag or a snap
  const takeHeight = useCallback(() => {
    if (!expandable) return
    measure()
    autoRestRef.current = false
    fullRestRef.current = false
    if (panelRef.current) panelRef.current.style.maxHeight = 'none'
  }, [expandable, measure])

  // The backdrop fades with the sheet: fully dim at rest, clear once the
  // sheet is all the way down
  const setOffset = useCallback((y: number) => {
    offsetRef.current = y
    const panel = panelRef.current
    if (panel && expandable) {
      // Above default the sheet grows; below it, it slides down at default height
      panel.style.height = `${heightRef.current - Math.min(0, y)}px`
      panel.style.transform = y > 0 ? `translateY(${y}px)` : ''
    } else if (panel) {
      panel.style.transform = y ? `translateY(${y}px)` : ''
    }
    if (scrimRef.current) {
      scrimRef.current.style.opacity = y > 0 ? String(Math.max(0, 1 - y / heightRef.current)) : ''
    }
  }, [expandable])

  const stopSpring = () => {
    springRef.current?.stop()
    springRef.current = null
  }
  useEffect(() => stopSpring, [])

  // Every sheet locks the page behind it while mounted
  useEffect(() => {
    lockScroll()
    return unlockScroll
  }, [])

  // Expandable: park at a snap point and give sizing back to CSS, so the
  // sheet follows content changes (default) and resizes (full)
  const restAt = useCallback((snap: 'default' | 'full') => {
    const panel = panelRef.current
    springRef.current = null
    if (!panel) return
    panel.style.transform = ''
    if (snap === 'full') {
      panel.style.maxHeight = 'none'
      panel.style.height = FULL_HEIGHT_CSS
      offsetRef.current = -extraRef.current
      fullRestRef.current = true
    } else {
      panel.style.maxHeight = ''
      panel.style.height = ''
      offsetRef.current = 0
      autoRestRef.current = true
      setExpanded(false)
    }
  }, [])

  // Expandable: spring to a snap point, with a light haptic when it changes
  const goTo = useCallback((snap: 'default' | 'full', velocity = 0) => {
    stopSpring()
    takeHeight()
    if (snap !== snapRef.current) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    snapRef.current = snap
    // Content grows with the sheet; it shrinks back only once the sheet is down
    if (snap === 'full') setExpanded(true)
    const to = snap === 'full' ? -extraRef.current : 0
    if (reduceMotionRef.current) {
      setOffset(to)
      restAt(snap)
      return
    }
    springRef.current = animateSpring({
      from: offsetRef.current,
      to,
      velocity,
      // No overshoot toward full, so it never bumps into the status bar
      damping: snap === 'default' && Math.abs(velocity) > MOMENTUM_PX_S ? 0.8 : 1,
      response: 0.3,
      onUpdate: setOffset,
      onComplete: () => restAt(snap),
    })
  }, [setOffset, takeHeight, restAt])

  const toggle = useCallback(() => {
    goTo(snapRef.current === 'full' ? 'default' : 'full')
  }, [goTo])

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
    if (expandable) {
      takeHeight()
      // Expanded (or on the way): slide the whole sheet down at its current
      // height instead of shrinking it first
      if (offsetRef.current < 0 && panelRef.current) {
        heightRef.current = panelRef.current.offsetHeight
        offsetRef.current = 0
      }
    }
    springRef.current = animateSpring({
      from: offsetRef.current,
      to: heightRef.current,
      velocity,
      damping: 1,
      response: 0.3,
      onUpdate: setOffset,
      onComplete: () => onCloseRef.current(),
    })
  }, [setOffset, measure, takeHeight, expandable])

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
    takeHeight()
    dragRef.current = { active: true, startY: y, startOffset: offsetRef.current, moved: false }
    trackerRef.current.reset()
    trackerRef.current.add(y)
  }, [measure, takeHeight])

  const moveDrag = useCallback((y: number) => {
    const d = dragRef.current
    if (!d.active) return
    trackerRef.current.add(y)
    if (Math.abs(y - d.startY) >= DRAG_SLOP_PX) d.moved = true
    const raw = d.startOffset + y - d.startY
    // Above the highest snap (default, or full when expandable): resist
    // instead of stopping dead
    const top = -extraRef.current
    setOffset(raw < top ? top + rubberband(raw - top, heightRef.current) : raw)
  }, [setOffset])

  const endDrag = useCallback(() => {
    const d = dragRef.current
    if (!d.active) return
    d.active = false
    const velocity = trackerRef.current.velocity()
    const offset = offsetRef.current
    const heading = offset + project(velocity)
    const threshold = Math.min(heightRef.current * DISMISS_FRACTION, DISMISS_MAX_PX)
    if (!expandable) {
      if (offset > DISMISS_MIN_PX && heading > threshold) dismiss(velocity)
      else settle(velocity)
      return
    }
    // A tap on the handle toggles default <-> full
    if (!d.moved) {
      toggle()
      return
    }
    // From full, a swipe down lands on default; it only closes if the
    // finger itself pulled the sheet well past default
    const fromFull = d.startOffset < -DISMISS_MIN_PX
    if (offset > DISMISS_MIN_PX && (fromFull ? offset : heading) > threshold) dismiss(velocity)
    else goTo(heading < -extraRef.current / 2 ? 'full' : 'default', velocity)
  }, [dismiss, settle, expandable, toggle, goTo])

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
      // Expandable at default: a swipe up grows the sheet even if the
      // content is scrolled, so stay undecided
      mode = el.scrollTop <= 0 || (expandable && snapRef.current === 'default') ? 'undecided' : 'scroll'
    }

    const handleMove = (e: TouchEvent) => {
      if (mode === 'scroll') return
      const t = e.touches[0]
      const dy = t.clientY - startY
      const dx = t.clientX - startX
      if (mode === 'undecided') {
        // Down while at the top drags the sheet (to close, or from full back
        // to default). Up drags it only while it can still grow (expandable,
        // at default). Sideways or anything else: normal scrolling.
        const sheetDrag =
          dy < 0
            ? expandable && snapRef.current === 'default' && Math.abs(dx) < -dy
            : dy > 0 && el.scrollTop <= 0 && Math.abs(dx) <= dy
        if (!sheetDrag) {
          mode = 'scroll'
          return
        }
        mode = 'sheet'
      }
      if (e.cancelable) e.preventDefault()
      if (!dragRef.current.active) {
        if (Math.abs(dy) < DRAG_SLOP_PX) return
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
  }, [beginDrag, moveDrag, endDrag, expandable])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      {expandable && (
        <div
          ref={fullProbeRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-0 w-0 h-[calc(100dvh_-_env(safe-area-inset-top)_-_0.5rem)]"
        />
      )}
      {/* Fade-in and drag-linked opacity live on separate elements -- an
          animation's fill-mode would otherwise override the inline opacity */}
      <div className="absolute inset-0 animate-sheet-backdrop">
        <div
          ref={scrimRef}
          className="glass-scrim absolute inset-0 bg-app-deep/70 backdrop-blur-sm"
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
            {...(expandable
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': expanded ? 'Collapse sheet' : 'Expand sheet',
                  'aria-expanded': expanded,
                  onKeyDown: (e: ReactKeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle()
                    }
                  },
                }
              : { 'aria-hidden': true })}
          >
            <span className="h-1 w-9 rounded-full bg-white/25" />
          </div>
          <div
            ref={contentRef}
            className="relative min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
          >
            <SheetDismissContext.Provider value={dismissFromButton}>
              <SheetExpandedContext.Provider value={expanded}>{children}</SheetExpandedContext.Provider>
            </SheetDismissContext.Provider>
          </div>
        </div>
      </div>
    </div>
  )
}
