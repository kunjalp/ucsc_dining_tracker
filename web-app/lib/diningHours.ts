// lib/diningHours.ts
//
// Computes "is this hall open right now?" instantly, client-side, from
// published UCSC hours — no scraping/network delay involved.
//
// Two layers of data per hall:
//   1. specialDates: exact overrides for specific calendar dates (used for
//      the Aug 30 – Sept 16, 2026 transition period, which has irregular
//      multi-window days like "8-10am, 11:30-2pm, 4:30-7pm").
//   2. regularHours: the steady-state weekly schedule that applies once a
//      date isn't found in specialDates (index 0 = Sunday ... 6 = Saturday).
//
// Covers both the 5 main dining halls and the 9 cafes/coffee bars/markets
// (the latter ported from scraper.py's HARDCODED_HOURS). A hall with no
// entry in SCHEDULES falls back to null, signaling the caller to use the
// scraped hall_status table instead (only relevant now for locations we
// truly have no published hours for).

type TimeWindow = [string, string] // ["HH:MM", "HH:MM"], 24-hour, Pacific time

interface HallScheduleData {
  specialDates: Record<string, TimeWindow[]> // "YYYY-MM-DD" -> windows ([] = closed that day)
  regularHours: (TimeWindow | null)[] // 7 entries, Sun..Sat, null = closed that weekday
}

const JRL_SPECIAL_STANDARD: TimeWindow[] = [
  ['08:00', '10:00'],
  ['11:30', '14:00'],
  ['16:30', '19:00'],
]
const JRL_SPECIAL_WEEKEND: TimeWindow[] = [
  ['09:00', '14:00'],
  ['16:30', '19:00'],
]
const SEPT_10_16_LONGDAY: TimeWindow[] = [['08:00', '20:00']]

const SCHEDULES: Record<string, HallScheduleData> = {
  'John R. Lewis & College Nine Dining Hall': {
    specialDates: {
      '2026-09-01': JRL_SPECIAL_STANDARD,
      '2026-09-02': JRL_SPECIAL_STANDARD,
      '2026-09-03': JRL_SPECIAL_STANDARD,
      '2026-09-04': JRL_SPECIAL_STANDARD,
      '2026-09-05': JRL_SPECIAL_WEEKEND,
      '2026-09-06': JRL_SPECIAL_WEEKEND,
      '2026-09-07': JRL_SPECIAL_STANDARD,
      '2026-09-08': JRL_SPECIAL_STANDARD,
      '2026-09-09': JRL_SPECIAL_STANDARD,
      '2026-09-10': SEPT_10_16_LONGDAY,
      '2026-09-11': SEPT_10_16_LONGDAY,
      '2026-09-12': SEPT_10_16_LONGDAY,
      '2026-09-13': SEPT_10_16_LONGDAY,
      '2026-09-14': SEPT_10_16_LONGDAY,
      '2026-09-15': SEPT_10_16_LONGDAY,
      '2026-09-16': SEPT_10_16_LONGDAY,
    },
    // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    regularHours: [
      ['07:00', '20:00'],
      ['07:00', '20:00'],
      ['07:00', '23:00'],
      ['07:00', '23:00'],
      ['07:00', '23:00'],
      ['07:00', '23:00'],
      ['07:00', '23:00'],
    ],
  },

  'Cowell & Stevenson Dining Hall': {
    specialDates: {
      '2026-09-01': [],
      '2026-09-02': [],
      '2026-09-03': [],
      '2026-09-04': [],
      '2026-09-05': [],
      '2026-09-06': [],
      '2026-09-07': [],
      '2026-09-08': [],
      '2026-09-09': [],
      '2026-09-10': SEPT_10_16_LONGDAY,
      '2026-09-11': SEPT_10_16_LONGDAY,
      '2026-09-12': SEPT_10_16_LONGDAY,
      '2026-09-13': SEPT_10_16_LONGDAY,
      '2026-09-14': SEPT_10_16_LONGDAY,
      '2026-09-15': SEPT_10_16_LONGDAY,
      '2026-09-16': SEPT_10_16_LONGDAY,
    },
    regularHours: [
      ['07:00', '23:00'], // Sun
      ['07:00', '23:00'], // Mon
      ['07:00', '23:00'], // Tue
      ['07:00', '23:00'], // Wed
      ['07:00', '23:00'], // Thu
      ['07:00', '20:00'], // Fri
      ['07:00', '20:00'], // Sat
    ],
  },

  'Crown & Merrill Dining Hall': {
    specialDates: {
      '2026-09-01': [], '2026-09-02': [], '2026-09-03': [], '2026-09-04': [],
      '2026-09-05': [], '2026-09-06': [], '2026-09-07': [], '2026-09-08': [],
      '2026-09-09': [], '2026-09-10': [], '2026-09-11': [], '2026-09-12': [],
      '2026-09-13': [], '2026-09-14': [], '2026-09-15': [], '2026-09-16': [],
    },
    regularHours: [
      null, // Sun - closed
      ['07:00', '20:00'], // Mon
      ['07:00', '20:00'], // Tue
      ['07:00', '20:00'], // Wed
      ['07:00', '20:00'], // Thu
      ['07:00', '20:00'], // Fri
      null, // Sat - closed
    ],
  },

  'Porter & Kresge Dining Hall': {
    specialDates: {
      '2026-09-01': [], '2026-09-02': [], '2026-09-03': [], '2026-09-04': [],
      '2026-09-05': [], '2026-09-06': [], '2026-09-07': [], '2026-09-08': [],
      '2026-09-09': [], '2026-09-10': [], '2026-09-11': [], '2026-09-12': [],
      '2026-09-13': [], '2026-09-14': [], '2026-09-15': [], '2026-09-16': [],
    },
    regularHours: [
      null, // Sun - closed
      ['07:00', '19:00'], // Mon
      ['07:00', '19:00'], // Tue
      ['07:00', '19:00'], // Wed
      ['07:00', '19:00'], // Thu
      ['07:00', '19:00'], // Fri
      null, // Sat - closed
    ],
  },

  'Rachel Carson & Oakes Dining Hall': {
    specialDates: {
      '2026-09-01': [], '2026-09-02': [], '2026-09-03': [], '2026-09-04': [],
      '2026-09-05': [], '2026-09-06': [], '2026-09-07': [], '2026-09-08': [],
      '2026-09-09': [],
      '2026-09-10': SEPT_10_16_LONGDAY,
      '2026-09-11': SEPT_10_16_LONGDAY,
      '2026-09-12': SEPT_10_16_LONGDAY,
      '2026-09-13': SEPT_10_16_LONGDAY,
      '2026-09-14': SEPT_10_16_LONGDAY,
      '2026-09-15': SEPT_10_16_LONGDAY,
      '2026-09-16': SEPT_10_16_LONGDAY,
    },
    regularHours: [
      ['07:00', '23:00'], // Sun
      ['07:00', '23:00'], // Mon
      ['07:00', '23:00'], // Tue
      ['07:00', '23:00'], // Wed
      ['07:00', '23:00'], // Thu
      ['07:00', '20:00'], // Fri
      ['07:00', '20:00'], // Sat
    ],
  },

  // Cafes, coffee bars, and markets — no special-date overrides; these run
  // steady weekly hours (ported from scraper.py's HARDCODED_HOURS).
  'Stevenson Coffee House': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['08:00', '20:00'], // Mon
      ['08:00', '20:00'], // Tue
      ['08:00', '20:00'], // Wed
      ['08:00', '20:00'], // Thu
      ['08:00', '20:00'], // Fri
      null, // Sat
    ],
  },

  'Perk Coffee Bar': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['08:00', '18:00'], // Mon
      ['08:00', '18:00'], // Tue
      ['08:00', '18:00'], // Wed
      ['08:00', '18:00'], // Thu
      ['08:00', '17:00'], // Fri
      null, // Sat
    ],
  },

  "Banana Joe's": {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['20:00', '23:00'], // Mon
      ['20:00', '23:00'], // Tue
      ['20:00', '23:00'], // Wed
      ['20:00', '23:00'], // Thu
      ['20:00', '23:00'], // Fri
      null, // Sat
    ],
  },

  'Oakes Cafe': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['10:00', '21:00'], // Mon
      ['10:00', '21:00'], // Tue
      ['10:00', '21:00'], // Wed
      ['10:00', '21:00'], // Thu
      ['10:00', '21:00'], // Fri
      null, // Sat
    ],
  },

  'Global Village Cafe': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['08:00', '18:00'], // Mon
      ['08:00', '18:00'], // Tue
      ['08:00', '18:00'], // Wed
      ['08:00', '18:00'], // Thu
      ['08:00', '18:00'], // Fri
      null, // Sat
    ],
  },

  "Owl's Nest Cafe": {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['08:00', '18:00'], // Mon
      ['08:00', '18:00'], // Tue
      ['08:00', '18:00'], // Wed
      ['08:00', '18:00'], // Thu
      ['08:00', '18:00'], // Fri
      null, // Sat
    ],
  },

  'UCen Coffee Bar': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['08:00', '16:00'], // Mon
      ['08:00', '16:00'], // Tue
      ['08:00', '16:00'], // Wed
      ['08:00', '16:00'], // Thu
      ['08:00', '14:00'], // Fri
      null, // Sat
    ],
  },

  'Porter Market': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['08:00', '20:00'], // Mon
      ['08:00', '20:00'], // Tue
      ['08:00', '20:00'], // Wed
      ['08:00', '20:00'], // Thu
      ['08:00', '20:00'], // Fri
      null, // Sat
    ],
  },

  'Merrill Market': {
    specialDates: {},
    regularHours: [
      null, // Sun
      ['09:00', '20:00'], // Mon
      ['09:00', '20:00'], // Tue
      ['09:00', '20:00'], // Wed
      ['09:00', '20:00'], // Thu
      ['09:00', '20:00'], // Fri
      null, // Sat
    ],
  },
}

// ---------------------------------------------------------------------------
// Meal period countdown (Breakfast/Lunch/Dinner/Brunch/Late Night -> Closing)
//
// The hours above only track whole-hall open/close windows, not the
// boundaries between meal periods within a day. This is separate, more
// granular published-hours data (dining hall services only — cafes/markets
// run a single continuous window with no meal-period breakdown) used to
// power a "X left until Lunch" style countdown. "Continuous Dining" windows
// between named periods are intentionally omitted here: they don't get their
// own countdown target, so the gap between e.g. Breakfast ending and Lunch
// starting just counts down to Lunch.
// ---------------------------------------------------------------------------

interface MealPeriod {
  label: string
  start: string // "HH:MM", 24-hour, Pacific time
  end: string
}

// index 0 = Sunday ... 6 = Saturday, null = no dining-hall service that day
const MEAL_PERIOD_SCHEDULES: Record<string, (MealPeriod[] | null)[]> = {
  'John R. Lewis & College Nine Dining Hall': [
    [ // Sun
      { label: 'Brunch', start: '09:00', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Mon
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Tue
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Wed
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Thu
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Fri
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Sat
      { label: 'Brunch', start: '09:00', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
  ],

  'Cowell & Stevenson Dining Hall': [
    [ // Sun
      { label: 'Brunch', start: '09:00', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Mon
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Tue
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Wed
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Thu
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Fri
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Sat
      { label: 'Brunch', start: '09:00', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
  ],

  'Crown & Merrill Dining Hall': [
    null, // Sun - closed
    [ // Mon
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Tue
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Wed
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Thu
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Fri
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    null, // Sat - closed
  ],

  'Porter & Kresge Dining Hall': [
    null, // Sun - closed
    [ // Mon
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '19:00' },
    ],
    [ // Tue
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '19:00' },
    ],
    [ // Wed
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '19:00' },
    ],
    [ // Thu
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '19:00' },
    ],
    [ // Fri
      { label: 'Breakfast', start: '07:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '19:00' },
    ],
    null, // Sat - closed
  ],

  'Rachel Carson & Oakes Dining Hall': [
    [ // Sun
      { label: 'Brunch', start: '09:00', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Mon
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Tue
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Wed
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Thu
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
      { label: 'Late Night', start: '20:00', end: '22:00' },
    ],
    [ // Fri
      { label: 'Breakfast', start: '08:00', end: '11:00' },
      { label: 'Lunch', start: '11:30', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
    [ // Sat
      { label: 'Brunch', start: '09:00', end: '14:00' },
      { label: 'Dinner', start: '17:00', end: '20:00' },
    ],
  ],
}

export type MealCountdown =
  | { mode: 'until'; label: string; minutesUntil: number } // e.g. "37m until Lunch"
  | { mode: 'opens'; label: string; time: string } // before today's first period — "Opens at 8:00 AM"
  | { mode: 'closes'; label: string; time: string; minutesLeft: number } // during the day's last named period — "Closing at 8:00 PM"

/**
 * Returns the current meal-period status for a dining hall:
 *  - 'opens'  — before today's first period has started (e.g. checking at
 *    2 AM before an 8 AM Breakfast). Today's calendar date already governs
 *    the schedule lookup, so this naturally resolves correctly even late at
 *    night/early morning — no separate "day rollover" logic needed.
 *  - 'until'  — service is running and hasn't reached the day's last named
 *    period yet — counts down to the next period (Breakfast -> Lunch,
 *    Lunch -> Dinner, or Dinner -> Late Night on days that have one).
 *    "Continuous Dining" gaps between named periods aren't their own
 *    milestone — the countdown just keeps counting to the next named one.
 *  - 'closes' — currently in the day's LAST named period (whichever one
 *    that is: Dinner on a no-late-night day, Late Night when present) —
 *    shows the clock time service ends instead of a duration.
 * Returns null if we don't have a meal-period breakdown for this hall
 * (cafes/markets, or a hall with no schedule data) or once today's service
 * is entirely over (past the last period's end, before midnight).
 */
export function getMealCountdown(hallName: string, now: Date = new Date()): MealCountdown | null {
  const schedule = MEAL_PERIOD_SCHEDULES[hallName]
  if (!schedule) return null

  const { dayOfWeek, minutesSinceMidnight } = getPacificParts(now)
  const periods = schedule[dayOfWeek]
  if (!periods || periods.length === 0) return null

  const first = periods[0]
  if (minutesSinceMidnight < timeToMinutes(first.start)) {
    return { mode: 'opens', label: first.label, time: formatTime(first.start) }
  }

  const last = periods[periods.length - 1]
  const lastStart = timeToMinutes(last.start)
  const lastEnd = timeToMinutes(last.end)

  if (minutesSinceMidnight >= lastStart) {
    if (minutesSinceMidnight < lastEnd) {
      return { mode: 'closes', label: last.label, time: formatTime(last.end), minutesLeft: lastEnd - minutesSinceMidnight }
    }
    return null // today's service is fully over
  }

  // Before the last period starts — count down to the next named milestone
  const next = periods.find((p) => timeToMinutes(p.start) > minutesSinceMidnight)
  if (!next) return null // shouldn't happen given the checks above
  return { mode: 'until', label: next.label, minutesUntil: timeToMinutes(next.start) - minutesSinceMidnight }
}

/** Formats a minute count as "2h 15m" or "45m". */
export function formatCountdown(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

/**
 * A segment of today's "day track" — the dining hall's scheduled periods
 * laid out proportionally to their real duration (not evenly divided),
 * so e.g. a 2-hour Breakfast block is visually shorter than a 3-hour
 * Dinner block. fillFraction tracks how much of that specific segment
 * has already elapsed (0 = hasn't started, 1 = fully in the past), which
 * drives a left-to-right fill rather than one blunt overall percentage.
 */
export interface DayTrackSegment {
  label: string
  startPct: number // 0-100, position within the full track
  widthPct: number // 0-100, width within the full track
  fillFraction: number // 0-1, how much of this segment is in the past
}

export interface DayTrack {
  segments: DayTrackSegment[]
  markerPct: number // 0-100, clamped to the track's start/end
  activeIndex: number // index of the segment "now" falls inside, or -1
}

/**
 * Builds today's day track for a dining hall: the full span from the
 * first period's start to the last period's end, broken into real,
 * proportionally-sized segments with a "now" marker position. Returns
 * null for halls without meal-period data, or on a day with none
 * scheduled (track has nothing meaningful to show either way).
 */
export function getDayTrack(hallName: string, now: Date = new Date()): DayTrack | null {
  const schedule = MEAL_PERIOD_SCHEDULES[hallName]
  if (!schedule) return null

  const { dayOfWeek, minutesSinceMidnight } = getPacificParts(now)
  const periods = schedule[dayOfWeek]
  if (!periods || periods.length === 0) return null

  const dayStart = timeToMinutes(periods[0].start)
  const dayEnd = timeToMinutes(periods[periods.length - 1].end)
  const span = dayEnd - dayStart
  if (span <= 0) return null

  const segments: DayTrackSegment[] = periods.map((p) => {
    const s = timeToMinutes(p.start)
    const e = timeToMinutes(p.end)
    const fillFraction = e <= s ? 0 : Math.min(Math.max((minutesSinceMidnight - s) / (e - s), 0), 1)
    return {
      label: p.label,
      startPct: ((s - dayStart) / span) * 100,
      widthPct: ((e - s) / span) * 100,
      fillFraction,
    }
  })

  const clampedNow = Math.min(Math.max(minutesSinceMidnight, dayStart), dayEnd)
  const markerPct = ((clampedNow - dayStart) / span) * 100

  const activeIndex = periods.findIndex((p) => {
    const s = timeToMinutes(p.start)
    const e = timeToMinutes(p.end)
    return minutesSinceMidnight >= s && minutesSinceMidnight < e
  })

  return { segments, markerPct, activeIndex }
}

function getPacificParts(now: Date) {
  // en-CA gives YYYY-MM-DD directly, which is exactly what we need as a key
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const dayOfWeek = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  ).getDay()
  const [hh, mm] = now
    .toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour12: false })
    .split(':')
  const minutesSinceMidnight = parseInt(hh, 10) * 60 + parseInt(mm, 10)
  return { dateStr, dayOfWeek, minutesSinceMidnight }
}

function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(':').map(Number)
  const period = hh >= 12 ? 'PM' : 'AM'
  const hour12 = hh % 12 === 0 ? 12 : hh % 12
  return mm === 0 ? `${hour12} ${period}` : `${hour12}:${String(mm).padStart(2, '0')} ${period}`
}

export interface HallOpenStatus {
  is_open: boolean
  status_text: string
}

/**
 * Returns instant open/closed status for a hall based on published hours,
 * or null if we don't have schedule data for this hall (caller should fall
 * back to the scraped hall_status table in that case).
 */
export function getHallOpenStatus(hallName: string, now: Date = new Date()): HallOpenStatus | null {
  const schedule = SCHEDULES[hallName]
  if (!schedule) return null

  const { dateStr, dayOfWeek, minutesSinceMidnight } = getPacificParts(now)

  const windows: TimeWindow[] =
    dateStr in schedule.specialDates
      ? schedule.specialDates[dateStr]
      : (() => {
          const reg = schedule.regularHours[dayOfWeek]
          return reg ? [reg] : []
        })()

  for (const [start, end] of windows) {
    const startMin = timeToMinutes(start)
    const endMin = timeToMinutes(end)
    if (minutesSinceMidnight >= startMin && minutesSinceMidnight < endMin) {
      return { is_open: true, status_text: `Open until ${formatTime(end)}` }
    }
  }

  // Closed — find the next window today (if any) to show a helpful message
  const nextWindow = windows.find(([start]) => timeToMinutes(start) > minutesSinceMidnight)
  return {
    is_open: false,
    status_text: nextWindow ? `Closed — opens at ${formatTime(nextWindow[0])}` : 'Closed',
  }
}

/**
 * Returns whether a hall has any published hours at all on a specific future
 * calendar date (not "is it open right now" — there is no "now" for a future
 * date). Used to gate the menu/banner for Tomorrow and other upcoming days,
 * since a hall can have menu rows scraped into daily_menus for a date it's
 * actually closed on. Returns null if we don't have schedule data for this
 * hall (caller should fall back to the scraped hall_status table).
 */
export function getHallStatusForDate(hallName: string, dateStr: string): HallOpenStatus | null {
  const schedule = SCHEDULES[hallName]
  if (!schedule) return null

  const windows: TimeWindow[] =
    dateStr in schedule.specialDates
      ? schedule.specialDates[dateStr]
      : (() => {
          // Calendar dates have a fixed weekday regardless of timezone, so
          // parse as UTC to avoid the local-server-timezone edge cases that
          // `new Date(dateStr)` alone can hit.
          const [y, m, d] = dateStr.split('-').map(Number)
          const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
          const reg = schedule.regularHours[dayOfWeek]
          return reg ? [reg] : []
        })()

  if (windows.length === 0) {
    return { is_open: false, status_text: 'Closed' }
  }

  const [start, end] = windows[0]
  return { is_open: true, status_text: `Open ${formatTime(start)}–${formatTime(end)}` }
}