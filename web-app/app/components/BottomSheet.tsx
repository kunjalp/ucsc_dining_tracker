'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface BottomSheetProps {
  onClose: () => void
  labelledBy: string
  children: ReactNode
  // Background + max height, e.g. "bg-surface-2 max-h-[85dvh]"
  className?: string
}

// How far the sheet has to be dragged down before letting go closes it
const DISMISS_DRAG_PX = 90
// ...or a quick downward flick (px per ms) after at least FLICK_MIN_PX
const FLICK_VELOCITY = 0.5
const FLICK_MIN_PX = 20
// Movement before a touch on the content counts as a drag rather than a tap
const DRAG_SLOP_PX = 6

// iOS-style bottom sheet: docks to the bottom edge, slides up, and pads its
// content past the home indicator (safe-area-inset-bottom) so the last
// button is never under it. Swipe down to dismiss works from the 44px grab
// handle strip, and from the content itself while it's scrolled to the top
// (like native sheets) -- once the content is scrolled down, swipes scroll.
export default function BottomSheet({ onClose, labelledBy, children, className = 'bg-surface-2 max-h-[85dvh]' }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  // Live drag bookkeeping in a ref so the native touch listeners (attached
  // once) always see current values
  const dragRef = useRef({ active: false, startY: 0, lastY: 0, lastT: 0, velocity: 0, dy: 0 })
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const beginDrag = useCallback((y: number) => {
    dragRef.current = { active: true, startY: y, lastY: y, lastT: performance.now(), velocity: 0, dy: 0 }
    setDragging(true)
  }, [])

  const moveDrag = useCallback((y: number) => {
    const d = dragRef.current
    if (!d.active) return
    const now = performance.now()
    if (now > d.lastT) d.velocity = (y - d.lastY) / (now - d.lastT)
    d.lastY = y
    d.lastT = now
    d.dy = Math.max(0, y - d.startY)
    setDragY(d.dy)
  }, [])

  const endDrag = useCallback(() => {
    const d = dragRef.current
    if (!d.active) return
    d.active = false
    setDragging(false)
    const flicked = d.velocity > FLICK_VELOCITY && d.dy > FLICK_MIN_PX
    if (d.dy > DISMISS_DRAG_PX || flicked) onCloseRef.current()
    else setDragY(0)
  }, [])

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
      <div
        className="absolute inset-0 bg-[#060e20]/70 backdrop-blur-sm animate-sheet-backdrop"
        onClick={onClose}
      />
      {/* Entrance animation and drag offset live on separate elements -- an
          animation's fill-mode would otherwise override the inline transform */}
      <div className="relative w-full max-w-md animate-sheet-up">
        <div
          className={`flex flex-col rounded-t-2xl border border-b-0 border-white/10 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.6)] text-fg motion-reduce:transition-none ${dragging ? 'transition-none' : 'transition-transform duration-200 ease-out'} ${className}`}
          style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        >
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
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
