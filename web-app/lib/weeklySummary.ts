// web-app/lib/weeklySummary.ts
// The Progress tab's "Last 7 days" card: averages, best day and how many days
// were on target. Uses the 7 completed days before today (today is still in
// progress, so counting it would drag the averages down).

import { shiftDate } from '@/lib/streak'

// A day is "on target" when calories land within 10% of the goal and protein
// reaches at least 90% of its goal. Tweak here.
export const CAL_HIT_MIN = 0.9
export const CAL_HIT_MAX = 1.1
export const PROTEIN_HIT_MIN = 0.9

export interface SummaryLog {
  log_date: string
  servings: number
  food_items: { calories: number; protein: number } | null
}

export interface DayStat {
  date: string
  label: string // Mon, Tue...
  calories: number
  protein: number
  logged: boolean
  hit: boolean
  // Lower is closer to the goals; used to pick the best day
  score: number
}

export interface WeeklySummary {
  days: DayStat[] // oldest first
  loggedDays: number
  avgCalories: number
  avgProtein: number
  hitDays: number
  bestDay: DayStat | null
}

export function computeWeeklySummary(
  logs: SummaryLog[],
  goals: { calories: number; protein: number },
  todayStr: string
): WeeklySummary {
  const dates: string[] = []
  for (let i = 7; i >= 1; i--) dates.push(shiftDate(todayStr, -i))

  const totals = new Map<string, { calories: number; protein: number; count: number }>()
  for (const log of logs) {
    if (!dates.includes(log.log_date)) continue
    const t = totals.get(log.log_date) ?? { calories: 0, protein: 0, count: 0 }
    const s = Number(log.servings) || 1
    t.calories += (Number(log.food_items?.calories) || 0) * s
    t.protein += (Number(log.food_items?.protein) || 0) * s
    t.count += 1
    totals.set(log.log_date, t)
  }

  const days: DayStat[] = dates.map((date) => {
    const t = totals.get(date)
    const calories = t?.calories ?? 0
    const protein = t?.protein ?? 0
    const logged = !!t && t.count > 0 && calories > 0
    const calRatio = goals.calories > 0 ? calories / goals.calories : 0
    const proRatio = goals.protein > 0 ? protein / goals.protein : 0
    const hit =
      logged &&
      goals.calories > 0 &&
      calRatio >= CAL_HIT_MIN &&
      calRatio <= CAL_HIT_MAX &&
      (goals.protein <= 0 || proRatio >= PROTEIN_HIT_MIN)
    const score = logged ? Math.abs(1 - calRatio) + Math.max(0, 1 - proRatio) : Infinity
    return {
      date,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      calories,
      protein,
      logged,
      hit,
      score,
    }
  })

  const loggedDays = days.filter((d) => d.logged)
  const avg = (pick: (d: DayStat) => number) =>
    loggedDays.length > 0 ? loggedDays.reduce((sum, d) => sum + pick(d), 0) / loggedDays.length : 0
  const bestDay = loggedDays.reduce<DayStat | null>((best, d) => (!best || d.score < best.score ? d : best), null)

  return {
    days,
    loggedDays: loggedDays.length,
    avgCalories: avg((d) => d.calories),
    avgProtein: avg((d) => d.protein),
    hitDays: days.filter((d) => d.hit).length,
    bestDay,
  }
}
