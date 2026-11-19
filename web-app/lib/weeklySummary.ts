// web-app/lib/weeklySummary.ts
// The Progress tab's "Last 7 days" card: averages, best day and how many days
// were on target. Uses the 7 completed days before today (today is still in
// progress, so counting it would drag the averages down). Also the Analytics
// sheet's per-day macro split (macroSplit).

import { shiftDate } from '@/lib/streak'

// A day is "on target" when calories land within 10% of the goal and protein
// reaches at least 90% of its goal. Tweak here.
export const CAL_HIT_MIN = 0.9
export const CAL_HIT_MAX = 1.1
export const PROTEIN_HIT_MIN = 0.9

export interface SummaryLog {
  log_date: string
  servings: number
  food_items: { calories: number; protein: number; carbs?: number | null; fat?: number | null } | null
}

export interface DayStat {
  date: string
  label: string // Mon, Tue...
  calories: number
  protein: number
  carbs: number // grams
  fat: number // grams
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

  const totals = new Map<string, { calories: number; protein: number; carbs: number; fat: number; count: number }>()
  for (const log of logs) {
    if (!dates.includes(log.log_date)) continue
    const t = totals.get(log.log_date) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
    const s = Number(log.servings) || 1
    t.calories += (Number(log.food_items?.calories) || 0) * s
    t.protein += (Number(log.food_items?.protein) || 0) * s
    t.carbs += (Number(log.food_items?.carbs) || 0) * s
    t.fat += (Number(log.food_items?.fat) || 0) * s
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
      carbs: t?.carbs ?? 0,
      fat: t?.fat ?? 0,
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

// Rounds shares to whole numbers that add up to exactly `total` (largest
// remainder): floor each, then hand the leftover units to the biggest
// fractional parts. All-zero input gives all zeros.
export function largestRemainder(values: number[], total = 100): number[] {
  const sum = values.reduce((a, b) => a + Math.max(0, b), 0)
  if (sum <= 0) return values.map(() => 0)
  const exact = values.map((v) => (Math.max(0, v) / sum) * total)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    out[i] += 1
    left -= 1
  }
  return out
}

// kcal per gram, for the macro split
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const

export interface MacroPart {
  key: 'protein' | 'carbs' | 'fat'
  grams: number
  share: number // exact 0-1 share of the macro calories (segment height)
  pct: number // whole percent; the three add up to 100 (0 when no macros)
}

// A day's calories split by macro, bottom to top: protein, carbs, fat. Shares
// are of the calories the three macros account for (4/4/9 kcal per g), so
// the segments always fill the bar.
export function macroSplit(day: { protein: number; carbs: number; fat: number }): MacroPart[] {
  const keys = ['protein', 'carbs', 'fat'] as const
  const kcal = keys.map((k) => Math.max(0, day[k]) * KCAL_PER_G[k])
  const sum = kcal.reduce((a, b) => a + b, 0)
  const pcts = largestRemainder(kcal)
  return keys.map((key, i) => ({
    key,
    grams: day[key],
    share: sum > 0 ? kcal[i] / sum : 0,
    pct: pcts[i],
  }))
}
