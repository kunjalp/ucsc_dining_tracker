'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import {
  CAL_HIT_MAX,
  CAL_HIT_MIN,
  PROTEIN_HIT_MIN,
  computeWeeklySummary,
  macroSplit,
  type DayStat,
  type SummaryLog,
} from '@/lib/weeklySummary'

// Week tab of the Analytics sheet: the 7 completed days before today as a bar
// chart, then averages, days on target and the day closest to target.
interface WeekAnalyticsProps {
  logs: SummaryLog[]
  goalCalories: number
  goalProtein: number
  targetsSaved: boolean
  todayStr: string
  loaded: boolean
}

function weekHeadline(hitDays: number, loggedDays: number): string {
  if (loggedDays === 0) return 'No logs in the last 7 days.'
  if (hitDays >= 6) return `${hitDays} of 7 days on target. Incredible week!`
  if (hitDays >= 4) return `${hitDays} of 7 days on target. Strong week!`
  if (hitDays >= 2) return `${hitDays} of 7 days on target. Nice, keep building.`
  if (hitDays === 1) return '1 of 7 days on target. A fresh week is a fresh start.'
  return `You logged ${loggedDays} of 7 days. Let's aim for a target day this week.`
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

// "Tue, Nov 17"
const longDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

const MACRO_NAME = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' } as const

// The split, or null when there's nothing to split (no logs, or logs
// without macro data)
function splitFor(d: DayStat) {
  if (!d.logged) return null
  const parts = macroSplit(d)
  return parts.some((p) => p.share > 0) ? parts : null
}

function barLabel(d: DayStat, goalCalories: number) {
  const head = longDate(d.date)
  if (!d.logged) return `${head}: No meals logged`
  const parts = splitFor(d)
  const macros = parts ? ' ' + parts.map((p) => `${MACRO_NAME[p.key]} ${fmt(p.grams)}g, ${p.pct}%.`).join(' ') : ''
  return `${head}: ${fmt(d.calories)} of ${fmt(goalCalories)} calories.${macros}${d.hit ? ' On target.' : ''}`
}

// Press and hold ~250ms to see a day's macro split (slide to move it, let go
// to hide it); a quick tap pins it until a tap elsewhere.
const HOLD_MS = 250
// Finger travel that turns a press into a scroll or sheet drag instead
const MOVE_SLOP_PX = 10
// Space between a bar's center and the popup
const POP_GAP_PX = 14

type Press = { id: number; x: number; y: number; i: number; holding: boolean; timer?: number }
const NO_PRESS: Press = { id: -1, x: 0, y: 0, i: -1, holding: false }

interface WeekBarChartProps {
  days: DayStat[]
  goalCalories: number
  selectedDate: string
  onSelect: (date: string) => void
}

function WeekBarChart({ days, goalCalories, selectedDate, onSelect }: WeekBarChartProps) {
  // Headroom above the taller of the goal and the biggest day
  const scaleMax = Math.max(goalCalories, ...days.map((d) => d.calories)) * 1.15 || 1
  const goalPct = (goalCalories / scaleMax) * 100

  const wrapRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<{ i: number; mode: 'hold' | 'pin' } | null>(null)
  // The press in progress (a ref, so pointer moves don't re-render)
  const press = useRef<Press>({ ...NO_PRESS })

  const indexAt = (clientX: number) => {
    const r = rowRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    return Math.min(days.length - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * days.length)))
  }

  const endPress = () => {
    window.clearTimeout(press.current.timer)
    press.current = { ...NO_PRESS }
  }
  useEffect(() => () => window.clearTimeout(press.current.timer), [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    endPress()
    const id = e.pointerId
    press.current = { id, x: e.clientX, y: e.clientY, i: indexAt(e.clientX), holding: false }
    press.current.timer = window.setTimeout(() => {
      const p = press.current
      if (p.id !== id) return
      p.holding = true
      try {
        rowRef.current?.setPointerCapture(id)
      } catch {
        // The pointer already ended
      }
      setActive({ i: p.i, mode: 'hold' })
      onSelect(days[p.i].date)
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    }, HOLD_MS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (e.pointerId !== p.id) return
    if (!p.holding) {
      // Moved before the hold kicked in: it's a scroll or a sheet drag
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_SLOP_PX) endPress()
      return
    }
    const i = indexAt(e.clientX)
    if (i !== p.i) {
      p.i = i
      setActive({ i, mode: 'hold' })
      onSelect(days[i].date)
      Haptics.selectionChanged().catch(() => {})
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current
    if (e.pointerId !== p.id) return
    if (p.holding) {
      setActive(null)
    } else {
      // Quick tap: pin this day (tapping the pinned day again closes it)
      const i = p.i
      setActive((a) => (a && a.mode === 'pin' && a.i === i ? null : { i, mode: 'pin' }))
      onSelect(days[i].date)
      Haptics.selectionChanged().catch(() => {})
    }
    endPress()
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (e.pointerId !== press.current.id) return
    if (press.current.holding) setActive(null)
    endPress()
  }

  // Once held, a move neither scrolls the page nor drags the sheet down;
  // before that, small jitters don't reach the sheet either. Native and
  // non-passive so preventDefault works on iOS.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      const p = press.current
      if (p.id === -1) return
      if (p.holding) {
        if (e.cancelable) e.preventDefault()
        e.stopPropagation()
        return
      }
      const t = e.touches[0]
      if (t && Math.hypot(t.clientX - p.x, t.clientY - p.y) <= MOVE_SLOP_PX) e.stopPropagation()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  // A pinned popup closes on a tap anywhere outside the bars
  useEffect(() => {
    if (active?.mode !== 'pin') return
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [active?.mode])

  // Beside the bar, on the side with room (right for the first half, left for
  // the second). At large Text sizes a middle bar may have room on neither
  // side; then it sits above the chart instead of covering the split. Always
  // kept inside the chart's edges, so it stays on screen at 390px.
  useLayoutEffect(() => {
    const pop = popRef.current
    const wrap = wrapRef.current
    if (!active || !pop || !wrap) return
    const W = wrap.clientWidth
    const pw = pop.offsetWidth
    const c = ((active.i + 0.5) / days.length) * W
    const right = c + POP_GAP_PX
    const leftSide = c - POP_GAP_PX - pw
    const rightFits = right + pw <= W
    const leftFits = leftSide >= 0
    let left: number
    let top = 0
    if (!rightFits && !leftFits) {
      left = c - pw / 2
      top = -(pop.offsetHeight + 8)
    } else if (active.i < (days.length - 1) / 2) {
      left = rightFits ? right : leftSide
    } else if (active.i > (days.length - 1) / 2) {
      left = leftFits ? leftSide : right
    } else {
      left = rightFits ? right : leftSide
    }
    left = Math.min(Math.max(0, left), Math.max(0, W - pw))
    pop.style.left = `${left}px`
    pop.style.top = `${top}px`
  }, [active, days.length])

  const shown = active ? days[active.i] : null
  const shownSplit = shown ? splitFor(shown) : null

  return (
    // Plot area is 7rem; the 1.5rem row of day letters sits under it
    <div ref={wrapRef} className="relative mt-3 select-none [-webkit-touch-callout:none]">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 border-t border-dashed border-fg-muted/60"
        style={{ bottom: `calc(1.5rem + ${(goalPct * 0.07).toFixed(3)}rem)` }}
      />
      <div
        ref={rowRef}
        role="radiogroup"
        aria-label="Daily calories, last 7 days. Press and hold a bar for its macro split."
        className="relative flex"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {days.map((d, i) => {
          const isSel = d.date === selectedDate
          const isActive = active?.i === i
          const split = isActive ? splitFor(d) : null
          const pct = d.logged ? Math.max(4, (d.calories / scaleMax) * 100) : 0
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={isSel}
              aria-label={barLabel(d, goalCalories)}
              // Keyboard only (detail 0); pointer taps are handled on the row
              onClick={(e) => {
                if (e.detail !== 0) return
                setActive((a) => (a && a.mode === 'pin' && a.i === i ? null : { i, mode: 'pin' }))
                onSelect(d.date)
              }}
              className="flex-1 min-w-0 flex flex-col items-center"
            >
              <span
                className={`h-28 w-full flex items-end justify-center transition-opacity duration-150 motion-reduce:transition-none ${
                  active && !isActive ? 'opacity-50' : ''
                }`}
              >
                <span
                  className={`w-4 rounded-full overflow-hidden flex flex-col-reverse gap-px transition-[height] duration-500 ease-out motion-reduce:transition-none ${
                    split ? '' : isSel ? 'bg-gold' : d.logged ? 'bg-fg-muted/40' : 'bg-line'
                  }`}
                  style={{ height: d.logged ? `${pct}%` : '0.25rem' }}
                >
                  {/* Bottom to top: protein, carbs, fat (flex-col-reverse) */}
                  {split?.map((p) => (
                    <span
                      key={p.key}
                      className="block w-full shrink-0"
                      style={{ height: `${p.share * 100}%`, backgroundColor: `var(--color-macro-${p.key})` }}
                    />
                  ))}
                </span>
              </span>
              <span className={`h-6 flex items-end text-10 font-bold ${isSel ? 'text-fg' : 'text-fg-muted'}`}>
                {d.label.slice(0, 1)}
              </span>
            </button>
          )
        })}
      </div>

      {/* The split in words. Never takes touches, so sliding keeps working
          under it; the bars' aria-labels carry the same text. */}
      {shown && (
        <div
          ref={popRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-10 w-max rounded-lg border border-line bg-surface px-3 py-2"
        >
          <p className="text-11 font-semibold text-fg whitespace-nowrap">{longDate(shown.date)}</p>
          {!shown.logged ? (
            <p className="mt-0.5 text-11 font-medium text-fg-muted whitespace-nowrap">No meals logged</p>
          ) : (
            <>
              <p className="mt-0.5 whitespace-nowrap leading-tight">
                <span className="font-numeral text-base font-semibold text-fg">{fmt(shown.calories)}</span>
                <span className="text-11 font-medium text-fg-muted"> /{fmt(goalCalories)} cal</span>
              </p>
              {shownSplit && (
                <div className="mt-1.5 grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 gap-y-0.5 text-11 tabular-nums whitespace-nowrap">
                  {shownSplit.map((p) => (
                    <div key={p.key} className="contents">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: `var(--color-macro-${p.key})` }} />
                      <span className="font-medium text-fg-muted">{MACRO_NAME[p.key]}</span>
                      <span className="font-semibold text-fg text-right">{fmt(p.grams)}g</span>
                      <span className="font-medium text-fg-muted text-right">{p.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function WeekAnalytics({ logs, goalCalories, goalProtein, targetsSaved, todayStr, loaded }: WeekAnalyticsProps) {
  const summary = useMemo(
    () => computeWeeklySummary(logs, { calories: goalCalories, protein: goalProtein }, todayStr),
    [logs, goalCalories, goalProtein, todayStr]
  )
  const headline = weekHeadline(summary.hitDays, summary.loggedDays)
  const best = summary.bestDay

  // The gold bar: the day the user tapped, else the most recent logged day
  const [picked, setPicked] = useState<string | null>(null)
  const lastLogged = [...summary.days].reverse().find((d) => d.logged)
  const selected = summary.days.find((d) => d.date === picked) ?? lastLogged ?? summary.days[summary.days.length - 1]

  return (
    <section aria-label="Last 7 days">
      <h3 className="text-xs font-bold uppercase tracking-wider text-fg">Last 7 days</h3>
      <p className="text-sm font-medium text-fg-muted text-balance mt-1" aria-live="polite">
        {!loaded ? 'Loading your week…' : !targetsSaved ? 'Set your targets to see how your week went.' : headline}
      </p>

      {loaded && targetsSaved && summary.loggedDays > 0 && (
        <>
          {/* The selected day, in numbers; the goal line's label at the top right */}
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate leading-none" aria-live="polite">
              <span className="text-xs font-semibold text-fg-muted mr-2">{selected.label}</span>
              {selected.logged ? (
                <>
                  <span className="font-numeral text-xl font-semibold text-fg">{fmt(selected.calories)}</span>
                  <span className="text-xs font-medium text-fg-muted"> cal</span>
                  <span className="text-xs font-medium text-fg-muted tabular-nums"> · {fmt(selected.protein)}g protein</span>
                </>
              ) : (
                <span className="text-xs font-medium text-fg-muted">No meals logged</span>
              )}
            </p>
            <span className="shrink-0 text-10 font-semibold text-fg-muted tabular-nums">
              <span aria-hidden="true" className="inline-block w-3 align-middle border-t border-dashed border-fg-muted/60 mr-1" />
              {fmt(goalCalories)}/day
            </span>
          </div>

          {/* Bars: calories per day against the dashed goal line */}
          <WeekBarChart days={summary.days} goalCalories={goalCalories} selectedDate={selected.date} onSelect={setPicked} />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 mt-5 border-t border-line pt-4">
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Avg calories</dt>
              <dd className="mt-0.5 whitespace-nowrap leading-none">
                <span className="font-numeral text-xl font-semibold text-fg">{fmt(summary.avgCalories)}</span>
                <span className="text-xs font-medium text-fg-muted"> /{fmt(goalCalories)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Avg protein</dt>
              <dd className="mt-0.5 whitespace-nowrap leading-none">
                <span className="font-numeral text-xl font-semibold text-fg">{fmt(summary.avgProtein)}</span>
                <span className="text-xs font-medium text-fg-muted"> /{fmt(goalProtein)}g</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Avg carbs</dt>
              <dd className="mt-0.5 whitespace-nowrap leading-none">
                <span className="font-numeral text-xl font-semibold text-fg">{fmt(summary.avgCarbs)}</span>
                <span className="text-xs font-medium text-fg-muted">g</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Avg fat</dt>
              <dd className="mt-0.5 whitespace-nowrap leading-none">
                <span className="font-numeral text-xl font-semibold text-fg">{fmt(summary.avgFat)}</span>
                <span className="text-xs font-medium text-fg-muted">g</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Days on target</dt>
              <dd className="mt-0.5 whitespace-nowrap leading-none">
                <span className="font-numeral text-xl font-semibold text-fg">{summary.hitDays}</span>
                <span className="text-xs font-medium text-fg-muted"> /7</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Closest to target</dt>
              <dd className="mt-0.5 text-lg font-semibold leading-none text-fg">{best ? best.label : '–'}</dd>
              {best && (
                <p className="mt-1 text-11 text-fg-muted tabular-nums">
                  {fmt(best.calories)} cal · {fmt(best.protein)}g protein
                </p>
              )}
            </div>
          </dl>
          <p className="mt-4 text-11 text-fg-muted">
            On target = calories between {Math.round(CAL_HIT_MIN * 100)}% and {Math.round(CAL_HIT_MAX * 100)}% of your goal and protein at{' '}
            {Math.round(PROTEIN_HIT_MIN * 100)}%+. Averages count days you logged.
          </p>
        </>
      )}
    </section>
  )
}
