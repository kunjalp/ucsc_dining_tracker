'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { animateSpring, createVelocityTracker, project, rubberband, type Spring } from '@/lib/spring'
import { useReducedMotion } from '@/lib/useReducedMotion'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: number
  message: string
  tone: ToastTone
  // Dismissed and animating out; removed once the exit finishes
  leaving?: boolean
}

// How long a message toast stays up before dismissing itself
const TOAST_DURATION_MS = 4000
// After a finger lets go of a held toast, it stays at least this long
const MIN_RESUME_MS = 1500
// At most this many message toasts on screen; the oldest makes room
const MAX_TOASTS = 2

// Queue of short-lived message toasts. showToast() replaces alert() --
// nothing blocks, and errors read in the danger color instead of a system popup.
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextIdRef = useRef(1)
  // Auto-dismiss clock per toast: the running timer (none while held), when
  // it started, and how long it had left at that point
  const timersRef = useRef<Map<number, { timer?: ReturnType<typeof setTimeout>; startedAt: number; remaining: number }>>(new Map())

  const clearTimer = useCallback((id: number) => {
    const entry = timersRef.current.get(id)
    if (entry?.timer) clearTimeout(entry.timer)
    timersRef.current.delete(id)
  }, [])

  // Starts the exit animation; the toast calls removeToast when it's done
  const dismissToast = useCallback((id: number) => {
    clearTimer(id)
    setToasts((prev) => prev.map((t) => (t.id === id && !t.leaving ? { ...t, leaving: true } : t)))
  }, [clearTimer])

  const removeToast = useCallback((id: number) => {
    clearTimer(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [clearTimer])

  const startTimer = useCallback((id: number, ms: number) => {
    timersRef.current.set(id, { timer: setTimeout(() => dismissToast(id), ms), startedAt: Date.now(), remaining: ms })
  }, [dismissToast])

  // While a finger is on a toast its clock stops, so it can't vanish
  // mid-read or mid-swipe
  const holdToast = useCallback((id: number, held: boolean) => {
    const entry = timersRef.current.get(id)
    if (!entry) return
    if (held) {
      if (!entry.timer) return
      clearTimeout(entry.timer)
      entry.timer = undefined
      entry.remaining -= Date.now() - entry.startedAt
    } else if (!entry.timer) {
      startTimer(id, Math.max(entry.remaining, MIN_RESUME_MS))
    }
  }, [startTimer])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextIdRef.current++
    setToasts((prev) => {
      const live = prev.filter((t) => !t.leaving)
      const evictId = live.length >= MAX_TOASTS ? live[0].id : null
      return [...prev.map((t) => (t.id === evictId ? { ...t, leaving: true } : t)), { id, message, tone }]
    })
    startTimer(id, TOAST_DURATION_MS)
  }, [startTimer])

  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((entry) => entry.timer && clearTimeout(entry.timer))
  }, [])

  return { toasts, showToast, dismissToast, removeToast, holdToast }
}

// For a toast its owner shows while some value is set (e.g. the undo toast
// while undoLog is set): keeps the last value around after it's cleared, so
// the toast can animate out before unmounting.
export function useToastPresence<T>(value: T | null) {
  const [item, setItem] = useState<T | null>(value)
  if (value !== null && value !== item) setItem(value)
  const onExited = useCallback(() => setItem(null), [])
  return { item, leaving: value === null && item !== null, onExited }
}

// Swipe: movement before a press counts as a drag rather than a tap
const SWIPE_SLOP_PX = 10
// Tap/timer exit: drops this far toward the tab bar while fading out
const EXIT_DROP_PX = 12

interface ToastProps {
  tone?: ToastTone
  children: ReactNode
  // Optional trailing button, e.g. "Undo"
  action?: { label: string; onClick: () => void }
  // Tap or swipe down asks the owner to dismiss it. Without it, the toast
  // can't be swiped away.
  onDismiss?: () => void
  // Set by the owner once dismissed: the toast animates out, then calls
  // onExited so the owner can drop it
  leaving?: boolean
  onExited?: () => void
  // Finger down / up -- the owner pauses its auto-dismiss in between
  onHold?: (held: boolean) => void
}

// One toast: navy surface, gold accent (danger red for errors).
// Three layers: the slot collapses its height on exit (so the toasts above
// slide down instead of jumping), the middle plays the CSS entrance, and
// the card takes the drag/exit transform -- an animation's fill-mode would
// otherwise override the inline transform.
export function Toast({ tone = 'info', children, action, onDismiss, leaving = false, onExited, onHold }: ToastProps) {
  const isError = tone === 'error'
  const slotRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  // Distance over which the card fades out as it moves down
  const fadeOverRef = useRef(1)
  const springRef = useRef<Spring | null>(null)
  const exitingRef = useRef(false)
  const dragRef = useRef<{ startY: number; startOffset: number; dragging: boolean } | null>(null)
  // Set by a swipe so the click that follows doesn't also count as a tap
  const movedRef = useRef(false)
  // Finger currently down (onHold(true) sent, onHold(false) not yet)
  const heldRef = useRef(false)
  const trackerRef = useRef(createVelocityTracker())
  const reduceMotion = useReducedMotion()
  const reduceMotionRef = useRef(reduceMotion)
  const onExitedRef = useRef(onExited)
  useEffect(() => {
    reduceMotionRef.current = reduceMotion
    onExitedRef.current = onExited
  }, [reduceMotion, onExited])

  const stopSpring = () => {
    springRef.current?.stop()
    springRef.current = null
  }
  useEffect(() => stopSpring, [])

  const setOffset = useCallback((y: number) => {
    offsetRef.current = y
    const card = cardRef.current
    if (!card) return
    card.style.transform = y ? `translateY(${y}px)` : ''
    card.style.opacity = y > 0 ? String(Math.max(0, 1 - y / fadeOverRef.current)) : ''
  }, [])

  // Out the way it came in -- down toward the tab bar, fading -- then the
  // slot folds shut. A swipe carries its speed and a full card height.
  // Reduce Motion: gone instantly, as before.
  const exit = useCallback((swiped: boolean, velocity = 0) => {
    if (exitingRef.current) return
    exitingRef.current = true
    stopSpring()
    const card = cardRef.current
    const slot = slotRef.current
    if (reduceMotionRef.current || !card || !slot) {
      onExitedRef.current?.()
      return
    }
    const distance = swiped ? card.offsetHeight : EXIT_DROP_PX
    fadeOverRef.current = distance
    springRef.current = animateSpring({
      from: offsetRef.current,
      to: distance,
      velocity,
      response: 0.25,
      onUpdate: setOffset,
      onComplete: () => {
        slot.style.overflow = 'hidden'
        springRef.current = animateSpring({
          from: slot.offsetHeight,
          to: 0,
          response: 0.3,
          onUpdate: (h) => {
            slot.style.height = `${Math.max(0, h)}px`
          },
          onComplete: () => onExitedRef.current?.(),
        })
      },
    })
  }, [setOffset])

  useEffect(() => {
    if (leaving) exit(false)
  }, [leaving, exit])

  // Swipe-to-dismiss needs onDismiss; pause-on-press only needs onHold
  // (the undo toast pauses but can't be swiped away)
  const swipeable = !!onDismiss
  const holdable = swipeable || !!onHold

  const endPress = () => {
    if (heldRef.current) {
      heldRef.current = false
      onHold?.(false)
    }
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    if (!d.dragging || exitingRef.current) return
    const height = cardRef.current?.offsetHeight ?? 48
    const velocity = trackerRef.current.velocity()
    const offset = offsetRef.current
    if (offset > 0 && offset + project(velocity) > height / 2) {
      exit(true, velocity)
      onDismiss?.()
      return
    }
    stopSpring()
    if (reduceMotionRef.current) {
      setOffset(0)
      return
    }
    springRef.current = animateSpring({ from: offset, to: 0, velocity, response: 0.3, onUpdate: setOffset })
  }

  return (
    <div ref={slotRef} className="w-full max-w-md pb-2">
      <div className="animate-ring-toast">
        <div
          ref={cardRef}
          role={isError ? 'alert' : 'status'}
          aria-live={isError ? 'assertive' : 'polite'}
          onClick={action ? undefined : onDismiss}
          onClickCapture={(e) => {
            if (!movedRef.current) return
            movedRef.current = false
            e.preventDefault()
            e.stopPropagation()
          }}
          onPointerDown={holdable ? (e) => {
            if (exitingRef.current) return
            heldRef.current = true
            onHold?.(true)
            // Not swipeable: no pointer capture either, which would retarget
            // the click away from the Undo button
            if (!swipeable) return
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // Capture is a nicety (keeps the drag if the finger leaves the toast)
            }
            // Grabbed mid snap-back: carry on from where it is now
            stopSpring()
            movedRef.current = false
            dragRef.current = { startY: e.clientY, startOffset: offsetRef.current, dragging: false }
            fadeOverRef.current = e.currentTarget.offsetHeight
            trackerRef.current.reset()
            trackerRef.current.add(e.clientY)
          } : undefined}
          onPointerMove={swipeable ? (e) => {
            const d = dragRef.current
            if (!d) return
            const dy = e.clientY - d.startY
            if (!d.dragging) {
              if (Math.abs(dy) < SWIPE_SLOP_PX) return
              d.dragging = true
              movedRef.current = true
            }
            trackerRef.current.add(e.clientY)
            const raw = d.startOffset + dy
            // Upward: resist instead of following 1:1
            setOffset(raw < 0 ? rubberband(raw, fadeOverRef.current) : raw)
          } : undefined}
          onPointerUp={holdable ? endPress : undefined}
          onPointerCancel={holdable ? endPress : undefined}
          onPointerLeave={holdable ? endPress : undefined}
          className={`pointer-events-auto w-full flex items-center gap-3 pl-4 ${action ? 'pr-1 py-1' : 'pr-4 py-3'} rounded-2xl bg-surface-2 border shadow-[0_8px_30px_-6px_rgba(0,0,0,0.6)] ${
            swipeable ? 'touch-none select-none' : ''
          } ${isError ? 'border-danger/40' : 'border-gold/30'}`}
        >
          {tone === 'error' && <AlertCircle size={16} className="shrink-0 text-danger" aria-hidden="true" />}
          {tone === 'success' && <Check size={16} strokeWidth={2.75} className="shrink-0 text-gold" aria-hidden="true" />}
          <span className={`flex-1 min-w-0 text-sm ${isError ? 'text-danger' : 'text-fg'}`}>{children}</span>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="min-h-tap px-4 rounded-xl text-sm font-semibold text-gold hover:bg-gold/10 active:scale-95 motion-reduce:active:scale-100 transition"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// The one place toasts render: stacked above the floating tab bar and the
// Sammy perched on it (12px gap + ~50px bar + ~40px for Sammy and his
// celebrate bounce, over the home-indicator inset), so the undo toast and
// message toasts share a column and never cover him or each other.
// Spacing comes from each toast's own pb-2 (not gap-2), so it folds away
// with the toast; bottom is 8px lower to match, landing cards where they were.
export function ToastStack({ toasts, onDismiss, onExited, onHold, children }: {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
  onExited: (id: number) => void
  onHold: (id: number, held: boolean) => void
  children?: ReactNode // persistent toasts, e.g. the undo toast
}) {
  return (
    <div
      className="fixed left-0 right-0 z-[60] px-4 flex flex-col-reverse items-center pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
    >
      {children}
      {toasts.map((t) => (
        <Toast
          key={t.id}
          tone={t.tone}
          leaving={t.leaving}
          onDismiss={() => onDismiss(t.id)}
          onExited={() => onExited(t.id)}
          onHold={(held) => onHold(t.id, held)}
        >
          {t.message}
        </Toast>
      ))}
    </div>
  )
}
