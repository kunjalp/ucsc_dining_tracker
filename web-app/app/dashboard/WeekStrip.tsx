'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { shiftDate } from '@/lib/streak'

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface WeekStripProps {
  /** Today's Pacific date, 'YYYY-MM-DD' (logDateFor) */
  todayStr: string
  /** 0 = this week, -1 = last week, ... Never above 0 */
  weekOffset: number
  /** The day shown below; always a 'YYYY-MM-DD' (today when nothing else is picked) */
  selected: string
  /** Dates (not hidden by a pending delete) that have at least one log */
  loggedDates: ReadonlySet<string>
  onSelect: (date: string) => void
  onWeekChange: (offset: number) => void
}

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * Sunday-to-Saturday strip for the Progress tab. Plain text rows: letter, date
 * number, a quiet dot when something was logged and one gold bar under the
 * selected day. Future days are muted and can't be tapped.
 */
export default function WeekStrip({ todayStr, weekOffset, selected, loggedDates, onSelect, onWeekChange }: WeekStripProps) {
  const dow = new Date(`${todayStr}T12:00:00Z`).getUTCDay()
  const start = shiftDate(todayStr, -dow + weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(start, i))

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onWeekChange(weekOffset - 1)}
          aria-label="Previous week"
          className="size-tap flex items-center justify-center text-fg-muted hover:text-fg press active:opacity-70"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
        </button>
        <p className="text-xs font-medium text-fg-muted tabular-nums">
          {shortDate(days[0])} – {shortDate(days[6])}
        </p>
        <button
          type="button"
          onClick={() => onWeekChange(weekOffset + 1)}
          disabled={weekOffset >= 0}
          aria-label="Next week"
          className="size-tap flex items-center justify-center text-fg-muted hover:text-fg press active:opacity-70 disabled:opacity-0 disabled:pointer-events-none"
        >
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          const isFuture = date > todayStr
          const isToday = date === todayStr
          const isSelected = date === selected
          const dayNum = Number(date.slice(8))
          const tone = isFuture ? 'text-fg-muted' : isToday ? 'text-fg' : 'text-fg-subtle'
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}${isToday ? ', today' : ''}${loggedDates.has(date) ? ', has logged meals' : ''}`}
              className={`min-h-tap flex flex-col items-center justify-center gap-0.5 py-1 press active:opacity-70 disabled:cursor-default disabled:active:opacity-100 ${tone}`}
            >
              <span className="text-xs font-medium text-fg-muted">{LETTERS[i]}</span>
              <span className={`text-base tabular-nums ${isToday ? 'font-bold' : 'font-semibold'}`}>{dayNum}</span>
              <span aria-hidden="true" className="h-1 flex items-center">
                {loggedDates.has(date) && !isFuture && <span className="size-1 rounded-full bg-fg-muted" />}
              </span>
              <span aria-hidden="true" className={`h-0.5 w-4 rounded-sm ${isSelected ? 'bg-gold' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
