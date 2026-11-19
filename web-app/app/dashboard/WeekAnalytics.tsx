'use client'

import { useMemo, useState } from 'react'
import { Haptics } from '@capacitor/haptics'
import {
  CAL_HIT_MAX,
  CAL_HIT_MIN,
  PROTEIN_HIT_MIN,
  computeWeeklySummary,
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

  // Headroom above the taller of the goal and the biggest day, so the goal
  // label and a big day both fit
  const scaleMax = Math.max(goalCalories, ...summary.days.map((d) => d.calories)) * 1.15 || 1
  const goalPct = (goalCalories / scaleMax) * 100

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
              <span className="font-numeral text-xl font-semibold text-fg">{selected.logged ? fmt(selected.calories) : '–'}</span>
              <span className="text-xs font-medium text-fg-muted"> cal</span>
              {selected.logged && (
                <span className="text-xs font-medium text-fg-muted tabular-nums"> · {fmt(selected.protein)}g protein</span>
              )}
            </p>
            <span className="shrink-0 text-10 font-semibold text-fg-muted tabular-nums">
              <span aria-hidden="true" className="inline-block w-3 align-middle border-t border-dashed border-fg-muted/60 mr-1" />
              {fmt(goalCalories)}/day
            </span>
          </div>

          {/* Bars: calories per day against the dashed goal line */}
          {/* Plot area is 7rem; the 1.5rem row of day letters sits under it */}
          <div className="relative mt-3">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-fg-muted/60"
              style={{ bottom: `calc(1.5rem + ${(goalPct * 0.07).toFixed(3)}rem)` }}
            />
            <div role="radiogroup" aria-label="Daily calories, last 7 days" className="relative flex">
              {summary.days.map((d) => {
                const isSel = d.date === selected.date
                const pct = d.logged ? Math.max(4, (d.calories / scaleMax) * 100) : 0
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    aria-label={`${d.label}: ${d.logged ? `${fmt(d.calories)} calories, ${fmt(d.protein)}g protein${d.hit ? ', on target' : ''}` : 'nothing logged'}`}
                    onClick={() => {
                      if (isSel) return
                      setPicked(d.date)
                      Haptics.selectionChanged().catch(() => {})
                    }}
                    className="flex-1 min-w-0 flex flex-col items-center press"
                  >
                    <span className="h-28 w-full flex items-end justify-center">
                      <span
                        className={`w-4 rounded-full transition-[height] duration-500 ease-out motion-reduce:transition-none ${
                          isSel ? 'bg-gold' : d.logged ? 'bg-fg-muted/40' : 'bg-line'
                        }`}
                        style={{ height: d.logged ? `${pct}%` : '0.25rem' }}
                      />
                    </span>
                    <span className={`h-6 flex items-end text-10 font-bold ${isSel ? 'text-fg' : 'text-fg-muted'}`}>
                      {d.label.slice(0, 1)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

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
