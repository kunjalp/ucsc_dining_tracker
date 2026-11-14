'use client'

import { useMemo } from 'react'
import {
  CAL_HIT_MAX,
  CAL_HIT_MIN,
  PROTEIN_HIT_MIN,
  computeWeeklySummary,
  type SummaryLog,
} from '@/lib/weeklySummary'

interface WeeklySummaryCardProps {
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

export default function WeeklySummaryCard({ logs, goalCalories, goalProtein, targetsSaved, todayStr, loaded }: WeeklySummaryCardProps) {
  const summary = useMemo(
    () => computeWeeklySummary(logs, { calories: goalCalories, protein: goalProtein }, todayStr),
    [logs, goalCalories, goalProtein, todayStr]
  )
  const headline = weekHeadline(summary.hitDays, summary.loggedDays)
  const best = summary.bestDay

  return (
    <section aria-label="Last 7 days" className="border-t border-line pt-4">
      <h2 className="text-lg font-bold tracking-tight">Last 7 days</h2>
      <p className="text-sm font-medium text-fg-muted text-balance mt-0.5" aria-live="polite">
        {!loaded ? 'Loading your week…' : !targetsSaved ? 'Set your targets to see how your week went.' : headline}
      </p>

      {loaded && targetsSaved && summary.loggedDays > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 mt-4">
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Avg calories</dt>
              <dd className="text-lg font-bold tabular-nums text-macro-cal">{fmt(summary.avgCalories)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Avg protein</dt>
              <dd className="text-lg font-bold tabular-nums text-macro-protein">{fmt(summary.avgProtein)}g</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Days on target</dt>
              <dd className="text-lg font-bold tabular-nums text-gold">{summary.hitDays} of 7</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-fg-muted">Best day</dt>
              <dd className="text-lg font-bold text-fg">{best ? best.label : '–'}</dd>
              {best && (
                <p className="text-11 text-fg-muted tabular-nums">
                  {fmt(best.calories)} cal · {fmt(best.protein)}g protein
                </p>
              )}
            </div>
          </dl>

          {/* One bar per day: height is calories against the goal; gold = on target */}
          <div className="mt-4 flex items-end gap-2 h-20" role="img" aria-label={`Daily calories against your goal, last 7 days. ${summary.hitDays} days on target.`}>
            {summary.days.map((d) => {
              const pct = goalCalories > 0 ? Math.min(130, (d.calories / goalCalories) * 100) : 0
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-md ${d.hit ? 'bg-gold' : d.logged ? 'bg-white/25' : 'border border-dashed border-white/20'}`}
                      style={{ height: d.logged ? `${Math.max(6, (pct / 130) * 100)}%` : '6%' }}
                    />
                  </div>
                  <span className="text-9 font-bold text-fg-muted">{d.label.slice(0, 1)}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-11 text-fg-muted">
            On target = calories between {Math.round(CAL_HIT_MIN * 100)}% and {Math.round(CAL_HIT_MAX * 100)}% of your goal and protein at{' '}
            {Math.round(PROTEIN_HIT_MIN * 100)}%+. Averages count days you logged.
          </p>
        </>
      )}
    </section>
  )
}
