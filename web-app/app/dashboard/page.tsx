'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import SetTargetsModal, { DailyTargets } from './SetTargetsModal'
import UserProfileModal, { UserProfile } from './UserProfileModal'
import { getHallOpenStatus, getHallStatusForDate, getMealCountdown, formatCountdown, getDayTrack, type DayTrack } from '@/lib/diningHours'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { classifyByName } from '@/lib/stationClassifier'
import { getCoffeeShopMenu, getCoffeeShopMealTypes, isHardcodedCoffeeShop } from '@/lib/coffeeMenuItems'

import {
  History,
  Search,
  UtensilsCrossed,
  LineChart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Trash2,
  Check,
  X,
} from 'lucide-react'

interface FoodItem {
  recipe_id: string
  name: string
  portion: string
  calories: number
  protein: number
  carbs: number
  sugar: number
  fat: number
}

interface MenuEntry {
  food_item_id: string
  dining_hall: string
  meal_type: string
  station: string
  food_items: FoodItem
}

interface MealLog {
  id: string
  servings: number
  dining_hall: string
  meal_type: string
  log_date: string // YYYY-MM-DD
  food_items: {
    name: string
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

interface HallStatus {
  is_open: boolean
  status_text: string | null
}

// Returns the Pacific-time calendar date, offset by N days from today, as
// "YYYY-MM-DD" — matches the format daily_menus.date is stored/queried in.
const getDateStrForOffset = (offsetDays: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

// Human label for a day offset, e.g. 0 -> "Today", 1 -> "Tomorrow",
// 2+ -> the weekday name ("Wednesday").
const getDayOffsetLabel = (offsetDays: number): string => {
  if (offsetDays === 0) return 'Today'
  if (offsetDays === 1) return 'Tomorrow'
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' })
}

// How many days ahead the app lets students browse. scrape_upcoming.py
// actually scrapes one extra day beyond this (DAYS_AHEAD = 3) on purpose —
// that buffer day means the furthest day shown here already has data
// cached from the PREVIOUS day's scrape, so it's never empty overnight
// while waiting for today's run.
const DAY_OFFSETS = [0, 1, 2]

// Whichever meal period a dining hall is actually serving (or, during a
// Continuous Dining gap, most recently served) right now — e.g. "Lunch" at
// 1pm — so the app can open straight to that instead of always defaulting
// to Breakfast. Returns null for cafes/markets (no meal-period schedule) or
// before the hall's first period starts today.
function getCurrentMealPeriodLabel(hallName: string): string | null {
  const track = getDayTrack(hallName, new Date())
  if (!track || track.activeIndex === -1) return null
  return track.segments[track.activeIndex]?.label ?? null
}

const DINING_HALLS = [
  "John R. Lewis & College Nine Dining Hall",
  "Cowell & Stevenson Dining Hall",
  "Crown & Merrill Dining Hall",
  "Porter & Kresge Dining Hall",
  "Rachel Carson & Oakes Dining Hall",
  "Stevenson Coffee House",
  "Perk Coffee Bar",
  "Banana Joe's",
  "Oakes Cafe",
  "Global Village Cafe",
  "Owl's Nest Cafe",
  "UCen Coffee Bar",
  "Porter Market",
  "Merrill Market",
]

const DINING_HALL_NAMES = DINING_HALLS.slice(0, 5) // the 5 real dining halls

const STATION_DISPLAY_ORDER = [
  'Breakfast',
  'Clean Plate',
  'Soups',
  'Grill',
  'Entrees',
  'Hot Bars',
  'Pizza',
  'Sweet Treats',
  'Campus Bakery',
  'Salad Bar',
  'Deli Bar',
  'Cereal',
  'Barista Station',
  'Beverages',
  'Bread & Bagels',
  'Fruit',
  'Dairy & Yogurt',
  'Nuts & Seeds',
  'Condiments',
]

const CONDIMENT_SUB_ORDER = [
  'Dressings, Oils & Vinegars',
  'Hot Sauces & Seasonings',
  'Sauces & Syrups',
  'Spreads & Butters',
]

const getStationSortIndex = (station: string): number => {
  const idx = STATION_DISPLAY_ORDER.indexOf(station)
  return idx === -1 ? STATION_DISPLAY_ORDER.length : idx
}

interface ParentGroup {
  parent: string
  subgroups: { sub: string | null; entries: MenuEntry[] }[]
}

const getEffectiveStation = (entry: MenuEntry): string => {
  const rawStation = entry.station?.trim()
  if (rawStation) return rawStation // trust scraped value when present — Entrees, Grill, etc. already work
  const byName = classifyByName(entry.food_items?.name || '')
  return byName || 'General'
}

// Tiny version of the Sammy's Palate logo (a banana slug curled into a
// shell) used as the day track's moving marker — same gold/navy/light-blue
// palette as the real logo and the rest of the app, not a generic dot.
// x/y let it be placed as a nested <svg> inside the day track's own SVG,
// centered on a point along the curved path.
// The day track's moving marker, redrawn as a side-on "slide profile" of
// Sammy's body — an elongated, tapered shape with tiny antennae — instead
// of the circular shell badge, so it reads as something sliding along a
// surface rather than a token riding a progress bar. Gold body with a
// light-blue accent streak, echoing the highlight patches on the real
// logo's gold band. Positioned/rotated entirely by the parent <g>'s
// transform, so this just draws the shape centered on its own origin.
// Just the head now (eye + antennae) — the body was dropped so the track
// reads as a cleaner, more abstract glowing trail with Sammy's head riding
// it, rather than a literal little creature. Drawn relative to its own
// pivot (0, 0) so the parent <g> can rotate it in place.
function SlugHead() {
  return (
    <>
      <circle cx="0" cy="0" r="3.4" fill="#d6b93a" stroke="#3f7fb0" strokeWidth="1.2" />
      <line x1="-2" y1="-2.5" x2="-4" y2="-5.8" stroke="#d6b93a" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="1" y1="-3" x2="0.3" y2="-6.3" stroke="#d6b93a" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="-4.5" cy="-6.6" r="1.5" fill="#d6b93a" />
      <circle cx="0" cy="-7.1" r="1.5" fill="#d6b93a" />
    </>
  )
}

// The day track's path: a gentle, multi-ripple wave echoing a slug's actual
// undulating crawl, instead of a single smooth arc. Horizontal position is
// strictly linear in t (0-1 left to right), so segment widths/percentages
// stay simple — only the vertical offset follows the wave.
type Point = [number, number]

const WAVE_X0 = 10
const WAVE_X1 = 290
const WAVE_BASE_Y = 32
const WAVE_AMPLITUDE = 4
const WAVE_CYCLES = 1 // one gentle, shallow ripple across the track

function wavePoint(t: number): Point {
  const x = WAVE_X0 + t * (WAVE_X1 - WAVE_X0)
  const y = WAVE_BASE_Y - WAVE_AMPLITUDE * Math.sin(2 * Math.PI * WAVE_CYCLES * t)
  return [x, y]
}

function buildWavePath(samples = 60): string {
  let d = ''
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const [x, y] = wavePoint(t)
    d += (i === 0 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(2) + ' '
  }
  return d
}

const DAY_TRACK_PATH = buildWavePath()

// Converts a pointer's clientX (from a drag on the day track) into a percent
// (0-100) position along the wave's t axis, the same units as
// DayTrackSegment.startPct/widthPct and DayTrack.markerPct. The SVG's
// viewBox is a fixed 300 units wide regardless of its rendered size, so the
// pointer position is rescaled from the element's actual on-screen width.
function dayTrackPctFromClientX(svg: SVGSVGElement, clientX: number): number {
  const rect = svg.getBoundingClientRect()
  const localX = ((clientX - rect.left) / rect.width) * 300
  const t = Math.min(Math.max((localX - WAVE_X0) / (WAVE_X1 - WAVE_X0), 0), 1)
  return t * 100
}

// Which meal-period segment a given percent position falls into — used both
// to figure out what the user dragged the head onto, and to decide which
// segment to highlight underneath the track for the currently selected meal.
function dayTrackSegmentIndexForPct(track: DayTrack, pct: number): number {
  const clamped = Math.min(Math.max(pct, 0), 100)
  for (let i = 0; i < track.segments.length; i++) {
    const seg = track.segments[i]
    if (clamped >= seg.startPct && clamped < seg.startPct + seg.widthPct) return i
  }
  return track.segments.length - 1
}

// Eases a displayed number toward a target value instead of snapping to
// it instantly — the ring's stroke already animates on change, so the
// number next to it should move too, or the two visually fight each other.
function useCountUp(target: number, duration = 500) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to) return

    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return display
}

// One column of the live macro totals strip. Pulled out of the inline
// .map() below because useCountUp is a hook — hooks can't be called from
// inside an array callback, each column needs its own instance of it.
interface MacroBarItemProps {
  label: string
  value: number
  goal: number
  color: string
  unit: string
  bordered: boolean
}

function MacroBarItem({ label, value, goal, color, unit, bordered }: MacroBarItemProps) {
  const animatedValue = useCountUp(value)

  return (
    <div className={`flex-1 min-w-0 ${bordered ? 'border-l border-white/10 pl-4' : ''}`}>
      <p className="text-[10px] font-semibold text-[#c2c6d0]/70 truncate">{label}</p>
      <p className="text-sm font-black mt-0.5 leading-tight" style={{ color }}>
        {Math.round(animatedValue)}{unit}
      </p>
      <p className="text-[11px] font-semibold text-[#c2c6d0]/50 leading-tight">
        / {Math.round(goal)}{unit}
      </p>
      <div className="h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min((animatedValue / Math.max(goal, 1)) * 100, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// Pure SVG Circular Progress Ring UI Component
interface ProgressRingProps {
  value: number
  goal: number
  strokeColor: string
  labelColor: string
  label: string
  unit: string
}

function ProgressRing({ value, goal, strokeColor, labelColor, label, unit }: ProgressRingProps) {
  const radius = 42
  const stroke = 9
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI

  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  // The ring's own stroke keeps animating via the CSS transition below off
  // the raw value; only the two text numbers ease toward it, so they move
  // in sync with the stroke instead of snapping ahead of it.
  const animatedValue = useCountUp(value)

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-2xl border border-white/10">
      <div className="relative flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        <div className="absolute text-center">
          <span className="text-base font-black tracking-tight text-[#dae2fd]">
            {goal > 0 ? Math.round((animatedValue / goal) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="text-center mt-2">
        <p className="text-sm font-black" style={{ color: labelColor }}>{label}</p>
        <p className="text-xs text-[#c2c6d0] font-semibold mt-0.5">
          {Math.round(animatedValue)} / {goal} {unit}
        </p>
      </div>
    </div>
  )
}

// Mini-Ring Component for the Calendar cells
function MiniProgressRing({ value, goal, strokeColor }: { value: number; goal: number; strokeColor: string }) {
  const radius = 16
  const stroke = 4
  const normalizedRadius = radius - stroke
  const circumference = normalizedRadius * 2 * Math.PI
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
      <circle
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={stroke}
        fill="transparent"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke={strokeColor}
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset }}
        strokeLinecap="round"
        fill="transparent"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="transition-all duration-300"
      />
    </svg>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'log' | 'progress'>('log')
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuEntry[]>([])
  const [selectedHall, setSelectedHall] = useState(DINING_HALLS[0])
  const locationLabel = DINING_HALL_NAMES.includes(selectedHall) ? 'Dining Hall' : 'Location'
  const [selectedMeal, setSelectedMeal] = useState(() => getCurrentMealPeriodLabel(DINING_HALLS[0]) || 'Breakfast')
  const [selectedDayOffset, setSelectedDayOffset] = useState(0) // 0 = Today, 1 = Tomorrow, ... see DAY_OFFSETS
  const [availableMealTypes, setAvailableMealTypes] = useState<string[]>(['Breakfast', 'Lunch', 'Dinner'])
  const [hallStatus, setHallStatus] = useState<HallStatus | null>(null)
  const [servings, setServings] = useState<{ [key: string]: number }>({})
  // Briefly shows a checkmark on a food's Log button right after it's logged
  const [justLogged, setJustLogged] = useState<{ [key: string]: boolean }>({})
  // Briefly shows a checkmark on a Delete button right after it's deleted, before the row disappears
  const [justDeleted, setJustDeleted] = useState<{ [key: string]: boolean }>({})
  // Swipe-to-delete on meal history rows: dragging a row left past a threshold
  // deletes it directly, with a red trash background growing behind it as it
  // travels. State/ref pairing mirrors the day-track drag pattern above (state
  // for render, ref for the window pointer handlers to read without a stale
  // closure).
  const [swipeDragOffset, setSwipeDragOffset] = useState(0)
  const [isSwipeDragging, setIsSwipeDragging] = useState<string | null>(null)
  const swipeDraggingRef = useRef<string | null>(null)
  const swipeDragOffsetRef = useRef(0)
  const swipeStartXRef = useRef(0)
  const swipePassedThresholdRef = useRef(false)
  const [goalMode, setGoalMode] = useState<'recommended' | 'manual'>('recommended')

  // SEARCH & STATION FILTER STATES
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStationFilters, setActiveStationFilters] = useState<string[]>([])

  // Daily targets state settings (now tracking all 4 macro targets)
  const [goalCalories, setGoalCalories] = useState(2000)
  const [goalProtein, setGoalProtein] = useState(120)
  const [goalCarbs, setGoalCarbs] = useState(250)
  const [goalFat, setGoalFat] = useState(70)
  const [ringClosedToast, setRingClosedToast] = useState<string | null>(null)
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false)

  // One-time welcome card for brand-new users — shown once, ever, gated by
  // a localStorage flag, then dismissed for good once they tap "Got it."
  const [showWelcome, setShowWelcome] = useState(false)
  useEffect(() => {
    try {
      if (!localStorage.getItem('ucsc_has_onboarded')) {
        setShowWelcome(true)
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — just skip the
      // one-time card rather than showing it every visit.
    }
  }, [])
  const dismissWelcome = () => {
    setShowWelcome(false)
    try {
      localStorage.setItem('ucsc_has_onboarded', '1')
    } catch {
      // Nothing to do if it can't be saved — worst case it shows again.
    }
  }

  // User profile modal + data (nickname / email)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile>({
    nickname: '',
    email: '',
    avatarUrl: null,
    memberSince: null,
    dietaryPreferences: [],
  })

  // Calendar View State
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMacro, setCalendarMacro] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories')
  const [historicalLogs, setHistoricalLogs] = useState<MealLog[]>([])
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())

  // Daily logs and totals tracking state
  const [loggedMeals, setLoggedMeals] = useState<MealLog[]>([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })

  // Ticks once a minute so the "X until Lunch/Dinner/Closing" countdown
  // below stays current without needing a page refresh.
  const [now, setNow] = useState(() => new Date())
  // The server renders this page at request time with its own "now", which
  // almost never matches the client's "now" by the time the bundle hydrates
  // (sometimes off by a minute, always off by at least a little), so the
  // countdown text below used to trip a React hydration mismatch and cause a
  // visible re-render flash on load. Keep it hidden until after mount, when
  // only the client's own clock is in play.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Minutes left until the next meal-period milestone (Breakfast/Lunch/
  // Dinner/Late Night/Closing) for the selected dining hall, today only —
  // there's no "now" to count down from for a future day. Returns null for
  // cafes/markets (no meal-period breakdown) or once today's service ends.
  const mealCountdown = useMemo(() => {
    if (selectedDayOffset !== 0) return null
    return getMealCountdown(selectedHall, now)
  }, [selectedHall, selectedDayOffset, now])

  // The "day track" — the dining hall's scheduled periods for whichever day
  // is being browsed, laid out proportionally to their real length. Today
  // gets a live "now" fill; other days render the same track with nothing
  // marked elapsed (see getDayTrack's dayOffset handling) so it still works
  // as a meal picker when browsing ahead.
  const dayTrack = useMemo(() => {
    return getDayTrack(selectedHall, now, selectedDayOffset)
  }, [selectedHall, selectedDayOffset, now])

  // Dragging the slug's head along the day track lets the person browse a
  // different meal period's menu directly from the track instead of using
  // the tabs above it — the head becomes a hand-movable "which menu am I
  // looking at" control, decoupled from the gold/blue fill (which always
  // reflects the real elapsed time of day, drag or no drag). `trackDragPct`
  // is null when at rest (the head then sits over whichever segment matches
  // `selectedMeal`) and holds a live 0-100 position while a drag is in
  // progress. The ref mirrors the state so the window pointerup handler —
  // registered once per drag via the effect below — always reads the latest
  // position rather than a stale closure value.
  const [trackDragPct, setTrackDragPct] = useState<number | null>(null)
  const trackDragPctRef = useRef<number | null>(null)
  const dayTrackSvgRef = useRef<SVGSVGElement | null>(null)
  // The zone (segment index) the drag is currently over, so we can fire a
  // haptic exactly when it crosses into a new one — a "detent" tap as it
  // locks into each zone in turn, not just once at the very end.
  const dragSegmentIndexRef = useRef<number | null>(null)

  const handleTrackPointerDown = (e: React.PointerEvent<SVGGeometryElement>) => {
    if (!dayTrackSvgRef.current) return
    e.preventDefault()
    const pct = dayTrackPctFromClientX(dayTrackSvgRef.current, e.clientX)
    trackDragPctRef.current = pct
    dragSegmentIndexRef.current = dayTrack ? dayTrackSegmentIndexForPct(dayTrack, pct) : null
    setTrackDragPct(pct)
  }

  useEffect(() => {
    if (trackDragPct === null) return

    const handleMove = (e: PointerEvent) => {
      if (!dayTrackSvgRef.current || !dayTrack) return
      const pct = dayTrackPctFromClientX(dayTrackSvgRef.current, e.clientX)
      trackDragPctRef.current = pct
      setTrackDragPct(pct)
      const zoneIndex = dayTrackSegmentIndexForPct(dayTrack, pct)
      if (zoneIndex !== dragSegmentIndexRef.current) {
        dragSegmentIndexRef.current = zoneIndex
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      }
    }

    const handleUp = () => {
      const finalPct = trackDragPctRef.current
      if (dayTrack && finalPct !== null) {
        const seg = dayTrack.segments[dayTrackSegmentIndexForPct(dayTrack, finalPct)]
        if (seg) {
          setSelectedMeal(seg.label)
        }
      }
      // Snapping into place (back onto the selected segment) is itself the
      // confirmation cue, same weight as a Log/Delete tap.
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      trackDragPctRef.current = null
      setTrackDragPct(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackDragPct !== null])

  // Where the head actually sits: live under the pointer while dragging,
  // otherwise resting at the midpoint of whichever segment matches the
  // currently selected meal (falling back to the real "now" position if,
  // for some reason, the selected meal isn't one of today's segments).
  const headPct = useMemo(() => {
    if (trackDragPct !== null) return trackDragPct
    if (!dayTrack) return 0
    const seg = dayTrack.segments.find((s) => s.label === selectedMeal)
    return seg ? seg.startPct + seg.widthPct / 2 : dayTrack.markerPct
  }, [trackDragPct, dayTrack, selectedMeal])

  // A light haptic tap when the day track crosses from one meal period
  // into the next (e.g. Breakfast -> Lunch) — a quiet "something changed"
  // cue. Skipped on the very first render for a hall (nothing "changed"
  // yet) and reset silently on hall switches so jumping between halls
  // doesn't fire a spurious buzz.
  const prevTrackKeyRef = useRef<string | null>(null)
  const prevActiveIndexRef = useRef<number | null>(null)
  useEffect(() => {
    // Keying on the day offset too means switching to Tomorrow (where
    // activeIndex is always -1, having no "now") resets silently instead of
    // reading as a crossing and firing a spurious haptic.
    const trackKey = `${selectedHall}|${selectedDayOffset}`
    if (prevTrackKeyRef.current !== trackKey) {
      prevTrackKeyRef.current = trackKey
      prevActiveIndexRef.current = dayTrack?.activeIndex ?? null
      return
    }
    const prevIndex = prevActiveIndexRef.current
    const nextIndex = dayTrack?.activeIndex ?? null
    if (prevIndex !== null && nextIndex !== null && prevIndex !== nextIndex) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    }
    prevActiveIndexRef.current = nextIndex
  }, [selectedHall, selectedDayOffset, dayTrack?.activeIndex])

  // A firmer haptic tap once, the moment the hall enters its last 15
  // minutes of service for the day — the one countdown moment actually
  // worth noticing. Resets itself once that window passes (mode changes
  // or minutesLeft climbs back up, e.g. after a hall switch).
  const closingSoonFiredRef = useRef(false)
  useEffect(() => {
    const isClosingSoon = mealCountdown?.mode === 'closes' && mealCountdown.minutesLeft <= 15
    if (isClosingSoon) {
      if (!closingSoonFiredRef.current) {
        Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
        closingSoonFiredRef.current = true
      }
    } else {
      closingSoonFiredRef.current = false
    }
  }, [selectedHall, mealCountdown])

  // A celebratory haptic + on-screen toast the moment a macro ring
  // first closes (crosses from under-goal to at/over-goal). Skipped on
  // the very first totals fetch (nothing "just happened" yet), same
  // guard pattern as the day-track crossing effect above, so opening the
  // app with an already-closed ring from earlier today stays silent.
  const prevRingsClosedRef = useRef<{ cal: boolean; protein: boolean; carbs: boolean; fat: boolean } | null>(null)
  const ringToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const closed = {
      cal: goalCalories > 0 && totals.calories >= goalCalories,
      protein: goalProtein > 0 && totals.protein >= goalProtein,
      carbs: goalCarbs > 0 && totals.carbs >= goalCarbs,
      fat: goalFat > 0 && totals.fat >= goalFat,
    }

    const prev = prevRingsClosedRef.current
    if (prev === null) {
      prevRingsClosedRef.current = closed
      return
    }

    const ringLabels: { key: keyof typeof closed; name: string }[] = [
      { key: 'cal', name: 'Calorie' },
      { key: 'protein', name: 'Protein' },
      { key: 'carbs', name: 'Carbs' },
      { key: 'fat', name: 'Fat' },
    ]
    const newlyClosed = ringLabels.filter(({ key }) => closed[key] && !prev[key]).map(({ name }) => name)

    if (newlyClosed.length > 0) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      const message =
        newlyClosed.length === 1
          ? `${newlyClosed[0]} ring closed!`
          : `${newlyClosed.slice(0, -1).join(', ')} & ${newlyClosed[newlyClosed.length - 1]} rings closed!`
      setRingClosedToast(message)
      if (ringToastTimeoutRef.current) clearTimeout(ringToastTimeoutRef.current)
      ringToastTimeoutRef.current = setTimeout(() => setRingClosedToast(null), 3200)
    }

    prevRingsClosedRef.current = closed
  }, [totals, goalCalories, goalProtein, goalCarbs, goalFat])

  // Hide the scrollbar everywhere — a visible one is a tell that this is a
  // web page rather than a native app.
  useEffect(() => {
    document.body.classList.add('hide-scrollbar')
  }, [])

  // Reset filters when location or meal type changes
  useEffect(() => {
    setSearchQuery('')
    setActiveStationFilters([])
  }, [selectedHall, selectedMeal])

  // Sync saved custom targets on view initialize
  useEffect(() => {
    const savedCals = localStorage.getItem('ucsc_goal_calories')
    const savedProtein = localStorage.getItem('ucsc_goal_protein')
    const savedCarbs = localStorage.getItem('ucsc_goal_carbs')
    const savedFat = localStorage.getItem('ucsc_goal_fat')

    if (savedCals) setGoalCalories(Number(savedCals))
    if (savedProtein) setGoalProtein(Number(savedProtein))
    if (savedCarbs) setGoalCarbs(Number(savedCarbs))
    if (savedFat) setGoalFat(Number(savedFat))
  }, [])

  // Load the current user's profile (nickname + email) for the Edit Profile modal
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', user.id)
          .maybeSingle()

        setUserProfile({
          nickname: (user.user_metadata?.nickname as string) || '',
          email: user.email || '',
          avatarUrl: profileRow?.avatar_url || (user.user_metadata?.avatar_url as string) || null,
          memberSince: user.created_at || null,
          dietaryPreferences: (user.user_metadata?.dietary_preferences as string[]) || [],
        })
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    fetchTodayMenu()
  }, [selectedHall, selectedMeal, selectedDayOffset])

  // Today's logged totals only ever reflect what was actually eaten today,
  // regardless of which day's menu is being browsed — not tied to selectedDayOffset.
  useEffect(() => {
    fetchTodayTotals()
  }, [selectedHall, selectedMeal])

  // Sync available meal-type tabs and the open/closed status whenever the hall
  // or browsed day changes
  useEffect(() => {
    const syncMealTypes = async () => {
      const types = await fetchMealTypesForHall(selectedHall, selectedDayOffset)
      // 'Brunch' is a display-only grouping (the hardcoded weekend day-track
      // shows one combined segment) — the real scraped data never has a
      // literal 'Brunch' meal_type, only 'Breakfast'/'Lunch', so check those
      // instead of the display label when deciding if a selection is covered.
      const isAvailable = (label: string | null) =>
        !label ? false : label === 'Brunch' ? (types.includes('Breakfast') || types.includes('Lunch')) : types.includes(label)
      if (types.length > 0 && !isAvailable(selectedMeal)) {
        // Prefer whichever period is live right now (today only) over just
        // falling back to the first tab, so switching to a hall you haven't
        // viewed yet still opens on "now" instead of always Breakfast.
        const current = selectedDayOffset === 0 ? getCurrentMealPeriodLabel(selectedHall) : null
        const trackDefault = dayTrack?.segments[0]?.label ?? types[0]
        setSelectedMeal(current && isAvailable(current) ? current : trackDefault)
      }
    }
    syncMealTypes()
    fetchHallStatus(selectedHall)
  }, [selectedHall, selectedDayOffset])

  // Fetch all history whenever the calendar view gets activated
  useEffect(() => {
    if (showCalendar) {
      fetchHistoricalLogs()
    }
  }, [showCalendar])

  useEffect(() => {
    const savedCals = localStorage.getItem('ucsc_goal_calories')
    const savedProtein = localStorage.getItem('ucsc_goal_protein')
    const savedCarbs = localStorage.getItem('ucsc_goal_carbs')
    const savedFat = localStorage.getItem('ucsc_goal_fat')
    const savedMode = localStorage.getItem('ucsc_goal_mode')

    if (savedCals) setGoalCalories(Number(savedCals))
    if (savedProtein) setGoalProtein(Number(savedProtein))
    if (savedCarbs) setGoalCarbs(Number(savedCarbs))
    if (savedFat) setGoalFat(Number(savedFat))
    if (savedMode === 'recommended' || savedMode === 'manual') setGoalMode(savedMode)
  }, [])

  // Process manual configurations save (called from SetTargetsModal)
  const handleSaveGoals = async (newTargets: DailyTargets, mode: 'recommended' | 'manual') => {
    const { calories, protein, carbs, fat } = newTargets

    setGoalCalories(calories)
    setGoalProtein(protein)
    setGoalCarbs(carbs)
    setGoalFat(fat)
    setGoalMode(mode)

    localStorage.setItem('ucsc_goal_calories', String(calories))
    localStorage.setItem('ucsc_goal_protein', String(protein))
    localStorage.setItem('ucsc_goal_carbs', String(carbs))
    localStorage.setItem('ucsc_goal_fat', String(fat))
    localStorage.setItem('ucsc_goal_mode', mode)

    setIsTargetsModalOpen(false)

    // Persist to Supabase so targets follow the user across devices.
    // Requires a `user_goals` table keyed on user_id (see note below).
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase
        .from('user_goals')
        .upsert({
          user_id: user.id,
          goal_calories: calories,
          goal_protein: protein,
          goal_carbs: carbs,
          goal_fat: fat,
        }, { onConflict: 'user_id' })

      if (error) {
        console.error('Could not sync targets to Supabase:', error.message)
      }
    }
  }

  // Called from UserProfileModal after nickname/email have been saved to Supabase auth
  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile)
    setIsProfileModalOpen(false)
  }

  // 1. Fetch items scraped for today matching selected Hall & Meal
  const fetchTodayMenu = async () => {
    setLoading(true)

    if (isHardcodedCoffeeShop(selectedHall)) {
      const items = getCoffeeShopMenu(selectedHall) || []
      const mealType = getCoffeeShopMealTypes(selectedHall)?.[0] || 'Menu'
      setMenu(items.map((item) => ({
        food_item_id: item.recipe_id,
        dining_hall: selectedHall,
        meal_type: mealType,
        station: item.station,
        food_items: item,
      })))
      setLoading(false)
      return
    }

    const dateStr = getDateStrForOffset(selectedDayOffset)

    // 'Brunch' is a display-only grouping used by the hardcoded day-track
    // schedule for weekend hours — the real scraped data still stores
    // weekend items under the literal 'Breakfast'/'Lunch' meal_type values,
    // never 'Brunch' itself, so that one selection has to match both.
    let menuQuery = supabase
      .from('daily_menus')
      .select(`
        food_item_id, dining_hall, meal_type, station,
        food_items:food_item_id (
          recipe_id, name, portion, calories, protein, carbs, sugar, fat
        )
      `)
      .eq('date', dateStr)
      .eq('dining_hall', selectedHall)

    menuQuery = selectedMeal === 'Brunch'
      ? menuQuery.in('meal_type', ['Breakfast', 'Lunch'])
      : menuQuery.eq('meal_type', selectedMeal)

    const { data, error } = await menuQuery

    if (!error && data) {
      const rows = data as unknown as MenuEntry[]
      // The 'Brunch' merge above (and possibly the source data itself) can
      // return the exact same item twice — e.g. the same side dish tagged
      // under both the 'Breakfast' and 'Lunch' rows for the day. De-dupe by
      // the pairing that actually defines "the same item shown twice": the
      // food itself at a given station, regardless of which literal
      // meal_type row it came from.
      const seen = new Set<string>()
      const deduped = rows.filter((entry) => {
        const key = `${entry.food_item_id}|${entry.station}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setMenu(deduped)
    }
    setLoading(false)
  }

  // Fetch which meal_type values actually exist for this hall on the given day.
  // Real dining halls have Breakfast/Lunch/Dinner; cafes/markets may only have
  // one value like "Menu" or "ALL"; retail spots with no scraped data at all
  // (e.g. Merrill Market) get an empty array so the tab row hides entirely.
  const fetchMealTypesForHall = async (hall: string, dayOffset: number = 0) => {
    const hardcoded = getCoffeeShopMealTypes(hall)
    if (hardcoded) {
      setAvailableMealTypes(hardcoded)
      return hardcoded
    }

    const dateStr = getDateStrForOffset(dayOffset)

    const { data, error } = await supabase
      .from('daily_menus')
      .select('meal_type')
      .eq('dining_hall', hall)
      .eq('date', dateStr)

    if (error || !data || data.length === 0) {
      setAvailableMealTypes([])
      return []
    }

    const found = Array.from(new Set(data.map((row) => row.meal_type)))

    // Keep Breakfast -> Lunch -> Dinner order when present; anything else
    // (e.g. "Menu", "ALL") gets appended after.
    const preferredOrder = ['Breakfast', 'Lunch', 'Dinner', 'Late Night']
    const ordered = [
      ...preferredOrder.filter((m) => found.includes(m)),
      ...found.filter((m) => !preferredOrder.includes(m)),
    ]

    setAvailableMealTypes(ordered)
    return ordered
  }

  // Fetch the current open/closed status for the selected hall from hall_status
  const fetchHallStatus = async (hall: string) => {
    // Try instant, hours-based status first
    const instantStatus = getHallOpenStatus(hall)
    if (instantStatus) {
      setHallStatus(instantStatus)
      return
    }

    // Fall back to scraped status for halls without published hours data
    const { data, error } = await supabase
      .from('hall_status')
      .select('is_open, status_text')
      .eq('dining_hall', hall)
      .maybeSingle()

    if (error || !data) {
      setHallStatus(null)
      return
    }
    setHallStatus(data)
  }

  // Helper utility to strip leading and trailing hyphens from database stations (e.g. "-- Grill --" -> "Grill")
  const cleanStationName = (rawName: string) => {
    if (!rawName) return 'General'
    return rawName.replace(/--/g, '').trim()
  }

  // For Today, use the live "is it open right now" status. For Tomorrow/
  // Monday/etc., check whether the hall has any published hours at all on
  // that specific date — a hall can be scraped to have menu items sitting
  // in daily_menus for a date it's actually closed (the scraper doesn't
  // check hours), so this is what actually gates the banner/menu for those
  // days instead of silently showing food for a closed day.
  const futureDayStatus = useMemo(() => {
    if (selectedDayOffset === 0) return null
    const dateStr = getDateStrForOffset(selectedDayOffset)
    return getHallStatusForDate(selectedHall, dateStr)
  }, [selectedHall, selectedDayOffset])

  const isClosedNow =
    selectedDayOffset === 0
      ? !!hallStatus && !hallStatus.is_open
      : !!futureDayStatus && !futureDayStatus.is_open

  // Closed overnight before today's first meal period has started (e.g.
  // checking at 2 AM before an 8 AM Breakfast) is a different situation than
  // closed-for-the-day: the hall is still "closed", but today's menu has
  // already been scraped and is worth previewing, so we show it instead of
  // hiding everything behind the closed banner. The generic closed banner
  // is suppressed in this case since the "Opens at X" countdown line says
  // the same thing with more useful detail.
  const isOpeningLaterToday = isClosedNow && mealCountdown?.mode === 'opens'
  const showMenuSection = !isClosedNow || isOpeningLaterToday

  // 2. Extract unique stations dynamically from raw menu data
  const availableStations = useMemo(() => {
    const stations = menu.map((entry) => getEffectiveStation(entry))
    const unique = Array.from(new Set(stations))
    return unique.sort((a, b) => getStationSortIndex(a) - getStationSortIndex(b))
  }, [menu])

  // "What fits right now" — once a hall and meal are picked, reframe the
  // menu around what's actually left in today's goals instead of making the
  // student scan the whole list themselves. Candidates are today's items
  // that wouldn't blow the remaining calorie budget on their own, ranked by
  // protein first since that's usually the harder macro to hit. Hidden once
  // either calories or protein for the day are already met -- there's
  // nothing meaningful left to suggest fitting in.
  const whatFitsNow = useMemo(() => {
    const remainingCalories = Math.max(goalCalories - totals.calories, 0)
    const remainingProtein = Math.max(goalProtein - totals.protein, 0)
    if (goalCalories <= 0 || remainingCalories <= 0 || remainingProtein <= 0) {
      return { remainingCalories, remainingProtein, items: [] as FoodItem[] }
    }

    const seen = new Set<string>()
    const candidates: FoodItem[] = []
    menu.forEach((entry) => {
      const food = entry.food_items
      if (!food || seen.has(food.recipe_id)) return
      const hasNutrition =
        (food.calories ?? 0) !== 0 ||
        (food.protein ?? 0) !== 0 ||
        (food.carbs ?? 0) !== 0 ||
        (food.fat ?? 0) !== 0
      if (!hasNutrition) return
      // Leave headroom: a single item shouldn't eat the whole remaining budget
      if (food.calories > remainingCalories * 0.9) return
      seen.add(food.recipe_id)
      candidates.push(food)
    })

    const items = candidates
      .sort((a, b) => b.protein - a.protein || a.calories - b.calories)
      .slice(0, 3)

    return { remainingCalories, remainingProtein, items }
  }, [menu, totals, goalCalories, goalProtein])

  // 3. Filter raw items first by search input & clicked station pills
  const filteredMenu = useMemo(() => {
    return menu.filter((entry) => {
      const food = entry.food_items
      if (!food) return false

      // Skip items with no real nutrition data (0 cal, 0P, 0C, 0F across the
      // board) — these are usually placeholder/condiment rows the site never
      // filled in, not something anyone is actually tracking macros for.
      const hasNutrition =
        (food.calories ?? 0) !== 0 ||
        (food.protein ?? 0) !== 0 ||
        (food.carbs ?? 0) !== 0 ||
        (food.fat ?? 0) !== 0
      if (!hasNutrition) return false

      const matchesSearch = food.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStation =
        activeStationFilters.length === 0 ||
        activeStationFilters.includes(getEffectiveStation(entry))

      return matchesSearch && matchesStation
    })
  }, [menu, searchQuery, activeStationFilters])

  // 4. Group filtered results into station headers (UCSC Style)
  const groupedMenu = useMemo(() => {
    const groups: { [station: string]: MenuEntry[] } = {}
    filteredMenu.forEach((entry) => {
      const stationKey = getEffectiveStation(entry)
      if (!groups[stationKey]) groups[stationKey] = []
      groups[stationKey].push(entry)
    })
    return groups
  }, [filteredMenu])

  const parentGroupedMenu = useMemo((): ParentGroup[] => {
    const parents: Record<string, Record<string, MenuEntry[]>> = {}

    Object.entries(groupedMenu).forEach(([station, entries]) => {
      const [parent, sub] = station.includes(' - ') ? station.split(' - ') : [station, '']
      if (!parents[parent]) parents[parent] = {}
      const subKey = sub || '__none__'
      if (!parents[parent][subKey]) parents[parent][subKey] = []
      parents[parent][subKey].push(...entries)
    })

    const result: ParentGroup[] = Object.entries(parents).map(([parent, subs]) => {
      const subgroups = Object.entries(subs).map(([subKey, entries]) => ({
        sub: subKey === '__none__' ? null : subKey,
        entries,
      }))

      subgroups.sort((a, b) => {
        if (a.sub === null) return -1
        if (b.sub === null) return 1
        const aIdx = CONDIMENT_SUB_ORDER.indexOf(a.sub)
        const bIdx = CONDIMENT_SUB_ORDER.indexOf(b.sub)
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
      })

      return { parent, subgroups }
    })

    result.sort((a, b) => getStationSortIndex(a.parent) - getStationSortIndex(b.parent))

    return result
  }, [groupedMenu])

  const sortedGroupedMenuEntries = useMemo(() => {
    return Object.entries(groupedMenu).sort(
      ([a], [b]) => getStationSortIndex(a) - getStationSortIndex(b)
    )
  }, [groupedMenu])



  const handleToggleStationFilter = (station: string) => {
    Haptics.selectionChanged().catch(() => {})
    setActiveStationFilters((prev) =>
      prev.includes(station) ? prev.filter((s) => s !== station) : [...prev, station]
    )
  }

  // 5. Fetch what the user logged today to sum up live tracker macros
  const fetchTodayTotals = async () => {
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Los_Angeles'
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('meal_logs')
      .select(`
        id,
        servings,
        dining_hall,
        meal_type,
        log_date,
        food_items:food_item_id (name, calories, protein, carbs, fat)
      `)
      .eq('user_id', user.id)
      .eq('log_date', todayStr)

    if (error) {
      console.error("Error fetching totals:", error.message)
      return
    }

    if (data) {
      setLoggedMeals(data as unknown as MealLog[])
      const runningTotals = data.reduce((acc, log: any) => {
        const item = log.food_items
        const s = Number(log.servings) || 1
        if (item) {
          acc.calories += (Number(item.calories) || 0) * s
          acc.protein += (Number(item.protein) || 0) * s
          acc.carbs += (Number(item.carbs) || 0) * s
          acc.fat += (Number(item.fat) || 0) * s
        }
        return acc
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

      setTotals(runningTotals)
    }
  }

  // 6. Fetch all historical meal logs for the user to plot onto the Calendar
  const fetchHistoricalLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('meal_logs')
      .select(`
        id,
        servings,
        dining_hall,
        meal_type,
        log_date,
        food_items:food_item_id (name, calories, protein, carbs, fat)
      `)
      .eq('user_id', user.id)
      .order('log_date', { ascending: true })

    if (!error && data) {
      setHistoricalLogs(data as unknown as MealLog[])
    }
  }

  // 7. Log an item to Supabase meal_logs table
  const handleLogFood = async (foodId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return alert('Please sign in first!')

    const count = servings[foodId] || 1
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Los_Angeles'
    })

    const { error } = await supabase
      .from('meal_logs')
      .insert({
        user_id: user.id,
        food_item_id: foodId,
        dining_hall: selectedHall,
        meal_type: selectedMeal,
        servings: count,
        log_date: todayStr
      })

    if (error) {
      alert(`Logging failed: ${error.message}`)
    } else {
      // Quick, light confirmation tap — this is a frequent, low-stakes action.
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      setJustLogged(prev => ({ ...prev, [foodId]: true }))
      setTimeout(() => {
        setJustLogged(prev => {
          const next = { ...prev }
          delete next[foodId]
          return next
        })
      }, 1400)
      fetchTodayTotals()
    }
  }

  // Swipe-to-delete on a meal history row: drag left past SWIPE_DELETE_THRESHOLD
  // and releasing deletes the row immediately — no second tap on a revealed
  // button. SWIPE_MAX_DRAG caps how far the row can travel so the red
  // background behind it doesn't stretch past the point it needs to.
  const SWIPE_DELETE_THRESHOLD = 90
  const SWIPE_MAX_DRAG = 160

  const handleSwipePointerDown = (logId: string, e: React.PointerEvent<HTMLDivElement>) => {
    swipeDraggingRef.current = logId
    swipeStartXRef.current = e.clientX
    swipeDragOffsetRef.current = 0
    swipePassedThresholdRef.current = false
    setIsSwipeDragging(logId)
  }

  useEffect(() => {
    if (isSwipeDragging === null) return

    const handleMove = (e: PointerEvent) => {
      if (swipeDraggingRef.current === null) return
      const dx = e.clientX - swipeStartXRef.current
      const next = Math.min(0, Math.max(-SWIPE_MAX_DRAG, dx))
      swipeDragOffsetRef.current = next
      setSwipeDragOffset(next)
      const passedThreshold = next <= -SWIPE_DELETE_THRESHOLD
      if (passedThreshold !== swipePassedThresholdRef.current) {
        swipePassedThresholdRef.current = passedThreshold
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      }
    }

    const handleUp = () => {
      const logId = swipeDraggingRef.current
      const finalOffset = swipeDragOffsetRef.current
      if (logId !== null && finalOffset <= -SWIPE_DELETE_THRESHOLD) {
        handleDeleteLog(logId)
      }
      swipeDraggingRef.current = null
      swipeDragOffsetRef.current = 0
      swipePassedThresholdRef.current = false
      setSwipeDragOffset(0)
      setIsSwipeDragging(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isSwipeDragging])

  // 8. Delete a logged meal
  const handleDeleteLog = async (logId: string) => {
    const { error } = await supabase
      .from('meal_logs')
      .delete()
      .eq('id', logId)

    if (error) {
      alert(`Could not delete log: ${error.message}`)
    } else {
      // Firmer tap than logging — deleting is the more deliberate, less
      // frequent action, so it gets a touch more weight.
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
      // Show the checkmark briefly before the row actually disappears,
      // same pattern as the Log button's confirmation.
      setJustDeleted(prev => ({ ...prev, [logId]: true }))
      setTimeout(() => {
        fetchTodayTotals()
        if (showCalendar) fetchHistoricalLogs() // Also sync up calendar dynamically
      }, 350)
    }
  }

  // Group and sum macros by local date strings for our calendar render
  const getHistoricalSumForDate = (dateStr: string) => {
    return historicalLogs
      .filter(log => log.log_date === dateStr)
      .reduce((acc, log) => {
        const item = log.food_items
        const s = Number(log.servings) || 1
        if (item) {
          acc.calories += (Number(item.calories) || 0) * s
          acc.protein += (Number(item.protein) || 0) * s
          acc.carbs += (Number(item.carbs) || 0) * s
          acc.fat += (Number(item.fat) || 0) * s
        }
        return acc
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
  }

  // Navigate the calendar view to the previous month
  const goToPreviousMonth = () => {
    setCalendarViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  // Navigate the calendar view to the next month
  const goToNextMonth = () => {
    setCalendarViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // Whether the calendar is currently showing the real current month (used to disable "Next")
  const isCurrentMonth =
    calendarViewDate.getFullYear() === new Date().getFullYear() &&
    calendarViewDate.getMonth() === new Date().getMonth()

  // Generate calendar grid dates for whichever month is currently being viewed
  const getCalendarDays = () => {
    const year = calendarViewDate.getFullYear()
    const month = calendarViewDate.getMonth() + 1 // keep 1-indexed to match the string-building math below

    const firstDay = new Date(year, month - 1, 1)
    const startingDayOfWeek = firstDay.getDay()
    const totalDays = new Date(year, month, 0).getDate()

    const daysList: { dayNum: number | null; dateString: string | null }[] = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      daysList.push({ dayNum: null, dateString: null })
    }

    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(month).padStart(2, '0')
      const dayStr = String(d).padStart(2, '0')
      daysList.push({
        dayNum: d,
        dateString: `${year}-${monthStr}-${dayStr}`
      })
    }

    return daysList
  }

  return (
    <div
      className="min-h-screen bg-[#0b1326] text-[#dae2fd] relative overflow-x-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >

      {/* TopAppBar */}
      <header className="app-header fixed top-0 w-full z-50 flex justify-between items-center px-5 py-3 bg-[#0b1326]/60 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-4">
          <img
            src="/sammy-logo-transparent.png"
            alt="Sammy's Palate"
            className="h-9 w-9 object-contain shrink-0"
          />

          {/* Stacked container */}
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-[#ffe6ab] tracking-tight leading-none mb-0.5">
              Sammy's Palate
            </span>
            <span className="text-xs font-bold text-[#dae2fd]/70">
              UCSC Macro Tracker
            </span>
          </div>
        </div>


        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/20 ml-1 flex items-center justify-center hover:bg-white/20 transition-colors active:scale-95 overflow-hidden"
            aria-label="Edit user profile"
          >
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-[#c2c6d0]" />
            )}
          </button>
        </div>
      </header>

      {/* Ring-closed toast — kept outside <main> (and its desktop zoom
          wrapper) on purpose so this fixed banner always sits relative to
          the viewport, not to a zoomed ancestor. */}
      {ringClosedToast && (
        <div className="fixed top-[130px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-full px-5 flex justify-center">
          <div className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#121c33]/95 backdrop-blur-xl border border-[#d6b93a]/40 shadow-[0_8px_30px_-6px_rgba(214,185,58,0.35)] animate-ring-toast">
            <span className="text-base font-bold text-[#EDEFF5] whitespace-nowrap">{ringClosedToast}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="app-main-top px-3 max-w-2xl mx-auto pb-[130px] lg:max-w-[1100px] lg:px-5">
      <div className="lg:[zoom:1.3]">

        {/* Live macro totals banner — Log Menu only; Progress has its own rings for this.
            A slim single-row strip (value against target + a thin progress bar per
            macro) instead of four separate boxed tiles stacked 2x2 — same information,
            a fraction of the height. */}
        {activeTab === 'log' && (
          <div className="rounded-2xl px-4 py-3 mb-6 flex items-stretch gap-4 bg-[#141b2e] border border-white/10">
            {[
              { label: 'Calories', value: totals.calories, goal: goalCalories, color: '#d8b61c', unit: '' },
              { label: 'Protein', value: totals.protein, goal: goalProtein, color: '#5bb448', unit: 'g' },
              { label: 'Carbs', value: totals.carbs, goal: goalCarbs, color: '#bd5db8', unit: 'g' },
              { label: 'Fat', value: totals.fat, goal: goalFat, color: '#fb7185', unit: 'g' },
            ].map((m, i) => (
              <MacroBarItem key={m.label} label={m.label} value={m.value} goal={m.goal} color={m.color} unit={m.unit} bordered={i > 0} />
            ))}
          </div>
        )}

        {activeTab === 'log' ? (
          <div className="space-y-6">
            {/* Hall + meal selector */}
            <div className="rounded-2xl p-5 space-y-4 bg-[#141b2e] border border-white/10">
              <div className="flex flex-col md:flex-row gap-3">
                <select
                  value={selectedHall}
                  onChange={(e) => {
                    setSelectedHall(e.target.value)
                    Haptics.selectionChanged().catch(() => {})
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-[#171f33] p-3 text-[#dae2fd] font-medium focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40"
                >
                  <optgroup label="Dining Halls">
                    {DINING_HALLS.slice(0, 5).map(hall => <option key={hall} value={hall}>{hall}</option>)}
                  </optgroup>
                  <optgroup label="Cafes & Markets">
                    {DINING_HALLS.slice(5).map(hall => <option key={hall} value={hall}>{hall}</option>)}
                  </optgroup>
                </select>
              </div>

              {/* Day selector — lets students browse published upcoming menus.
                  Sits above the meal-type tabs so "which day" is chosen before "which meal". */}
              <div className="flex bg-[#171f33] p-1.5 rounded-xl gap-1">
                {DAY_OFFSETS.map(offset => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => {
                      setSelectedDayOffset(offset)
                      Haptics.selectionChanged().catch(() => {})
                    }}
                    className={`flex-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap ${selectedDayOffset === offset
                      ? 'bg-[#d6b93a]/15 text-[#d6b93a] border border-[#d6b93a]/40'
                      : 'text-[#c2c6d0] hover:text-[#dae2fd] border border-transparent'
                      }`}
                  >
                    {getDayOffsetLabel(offset)}
                  </button>
                ))}
              </div>

              {/* Meal-period selection now lives entirely on the day track
                  below (drag the head, tap a letter, or tap anywhere on the
                  wave) instead of a separate pill row — one control instead
                  of two that used to say the same thing. */}

              {/* Countdown to the next meal-period milestone (Breakfast/Lunch/
                  Dinner/Late Night) while service is running, "Opens at X"
                  before today's first period, "Closing at X" during the
                  day's last period — dining halls only, today only. */}
              {mounted && mealCountdown && (
                <p className="text-left text-sm font-semibold text-[#fb7185]">
                  {mealCountdown.mode === 'until' && `${formatCountdown(mealCountdown.minutesUntil!)} until ${mealCountdown.label}`}
                  {mealCountdown.mode === 'opens' && `Opens at ${mealCountdown.time}`}
                  {mealCountdown.mode === 'closes' && `Closing at ${mealCountdown.time}`}
                </p>
              )}

              {/* "Day track" — today's meal periods laid out proportionally to
                  their real length, with a live marker showing where "now"
                  sits across the whole day at a glance (not just time left in
                  the current period). Segments fill in behind the marker as
                  each one elapses; a soft haptic tap marks the moment it
                  crosses into the next period. */}
              {dayTrack && (
                <div className="space-y-1.5 pt-1 pb-1">
                  {/* A rippling wave instead of a straight slider or a single arc —
                      echoes a slug's actual undulating crawl. Elapsed time is a
                      neon gold stroke with a glowing blue outline traced on both
                      edges, drawn up to "now" using the path's own declared length
                      (pathLength=100), so the dash math lines up directly with
                      dayTrack.markerPct with no arc-length calculation needed —
                      both strokes use a single dash spanning the whole path, so
                      the reveal (and the blue outline) stop exactly at "now" and
                      never bleed into the untraveled portion. Sammy's head rides
                      the wave, idling slowly between +65 and -65 degrees. */}
                  <svg ref={dayTrackSvgRef} viewBox="0 0 300 64" className="w-full" style={{ height: 58, overflow: 'visible', touchAction: 'none' }}>
                    <defs>
                      {/* Soft neon fade at the leading edge of the completed
                          portion, where the glowing stroke gives way to the
                          plain unlit track. */}
                      <radialGradient id="dayTrackEdgeGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#3f7fb0" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#3f7fb0" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <path d={DAY_TRACK_PATH} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
                    {/* Invisible, generously wide hit target spanning the whole
                        path — lets a single tap anywhere on the track jump the
                        head straight there (same snap + haptic as a drag),
                        not just a drag starting right on the head itself. */}
                    <path
                      d={DAY_TRACK_PATH}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={28}
                      strokeLinecap="round"
                      style={{ cursor: 'pointer', touchAction: 'none', pointerEvents: 'stroke' }}
                      onPointerDown={handleTrackPointerDown}
                    />
                    {/* Blue neon outline — wider than the gold fill and drawn
                        underneath it, so a glowing blue edge shows on both sides
                        of the gold. Revealed with the same single-dash-the-length-
                        of-the-path trick as the gold stroke (not a repeating dash
                        pattern), so it's strictly confined to the completed portion. */}
                    <path
                      d={DAY_TRACK_PATH}
                      fill="none"
                      stroke="#3f7fb0"
                      strokeOpacity="1"
                      strokeWidth="11"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={100 - dayTrack.markerPct}
                      style={{ filter: 'drop-shadow(0 0 2px rgba(63,127,176,0.6))' }}
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                    <path
                      d={DAY_TRACK_PATH}
                      fill="none"
                      stroke="#d6b93a"
                      strokeOpacity="1"
                      strokeWidth="6"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={100 - dayTrack.markerPct}
                      style={{ filter: 'drop-shadow(0 0 3px rgba(214,185,58,0.85))' }}
                      className="animate-glow-pulse transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                    {[...dayTrack.segments.map((seg) => seg.startPct), 100].map((pct, i) => {
                      const [tx, ty] = wavePoint(pct / 100)
                      return <circle key={i} cx={tx} cy={ty} r="2" fill="#3f7fb0" fillOpacity="0.6" />
                    })}
                    {(() => {
                      // While the hall is actually closed right now (today only —
                      // there's no live "now" on a future day), the head rests at
                      // the real elapsed position instead of the selected meal:
                      // dayTrack.markerPct already resolves to 0 before opening
                      // and 100 once service has ended, so it doubles as "parked
                      // at the start, asleep" / "parked at closing time, asleep"
                      // for free, with no separate opening/closing branch needed.
                      const isSleeping = trackDragPct === null && selectedDayOffset === 0 && isClosedNow
                      const restPct = selectedDayOffset === 0 && isClosedNow ? dayTrack.markerPct : headPct
                      const t = (trackDragPct !== null ? trackDragPct : restPct) / 100
                      const [mx, my] = wavePoint(t)
                      return (
                        <g
                          style={{ transition: trackDragPct !== null ? 'none' : 'transform 900ms ease-out' }}
                          transform={`translate(${mx} ${my})`}
                        >
                          {/* Soft gradient fade marking the edge of the completed
                              (neon) portion of the track, right where the head
                              currently sits. */}
                          <circle cx={0} cy={0} r={23} fill="url(#dayTrackEdgeGlow)" />
                          {/* Invisible, generously-sized hit target so the head is
                              easy to grab on a touchscreen — the drawn head itself
                              is much smaller than a comfortable tap/drag target. */}
                          <circle
                            cx={0}
                            cy={0}
                            r={22}
                            fill="transparent"
                            style={{ cursor: trackDragPct !== null ? 'grabbing' : 'grab', touchAction: 'none' }}
                            onPointerDown={handleTrackPointerDown}
                          />
                          {/* Just the head now — no body/slide profile. Mirrored
                              across the y-axis from its original orientation and
                              scaled up for visibility. Idles between +65 and -65
                              degrees while awake; holds a fixed gentle tilt instead
                              while asleep, since a sleeping creature shouldn't be
                              actively rocking its head. Dragging (or tapping the
                              track) elsewhere switches which meal period's menu is
                              shown below; the gold/blue fill still always reflects
                              the real time of day regardless of where the head
                              itself is parked. */}
                          <g
                            transform="scale(-2.6, 2.6)"
                            style={{ filter: 'drop-shadow(0 0 2px rgba(63,127,176,0.7))', pointerEvents: 'none' }}
                          >
                            {isSleeping ? (
                              <g transform="rotate(18)">
                                <SlugHead />
                              </g>
                            ) : (
                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="rotate"
                                  values="-65;65;-65"
                                  keyTimes="0;0.5;1"
                                  calcMode="spline"
                                  keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
                                  dur="7.5s"
                                  repeatCount="indefinite"
                                />
                                <SlugHead />
                              </g>
                            )}
                          </g>
                          {/* Two small "Zz" marks drifting up and fading near the
                              top-right of the face while asleep — outside the
                              mirrored/scaled head group so they stay upright and
                              unflipped regardless of which way the head is facing. */}
                          {isSleeping && (
                            <g style={{ pointerEvents: 'none' }}>
                              <text x="13" y="-16" fontSize="9" fontWeight="bold" fill="#a1c9ff">
                                <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.7;1" dur="2.4s" repeatCount="indefinite" />
                                <animateTransform attributeName="transform" type="translate" values="0 6;0 -6" dur="2.4s" repeatCount="indefinite" />
                                z
                              </text>
                              <text x="19" y="-23" fontSize="6" fontWeight="bold" fill="#a1c9ff">
                                <animate attributeName="opacity" values="0;0.7;0.7;0" keyTimes="0;0.15;0.7;1" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                                <animateTransform attributeName="transform" type="translate" values="0 4;0 -8" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                                z
                              </text>
                            </g>
                          )}
                        </g>
                      )
                    })()}
                  </svg>
                  <div className="flex">
                    {dayTrack.segments.map((seg, i) => (
                      <button
                        key={`${seg.label}-label-${i}`}
                        type="button"
                        style={{ width: `${seg.widthPct}%` }}
                        onClick={() => {
                          setSelectedMeal(seg.label)
                          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
                        }}
                        className={`text-center py-1 text-[9px] font-bold transition-colors duration-500 active:scale-90 ${
                          i === dayTrackSegmentIndexForPct(dayTrack, headPct) ? 'text-[#d6b93a]' : 'text-[#c2c6d0]/40'
                        }`}
                      >
                        {seg.label === 'Late Night' ? 'LN' : seg.label === 'Brunch' ? 'Br' : seg.label[0]}
                      </button>
                    ))}
                  </div>
                  {/* Open / close times, sky blue to match the logo's accent color */}
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold text-[#a1c9ff]">
                      {dayTrack.opensAt}
                    </span>
                    <span className="text-[10px] font-bold text-[#a1c9ff]">
                      {dayTrack.closesAt}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3">
                {/* Search + station filter pills — hidden when the hall is closed right now */}
                {showMenuSection && (
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <div className="relative w-full">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c2c6d0]" size={16} />
                      <input
                        type="text"
                        placeholder="Search today's items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#171f33] pl-10 pr-9 py-2.5 text-[#dae2fd] font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40 placeholder-[#c2c6d0]/50"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c2c6d0] hover:text-[#dae2fd] transition-colors active:scale-90"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {availableStations.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {availableStations.map((station) => {
                          const isActive = activeStationFilters.includes(station)
                          const [parentLabel, subLabel] = station.includes(' - ')
                            ? station.split(' - ')
                            : [null, station]

                          return (
                            <button
                              key={station}
                              type="button"
                              onClick={() => handleToggleStationFilter(station)}
                              className={`px-3 py-1.5 rounded-full border transition active:scale-95 flex flex-col items-center leading-tight ${isActive
                                ? 'bg-[#d6b93a]/15 text-[#d6b93a] border-[#d6b93a]/40'
                                : 'bg-white/5 text-[#c2c6d0] hover:bg-white/10 border-white/15'
                                }`}
                            >
                              {parentLabel && (
                                <span className={`text-[9px] font-semibold uppercase tracking-wide ${isActive ? 'text-[#d6b93a]/70' : 'text-[#a1c9ff]'}`}>
                                  {parentLabel}
                                </span>
                              )}
                              <span className="text-xs font-bold">{cleanStationName(subLabel)}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dining hall closed banner — live status for Today, published hours for other
                  days. Suppressed when opening later today, since the "Opens at X" countdown
                  line above already says this with more useful detail. */}
              {isClosedNow && !isOpeningLaterToday && (
                <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-300 font-semibold text-sm text-center">
                  {selectedDayOffset === 0
                    ? `${locationLabel} is Closed`
                    : `${locationLabel} is Closed ${getDayOffsetLabel(selectedDayOffset)}`}
                </div>
              )}

              {/* "What fits right now" — surfaces once a hall/meal is picked, reframing
                  the menu around what's left in today's goals instead of just listing it.
                  Tapping a suggestion searches it up in the full list below instead of
                  logging it directly, so portion size still gets picked deliberately. */}
              {showMenuSection && whatFitsNow.items.length > 0 && (
                <div className="rounded-2xl p-4 space-y-3 bg-[#141b2e] border border-[#5bb448]/25">
                  <p className="text-sm font-semibold text-[#dae2fd] leading-snug">
                    You've got <span className="text-[#5bb448] font-bold">{Math.round(whatFitsNow.remainingProtein)}g protein</span> and{' '}
                    <span className="text-[#d8b61c] font-bold">{Math.round(whatFitsNow.remainingCalories)} cal</span> left today — here's what works
                  </p>
                  <div className="divide-y divide-white/10">
                    {whatFitsNow.items.map((food) => (
                      <button
                        key={food.recipe_id}
                        type="button"
                        onClick={() => {
                          setSearchQuery(food.name)
                          Haptics.selectionChanged().catch(() => {})
                        }}
                        className="w-full flex items-center justify-between gap-3 py-2.5 text-left active:scale-[0.98] transition-transform"
                      >
                        <span className="font-bold text-sm text-[#dae2fd]">{food.name}</span>
                        <span className="shrink-0 text-xs font-semibold text-[#c2c6d0]/70">
                          {Math.round(food.calories)} cal · {Math.round(food.protein)}g protein
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Menu items — hidden when the hall is closed right now, except when it's
                  opening later today (previewing today's already-scraped menu before open) */}
              {showMenuSection && (
                <div>
                  <h2 className="text-lg font-bold mb-5 tracking-tight">
                    {getDayOffsetLabel(selectedDayOffset)}'s Menu
                    {availableMealTypes.length > 1 && ` (${selectedMeal})`}
                  </h2>

                  {loading ? (
                    <div className="space-y-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="py-4 flex items-center justify-between gap-4 animate-pulse"
                          style={{ animationDelay: `${i * 120}ms` }}
                        >
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-2/3 max-w-[180px] rounded bg-white/10" />
                            <div className="h-3 w-1/3 max-w-[90px] rounded bg-white/5" />
                          </div>
                          <div className="h-8 w-20 rounded-lg bg-white/5 shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : Object.keys(groupedMenu).length === 0 ? (
                    <div className="py-12 text-center text-[#c2c6d0] font-medium">
                      {menu.length === 0
                        ? `No items found for this meal period ${selectedDayOffset === 0 ? 'today' : selectedDayOffset === 1 ? 'tomorrow' : `on ${getDayOffsetLabel(selectedDayOffset)}`}.`
                        : "No menu items match your search or station filters."}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {parentGroupedMenu.map(({ parent, subgroups }) => (
                        <div key={parent} className="space-y-3">
                          <div className="flex items-center">
                            <span className="text-xs font-black tracking-wider text-[#00325b] uppercase bg-[#a1c9ff] border border-[#a1c9ff] px-3 py-1 rounded-lg shadow-sm">
                              {cleanStationName(parent)}
                            </span>
                            <div className="flex-1 h-px bg-white/10 ml-4" />
                          </div>

                          {subgroups.map(({ sub, entries }) => (
                            <div key={sub || 'none'} className="space-y-2">
                              {sub && (
                                <p className="inline-block text-sm font-bold tracking-wider text-[#a1c9ff] bg-[#a1c9ff]/10 uppercase px-2 py-0.5 rounded-lg">
                                  {sub}
                                </p>
                              )}
                              <div className="divide-y divide-white/10">
                                {entries.map((entry, entryIndex) => {
                                  const food = entry.food_items
                                  if (!food) return null
                                  return (
                                    <article
                                      key={food.recipe_id}
                                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl px-3 -mx-3 hover:bg-white/5 transition-colors animate-row-in"
                                      style={{ animationDelay: `${Math.min(entryIndex, 8) * 35}ms` }}
                                    >
                                      <div>
                                        <h4 className="font-bold text-[#dae2fd]">{food.name}</h4>
                                        <p className="text-xs text-[#c2c6d0]/70 mt-0.5">
                                          {food.portion || '1 serving'}
                                        </p>
                                        <div className="flex gap-3 mt-1.5 text-xs font-semibold">
                                          <span className="text-[#d8b61c]">Cals: {Math.round(food.calories)}</span>
                                          <span className="text-[#5bb448]">P: {Math.round(food.protein)}g</span>
                                          <span className="text-[#bd5db8]">C: {Math.round(food.carbs)}g</span>
                                          <span className="text-[#fb7185]">F: {Math.round(food.fat)}g</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between w-full gap-3 sm:w-auto sm:justify-start">
                                        <div className="flex bg-[#171f33] p-1.5 rounded-xl gap-1">
                                          {[
                                            { label: '0.25x', value: 0.25 },
                                            { label: '0.5x', value: 0.5 },
                                            { label: '1x', value: 1.0 },
                                            { label: '1.5x', value: 1.5 },
                                            { label: '2x', value: 2 }
                                          ].map((opt) => {
                                            const currentVal = servings[food.recipe_id] ?? 1.0
                                            const isSelected = currentVal === opt.value
                                            return (
                                              <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() => setServings({ ...servings, [food.recipe_id]: opt.value })}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-90 ${isSelected
                                                  ? 'bg-[#d6b93a]/15 text-[#d6b93a]'
                                                  : 'text-[#c2c6d0] hover:text-[#dae2fd]'
                                                  }`}
                                              >
                                                {opt.label}
                                              </button>
                                            )
                                          })}
                                        </div>
                                        <button
                                          onClick={() => handleLogFood(food.recipe_id)}
                                          disabled={!!justLogged[food.recipe_id]}
                                          className={`flex min-w-[52px] items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-bold shadow-md transition-colors duration-300 active:scale-95 ${justLogged[food.recipe_id]
                                            ? 'bg-[#5bb448] text-white'
                                            : 'bg-[#d6b93a] text-[#6b5300] hover:brightness-105'
                                            }`}
                                        >
                                          {justLogged[food.recipe_id] ? (
                                            <Check size={14} strokeWidth={3} className="animate-check-pop" />
                                          ) : (
                                            'Log'
                                          )}
                                        </button>
                                      </div>
                                    </article>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PROGRESS TAB */
          <div className="space-y-6">
            <div className="rounded-2xl p-4 bg-[#141b2e] border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {showCalendar ? 'Past Rings Calendar' : 'Today'}
                  </h2>
                  <p
                    className={
                      showCalendar
                        ? 'text-xs text-[#c2c6d0]/70 mt-0.5'
                        : 'text-sm font-bold mt-0.5 text-[#c2c6d0]'
                    }
                  >
                    {showCalendar
                      ? 'Toggle metrics to analyze historical streaks'
                      : goalMode === 'recommended'
                        ? 'Recommended Target'
                        : 'Target Amount'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition active:scale-95 border ${showCalendar
                      ? 'bg-[#d6b93a]/15 text-[#d6b93a] border-[#d6b93a]/40'
                      : 'bg-white/5 text-[#c2c6d0] hover:bg-white/10 border-white/15'
                      }`}
                  >
                    <Calendar size={14} />
                    {showCalendar ? "View Today's Rings" : 'History Calendar'}
                  </button>

                  {/* Set Targets button now opens the SetTargetsModal */}
                  <button
                    onClick={() => setIsTargetsModalOpen(true)}
                    className="bg-gray-800 text-xs font-bold text-[#c2c6d0] hover:bg-gray-700 px-3 py-2 rounded-xl transition active:scale-95 border border-gray-700"
                  >
                    Set Targets
                  </button>
                </div>
              </div>

              {!showCalendar ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ProgressRing value={totals.calories} goal={goalCalories} strokeColor="#d8b61c" labelColor="#d8b61c" label="Calories" unit="kcal" />
                  <ProgressRing value={totals.protein} goal={goalProtein} strokeColor="#5bb448" labelColor="#5bb448" label="Protein" unit="g" />
                  <ProgressRing value={totals.carbs} goal={goalCarbs} strokeColor="#bd5db8" labelColor="#bd5db8" label="Carbs" unit="g" />
                  <ProgressRing value={totals.fat} goal={goalFat} strokeColor="#fb7185" labelColor="#fb7185" label="Fat" unit="g" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex bg-[#171f33] p-1.5 rounded-xl gap-1 overflow-x-auto">
                    {[
                      { key: 'calories', label: 'Calories', color: '#d8b61c', text: '#00325b' },
                      { key: 'protein', label: 'Protein', color: '#5bb448', text: '#102e10' },
                      { key: 'carbs', label: 'Carbs', color: '#bd5db8', text: '#612f5e' },
                      { key: 'fat', label: 'Fat', color: '#fb7185', text: '#4c0519' }
                    ].map((macro) => (
                      <button
                        key={macro.key}
                        type="button"
                        onClick={() => setCalendarMacro(macro.key as any)}
                        className="flex-1 py-1.5 px-3 text-xs font-black rounded-lg transition-all active:scale-95 whitespace-nowrap"
                        style={
                          calendarMacro === macro.key
                            ? { backgroundColor: macro.color, color: macro.text }
                            : { color: '#c2c6d0' }
                        }
                      >
                        {macro.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={goToPreviousMonth}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#c2c6d0] hover:text-[#dae2fd] transition active:scale-90"
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                      </button>

                      <p className="text-sm font-black text-[#dae2fd]">
                        {calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>

                      <button
                        type="button"
                        onClick={goToNextMonth}
                        disabled={isCurrentMonth}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#c2c6d0] hover:text-[#dae2fd] transition active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        aria-label="Next month"
                      >
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-extrabold text-[#c2c6d0]/70">
                      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {getCalendarDays().map((cell, index) => {
                        if (!cell.dayNum || !cell.dateString) {
                          return <div key={`empty-${index}`} className="aspect-square bg-white/5 rounded-xl" />
                        }

                        const dayStats = getHistoricalSumForDate(cell.dateString)

                        let actualVal = 0
                        let targetedGoal = 1
                        let ringColor = '#a1c9ff'
                        let unit = 'kcal'

                        if (calendarMacro === 'calories') {
                          actualVal = dayStats.calories; targetedGoal = goalCalories; ringColor = '#d8b61c'; unit = 'kcal'
                        } else if (calendarMacro === 'protein') {
                          actualVal = dayStats.protein; targetedGoal = goalProtein; ringColor = '#5bb448'; unit = 'g'
                        } else if (calendarMacro === 'carbs') {
                          actualVal = dayStats.carbs; targetedGoal = goalCarbs; ringColor = '#bd5db8'; unit = 'g'
                        } else if (calendarMacro === 'fat') {
                          actualVal = dayStats.fat; targetedGoal = goalFat; ringColor = '#fb7185'; unit = 'g'
                        }

                        return (
                          <div
                            key={cell.dateString}
                            className="aspect-square bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-between p-1.5 hover:bg-white/10 transition relative group"
                          >
                            <span className="text-xs font-black text-[#c2c6d0]">{cell.dayNum}</span>
                            <MiniProgressRing value={actualVal} goal={targetedGoal} strokeColor={ringColor} />
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#060e20] text-[#dae2fd] text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-md border border-white/10">
                              {Math.round(actualVal)} / {targetedGoal} {unit}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Meal history */}
            <div className="rounded-2xl p-5 bg-[#141b2e] border border-white/10">
              <h2 className="text-lg font-bold tracking-tight mb-4">Everything Logged Today</h2>

              {loggedMeals.length === 0 ? (
                <div className="py-12 text-center text-[#c2c6d0] font-medium">
                  You haven't logged any foods today yet. Go back to Log Menu to add meals!
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {loggedMeals.map((log) => {
                    const swipeOffset = justDeleted[log.id]
                      ? -400
                      : (isSwipeDragging === log.id ? swipeDragOffset : 0)
                    return (
                    <div key={log.id} className="relative overflow-hidden rounded-xl">
                      {/* Single delete surface, revealed as the row is swiped left */}
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        disabled={!!justDeleted[log.id]}
                        aria-label="Delete this log entry"
                        className="absolute inset-0 flex items-center justify-end pr-6 bg-[#ffb4ab] text-[#5c1a13]"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div
                        onPointerDown={(e) => handleSwipePointerDown(log.id, e)}
                        style={{
                          transform: `translateX(${swipeOffset}px)`,
                          opacity: justDeleted[log.id] ? 0 : 1,
                          transition: isSwipeDragging === log.id ? 'none' : 'transform 0.25s ease-out, opacity 0.2s ease-out',
                        }}
                        className="relative bg-[#141b2e] py-4 flex items-center gap-4 touch-pan-y"
                      >
                        <div>
                          <h4 className="font-bold text-[#dae2fd]">{log.food_items?.name}</h4>
                          <p className="text-xs text-[#c2c6d0]/70 mt-0.5">
                            {log.dining_hall} • <span className="capitalize">{log.meal_type}</span> • {log.servings} serving{log.servings !== 1 ? 's' : ''}
                          </p>
                          <div className="flex gap-2 mt-1 text-xs text-[#c2c6d0]">
                            <span>Cals: {Math.round((log.food_items?.calories || 0) * log.servings)}</span>
                            <span>P: {Math.round((log.food_items?.protein || 0) * log.servings)}g</span>
                            <span>C: {Math.round((log.food_items?.carbs || 0) * log.servings)}g</span>
                            <span>F: {Math.round((log.food_items?.fat || 0) * log.servings)}g</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </main>

      {/* Sticky bottom nav */}
      <div className="app-bottom-nav fixed bottom-0 left-0 right-0 bg-[#0b1326]/70 backdrop-blur-2xl border-t border-white/15 shadow-2xl py-3 px-6 z-50">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => {
              setActiveTab('log')
              Haptics.selectionChanged().catch(() => {})
            }}
            className={`flex flex-col items-center gap-1 py-1.5 px-7 rounded-xl transition-all active:scale-90 ${activeTab === 'log' ? 'text-[#ffe6ab] scale-105' : 'text-[#c2c6d0]/70 hover:text-[#dae2fd]'
              }`}
          >
            <UtensilsCrossed size={22} strokeWidth={activeTab === 'log' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Log Menu</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('progress')
              Haptics.selectionChanged().catch(() => {})
            }}
            className={`flex flex-col items-center gap-1 py-1.5 px-7 rounded-xl transition-all active:scale-90 ${activeTab === 'progress' ? 'text-[#ffe6ab] scale-105' : 'text-[#c2c6d0]/70 hover:text-[#dae2fd]'
              }`}
          >
            <LineChart size={22} strokeWidth={activeTab === 'progress' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Progress</span>
          </button>
        </div>
      </div>

      {/* Set Targets Modal */}
      {isTargetsModalOpen && (
        <SetTargetsModal
          currentTargets={{
            calories: goalCalories,
            protein: goalProtein,
            carbs: goalCarbs,
            fat: goalFat,
          }}
          onClose={() => setIsTargetsModalOpen(false)}
          onSave={handleSaveGoals}
        />
      )}

      {/* Edit User Profile Modal */}
      {isProfileModalOpen && (
        <UserProfileModal
          currentProfile={userProfile}
          onClose={async () => {
            setIsProfileModalOpen(false)
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: profileRow } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('user_id', user.id)
                .maybeSingle()
              setUserProfile((prev) => ({
                ...prev,
                avatarUrl: profileRow?.avatar_url || (user.user_metadata?.avatar_url as string) || null,
              }))
            }
          }}
          onSave={handleSaveProfile}
        />
      )}

      {/* One-time welcome card for first-time users */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
        >
          <div className="absolute inset-0 bg-[#060e20]/70 backdrop-blur-sm" onClick={dismissWelcome} />
          <div className="relative w-full max-w-sm rounded-2xl p-6 bg-[#171f33] border border-white/10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] text-[#dae2fd]">
            <h2 id="welcome-title" className="text-lg font-bold tracking-tight text-[#dae2fd] mb-3">
              Welcome to Sammy's Palate
            </h2>
            <ul className="space-y-2.5 text-sm text-[#c2c6d0] mb-5">
              <li>Browse today's menu, filter by station, and tap + to log what you eat.</li>
              <li>Watch your calories, protein, carbs, and fat fill in below as you log.</li>
              <li>Drag the slug (or tap a letter) to preview a different meal's menu.</li>
            </ul>
            <button
              type="button"
              onClick={dismissWelcome}
              className="w-full py-2.5 rounded-lg bg-[#d6b93a] text-[#6b5300] text-sm font-bold active:scale-95 transition-transform"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}