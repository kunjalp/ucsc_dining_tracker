// Logging streak for Sammy's flame badge: how many days in a row the
// student has logged food. Dates are meal_logs.log_date strings
// ('YYYY-MM-DD', the America/Los_Angeles day -- see handleLogFood).

// How far back the one light query looks; a longer streak just counts as this
export const STREAK_LOOKBACK_DAYS = 60
// Badge sizes / one-time celebrations
export const STREAK_MILESTONES = [3, 7] as const
// Last milestone celebrated, as `${runStart}:${milestone}`, so each run of
// days celebrates each milestone once
export const STREAK_CELEBRATED_STORAGE_KEY = 'ucsc_streak_celebrated'

// Today's log_date (Pacific), matching how logs are written
export function logDateFor(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

// 'YYYY-MM-DD' plus n days (noon UTC, so DST never shifts the date)
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Days in a row ending today -- or ending yesterday if nothing's logged yet
// today, so the streak is still showing in the morning. `start` is the
// run's first day.
export function computeStreak(dates: ReadonlySet<string>, today: string): { count: number; start: string } {
  let day = dates.has(today) ? today : shiftDate(today, -1)
  let count = 0
  while (dates.has(day)) {
    count++
    day = shiftDate(day, -1)
  }
  return { count, start: shiftDate(day, 1) }
}

// Highest milestone reached, or null under 3 days
export function streakMilestone(count: number): number | null {
  return [...STREAK_MILESTONES].reverse().find((m) => count >= m) ?? null
}
