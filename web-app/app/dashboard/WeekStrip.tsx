'use client'

import { useLayoutEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Haptics } from '@capacitor/haptics'
import { shiftDate } from '@/lib/streak'
import { useReducedMotion } from '@/lib/useReducedMotion'

/** Days a day-tap slides the window */
const TAP_SHIFT = 3
/** Days a chevron slides the window */
const CHEVRON_SHIFT = 7

interface WeekStripProps {
  /** Today's Pacific date, 'YYYY-MM-DD' (logDateFor) */
  todayStr: string
  /** Days the window is moved back. 0 = today is the rightmost day. */
  back: number
  /** Furthest `back` allowed (the window never pages past the earliest logged day) */
  maxBack: number
  /** The day shown below; always a 'YYYY-MM-DD' (today when nothing else is picked) */
  selected: string
  /** Dates (not hidden by a pending delete) that have at least one log */
  loggedDates: ReadonlySet<string>
  onSelect: (date: string) => void
  onBackChange: (back: number) => void
}

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

const letterFor = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })

/**
 * Rolling 7-day strip for the Progress tab, today on the right. Plain text
 * columns: letter, date number, a quiet dot when something was logged and one
 * gold bar under the selected day. There are no future days.
 */
export default function WeekStrip({ todayStr, back, maxBack, selected, loggedDates, onSelect, onBackChange }: WeekStripProps) {
  const reduceMotion = useReducedMotion()
  const gridRef = useRef<HTMLDivElement>(null)
  const prevBack = useRef(back)

  const end = shiftDate(todayStr, -back)
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(end, i - 6))

  // Slide the row in from the side the new days came from
  useLayoutEffect(() => {
    const delta = back - prevBack.current
    prevBack.current = back
    if (delta === 0 || reduceMotion) return
    const el = gridRef.current
    if (!el || typeof el.animate !== 'function') return
    const from = (Math.max(-7, Math.min(7, -delta)) / 7) * 100
    el.animate(
      [{ transform: `translateX(${from}%)`, opacity: 0.4 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    )
  }, [back, reduceMotion])

  const move = (next: number) => {
    const clamped = Math.max(0, Math.min(maxBack, next))
    if (clamped !== back) onBackChange(clamped)
  }

  const tap = (date: string, i: number) => {
    Haptics.selectionChanged().catch(() => {})
    onSelect(date)
    if (i === 0) move(back + TAP_SHIFT)
    else if (i === 6 && back > 0) move(back - TAP_SHIFT)
  }

  const chevron = (next: number) => {
    Haptics.selectionChanged().catch(() => {})
    move(next)
  }

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => chevron(back + CHEVRON_SHIFT)}
          disabled={back >= maxBack}
          aria-label="Previous 7 days"
          className="size-tap flex items-center justify-center text-fg-muted hover:text-fg press active:opacity-70 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <p className="text-xs font-medium text-fg-muted tabular-nums whitespace-nowrap">
          {shortDate(days[0])} – {shortDate(days[6])}
        </p>
        <button
          type="button"
          onClick={() => chevron(back - CHEVRON_SHIFT)}
          disabled={back <= 0}
          aria-label="Next 7 days"
          className="size-tap flex items-center justify-center text-fg-muted hover:text-fg press active:opacity-70 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="overflow-hidden">
        <div ref={gridRef} className="grid grid-cols-7">
          {days.map((date, i) => {
            const isToday = date === todayStr
            const isSelected = date === selected
            const dayNum = Number(date.slice(8))
            return (
              <button
                key={date}
                type="button"
                onClick={() => tap(date, i)}
                aria-pressed={isSelected}
                aria-label={`${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}${isToday ? ', today' : ''}${loggedDates.has(date) ? ', has logged meals' : ''}`}
                className={`min-w-0 min-h-tap flex flex-col items-center justify-center gap-0.5 py-1 whitespace-nowrap press active:opacity-70 ${isToday ? 'text-fg' : 'text-fg-subtle'}`}
              >
                <span className="text-xs font-medium text-fg-muted">{letterFor(date)}</span>
                <span className={`text-base tabular-nums ${isToday ? 'font-bold' : 'font-semibold'}`}>{dayNum}</span>
                <span aria-hidden="true" className="h-1 flex items-center">
                  {loggedDates.has(date) && <span className="size-1 rounded-full bg-fg-muted" />}
                </span>
                <span aria-hidden="true" className={`h-0.5 w-4 rounded-sm ${isSelected ? 'bg-gold' : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
