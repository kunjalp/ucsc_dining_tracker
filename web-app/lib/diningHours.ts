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
// A hall with no entry in SCHEDULES falls back to null, signaling the
// caller to use the scraped hall_status table instead (e.g. coffee shops
// where we don't have published hours).

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