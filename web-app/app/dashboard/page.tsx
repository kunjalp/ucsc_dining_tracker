'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import WelcomeCard from './WelcomeCard'
import SetTargetsModal, { DailyTargets } from './SetTargetsModal'
import UserProfileModal, { UserProfile } from './UserProfileModal'
import { getHallOpenStatus, getHallStatusForDate, getMealCountdown, formatCountdown, getDayTrack, getNextOpening, type DayTrack } from '@/lib/diningHours'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { classifyByName } from '@/lib/stationClassifier'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { suggestCombos, comboTotals, activeFocus, MACRO_KEYS, DEFAULT_FOCUS, SUGGESTION_SERVING_STEP, SUGGESTION_MIN_SERVINGS, SUGGESTION_MAX_SERVINGS, type ComboItem, type Macros, type MacroKey } from '@/lib/mealSuggestions'
import { DEFAULT_TEXT_SIZE, getLocalTextSize, isTextSize, setLocalTextSize } from '@/lib/textSize'
import { getLocalMascotAnimations, setLocalMascotAnimations } from '@/lib/mascotPrefs'
import { getCoffeeShopMenu, getCoffeeShopMealTypes, isHardcodedCoffeeShop } from '@/lib/coffeeMenuItems'
import BottomSheet, { SheetCloseButton } from '../components/BottomSheet'
import Sammy, { type SammyMood } from '../components/Sammy'
import { Toast, ToastStack, useToastPresence, useToasts } from '../components/Toast'

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
  Plus,
  X,
  SlidersHorizontal,
  Minus,
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
  ingredients?: string | null
  allergens?: string | null
  dietary_tags?: string[] | null
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

// Serving multipliers offered on each menu row and in the food detail sheet
const SERVING_OPTIONS = [0.25, 0.5, 1, 1.5, 2]

// How many days ahead the app lets students browse. scrape_upcoming.py
// actually scrapes one extra day beyond this (DAYS_AHEAD = 3) on purpose —
// that buffer day means the furthest day shown here already has data
// cached from the PREVIOUS day's scrape, so it's never empty overnight
// while waiting for today's run.
const DAY_OFFSETS = [0, 1, 2]

// Order of the meal groups in Progress > Everything Logged Today. Anything
// else logged (Brunch, a cafe's "Menu"/"ALL") sorts after these.
const LOG_MEAL_ORDER = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night']

// Corner Sammy's one-shot moods: a higher number can't be interrupted by a lower one
const CORNER_PRIORITY: Partial<Record<SammyMood, number>> = { celebrate: 3, oops: 2, munch: 1, happy: 1 }
// Sparkle colors when a ring closes (hex, since they're SVG fills)
const RING_SPARKLE_COLORS = { cal: '#d8b61c', protein: '#5bb448', carbs: '#d17ccd', fat: '#fb7185' } as const

// "Close my rings" macro chips: saved selection key + chip labels
const SUGGEST_FOCUS_STORAGE_KEY = 'ucsc_suggest_focus'
const MACRO_CHIP_LABELS: Record<MacroKey, string> = { calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' }

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
    <g className="text-gold">
      <circle cx="0" cy="0" r="3.4" fill="currentColor" stroke="#3f7fb0" strokeWidth="1.2" />
      <line x1="-2" y1="-2.5" x2="-4" y2="-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="1" y1="-3" x2="0.3" y2="-6.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="-4.5" cy="-6.6" r="1.5" fill="currentColor" />
      <circle cx="0" cy="-7.1" r="1.5" fill="currentColor" />
    </g>
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
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to) return
    // Reduce Motion: no easing -- the hook returns target directly (below)
    if (reduceMotion) {
      fromRef.current = to
      return
    }

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
  }, [target, duration, reduceMotion])

  return reduceMotion ? target : display
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
  // What logging the row's picked serving would add -- shown as "+N" and a
  // faded bar extension while a serving pill was just tapped
  preview: number
  // false until today's logs have loaded -- shows "–" instead of a fake 0
  loaded: boolean
}

function MacroBarItem({ label, value, goal, color, unit, bordered, preview, loaded }: MacroBarItemProps) {
  const animatedValue = useCountUp(value)
  const pctOf = (v: number) => `${Math.min((v / Math.max(goal, 1)) * 100, 100)}%`

  return (
    <div className={`flex-1 min-w-0 ${bordered ? 'border-l border-white/10 pl-4' : ''}`}>
      <p className="text-10 font-semibold text-fg-muted truncate">{label}</p>
      <p className="text-sm font-black mt-0.5 leading-tight tabular-nums" style={{ color }}>
        {loaded ? `${Math.round(animatedValue)}${unit}` : '–'}
      </p>
      {preview > 0 ? (
        <p className="text-11 font-bold leading-tight tabular-nums truncate" style={{ color }}>
          +{Math.round(preview)}{unit}
        </p>
      ) : (
        <p className="text-11 font-semibold text-fg-muted leading-tight tabular-nums">
          / {Math.round(goal)}{unit}
        </p>
      )}
      <div className="relative h-1 rounded-full bg-white/10 mt-1.5 overflow-hidden">
        {preview > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-40 transition-all motion-reduce:transition-none"
            style={{ width: pctOf(value + preview), backgroundColor: color }}
          />
        )}
        <div
          className="relative h-full rounded-full transition-all motion-reduce:transition-none"
          style={{ width: pctOf(animatedValue), backgroundColor: color }}
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
  loaded: boolean // false until today's logs have loaded -- shows "–", not 0
}

function ProgressRing({ value, goal, strokeColor, labelColor, label, unit, loaded }: ProgressRingProps) {
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
          {/* stroke via style, not the attribute -- SVG presentation
              attributes don't resolve var(--color-*) tokens */}
          <circle
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ stroke: strokeColor, strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-500 ease-out motion-reduce:transition-none"
          />
        </svg>

        <div className="absolute text-center">
          <span className="text-base font-black tracking-tight text-fg">
            {!loaded ? '–' : `${goal > 0 ? Math.round((animatedValue / goal) * 100) : 0}%`}
          </span>
        </div>
      </div>

      <div className="text-center mt-2">
        <p className="text-sm font-black" style={{ color: labelColor }}>{label}</p>
        <p className="text-xs text-fg-subtle font-semibold mt-0.5">
          {loaded ? Math.round(animatedValue) : '–'} / {goal} {unit}
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
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{ stroke: strokeColor, strokeDashoffset }}
        strokeLinecap="round"
        fill="transparent"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="transition-all duration-300 motion-reduce:transition-none"
      />
    </svg>
  )
}

// Undo window for the delete the undo toast is showing, pausable while a
// finger is on the toast: when it (re)started and how long it had left then.
// Plain functions out here because the clock reads Date.now().
type UndoClock = { id: string; startedAt: number; remaining: number; held: boolean }
const startUndoClock = (id: string, ms: number): UndoClock => ({ id, startedAt: Date.now(), remaining: ms, held: false })
const pauseUndoClock = (clock: UndoClock) => {
  clock.held = true
  clock.remaining -= Date.now() - clock.startedAt
}
// Returns how long the delete should now wait
const resumeUndoClock = (clock: UndoClock, minMs: number) => {
  clock.held = false
  clock.startedAt = Date.now()
  clock.remaining = Math.max(clock.remaining, minMs)
  return clock.remaining
}

export default function DashboardPage() {
  const supabase = createClient()
  const reduceMotion = useReducedMotion()
  const [activeTab, setActiveTab] = useState<'log' | 'progress'>('log')
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuEntry[]>([])
  const [selectedHall, setSelectedHall] = useState(DINING_HALLS[0])
  const [selectedMeal, setSelectedMeal] = useState(() => getCurrentMealPeriodLabel(DINING_HALLS[0]) || 'Breakfast')
  const [selectedDayOffset, setSelectedDayOffset] = useState(0) // 0 = Today, 1 = Tomorrow, ... see DAY_OFFSETS
  const [availableMealTypes, setAvailableMealTypes] = useState<string[]>(['Breakfast', 'Lunch', 'Dinner'])
  const [hallStatus, setHallStatus] = useState<HallStatus | null>(null)
  // Serving multiplier per menu row (pills under each item); defaults to 1x
  const [servings, setServings] = useState<{ [key: string]: number }>({})
  // Serving multiplier in the food detail sheet (opens at the row's current pick)
  const [detailServings, setDetailServings] = useState(1)
  // The row whose serving pill was just tapped -- previewed in the totals
  // strip at the top as "+N" until it's logged or SERVING_PREVIEW_MS passes.
  const SERVING_PREVIEW_MS = 5000
  const [servingPreview, setServingPreview] = useState<{ food: FoodItem; servings: number } | null>(null)
  const servingPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showServingPreview = (food: FoodItem, count: number) => {
    setServingPreview({ food, servings: count })
    if (servingPreviewTimerRef.current) clearTimeout(servingPreviewTimerRef.current)
    servingPreviewTimerRef.current = setTimeout(() => setServingPreview(null), SERVING_PREVIEW_MS)
  }
  const clearServingPreview = () => {
    if (servingPreviewTimerRef.current) clearTimeout(servingPreviewTimerRef.current)
    setServingPreview(null)
  }
  // Briefly shows a checkmark on a food's Log button right after it's logged
  const [justLogged, setJustLogged] = useState<{ [key: string]: boolean }>({})
  // Briefly shows a checkmark on a Delete button right after it's deleted, before the row disappears
  const [justDeleted, setJustDeleted] = useState<{ [key: string]: boolean }>({})
  // Undo for deleted meal logs: rows are hidden immediately, the DB delete
  // runs after UNDO_WINDOW_MS unless "Undo" is tapped first.
  const UNDO_WINDOW_MS = 5000
  const [hiddenLogIds, setHiddenLogIds] = useState<string[]>([])
  const [undoLog, setUndoLog] = useState<MealLog | null>(null)
  // Keeps the undo toast mounted while it animates out after undoLog clears
  const undoToast = useToastPresence(undoLog)
  const pendingDeleteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const undoClockRef = useRef<UndoClock | null>(null)
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
  const [isStationSheetOpen, setIsStationSheetOpen] = useState(false)
  // "Close my rings": whether the student has ever saved targets (until
  // then the 2000/120/250/70 placeholders aren't theirs to aim at), the
  // open suggestions sheet's editable combos, and which combo is logging.
  const [targetsSaved, setTargetsSaved] = useState(false)
  // Which rings the suggestions try to close (sheet's macro chips)
  // Read straight from storage on the client: the chips only render once the
  // sheet is opened, so this can't cause a hydration mismatch.
  const [suggestFocus, setSuggestFocus] = useState<MacroKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_FOCUS
    try {
      const saved = JSON.parse(localStorage.getItem(SUGGEST_FOCUS_STORAGE_KEY) ?? 'null')
      if (Array.isArray(saved)) {
        const valid = MACRO_KEYS.filter((k) => saved.includes(k))
        if (valid.length > 0) return valid
      }
    } catch {
      // Unavailable or corrupt storage -- keep the defaults
    }
    return DEFAULT_FOCUS
  })
  const [suggestionCombos, setSuggestionCombos] = useState<ComboItem[][] | null>(null)
  const [loggingComboIndex, setLoggingComboIndex] = useState<number | null>(null)
  // "Show" on the dietary chip: lists everything for this session only --
  // the saved profile's preferences are left untouched.
  const [dietFilterOff, setDietFilterOff] = useState(false)

  // Daily targets state settings (now tracking all 4 macro targets)
  const [goalCalories, setGoalCalories] = useState(2000)
  const [goalProtein, setGoalProtein] = useState(120)
  const [goalCarbs, setGoalCarbs] = useState(250)
  const [goalFat, setGoalFat] = useState(70)
  // In-app toasts (ring closed, errors) -- replaces alert(); see ToastStack
  const { toasts, showToast, dismissToast, removeToast, holdToast } = useToasts()

  // Sammy perched on the bottom nav. One-shot moods play through a single
  // queue: a new request replaces what's playing unless something more
  // important is mid-way (celebrate > oops > munch/happy), so animations
  // never stack. When the queue empties he goes back to resting (asleep
  // while the hall is closed). `key` replays a mood that fires twice.
  const [cornerPlay, setCornerPlay] = useState<{ mood: SammyMood; key: number; colors?: string[] } | null>(null)
  const cornerQueueRef = useRef<{ priority: number; timers: ReturnType<typeof setTimeout>[] }>({ priority: 0, timers: [] })
  const playCorner = (steps: { mood: SammyMood; ms: number; colors?: string[] }[]) => {
    const priority = Math.max(...steps.map((s) => CORNER_PRIORITY[s.mood] ?? 0))
    const queue = cornerQueueRef.current
    if (queue.priority > priority) return
    queue.timers.forEach(clearTimeout)
    queue.timers = []
    queue.priority = priority
    let at = 0
    for (const step of steps) {
      queue.timers.push(setTimeout(() => setCornerPlay((c) => ({ mood: step.mood, key: (c?.key ?? 0) + 1, colors: step.colors })), at))
      at += step.ms
    }
    queue.timers.push(setTimeout(() => {
      queue.priority = 0
      setCornerPlay(null)
    }, at))
  }
  useEffect(() => {
    const queue = cornerQueueRef.current
    return () => queue.timers.forEach(clearTimeout)
  }, [])

  // Error toasts make Sammy worried (Toast ids only ever increase)
  const lastToastIdRef = useRef(0)
  useEffect(() => {
    const newest = toasts[toasts.length - 1]
    if (!newest || newest.id <= lastToastIdRef.current) return
    lastToastIdRef.current = newest.id
    if (newest.tone === 'error') playCorner([{ mood: 'oops', ms: 1000 }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts])
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false)
  // Food detail sheet -- tapping an item's name opens it with that item's
  // ingredients/allergens/dietary icons (closed = null).
  const [detailFood, setDetailFood] = useState<FoodItem | null>(null)

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
    textSize: DEFAULT_TEXT_SIZE,
    mascotAnimations: true,
  })

  // Calendar View State
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMacro, setCalendarMacro] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories')
  const [historicalLogs, setHistoricalLogs] = useState<MealLog[]>([])
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())

  // Daily logs and totals tracking state
  const [loggedMeals, setLoggedMeals] = useState<MealLog[]>([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  // False until the first fetchTodayTotals finishes -- the strip and rings show "–" until then
  const [totalsLoaded, setTotalsLoaded] = useState(false)

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

  // The gold fill's glow pulses twice whenever the fill moves (the minute
  // tick, a hall or day switch), then rests at its normal glow. Same gold,
  // only the blur widens. Reduce Motion: no pulse.
  const dayTrackGlowRef = useRef<SVGPathElement | null>(null)
  useEffect(() => {
    const el = dayTrackGlowRef.current
    if (!el || reduceMotion) return
    const rest = 'drop-shadow(0 0 3px rgba(214,185,58,0.85))'
    const peak = 'drop-shadow(0 0 8px rgba(214,185,58,0.85))'
    const pulse = el.animate([{ filter: rest }, { filter: peak }, { filter: rest }], {
      duration: 1500,
      iterations: 2,
      easing: 'ease-in-out',
    })
    return () => pulse.cancel()
  }, [dayTrack?.markerPct, reduceMotion])
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
  useEffect(() => {
    // The placeholder zeros before the first fetch aren't a real baseline
    if (!totalsLoaded) return
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
      showToast(message, 'success')
      // Sparkles in the closed ring(s)' own colors
      const colors = ringLabels.filter(({ key }) => closed[key] && !prev[key]).map(({ key }) => RING_SPARKLE_COLORS[key])
      playCorner([{ mood: 'celebrate', ms: 1300, colors }])
    }

    prevRingsClosedRef.current = closed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals, totalsLoaded, goalCalories, goalProtein, goalCarbs, goalFat])

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

  // A preview for a row that's no longer on screen would be misleading
  useEffect(() => {
    clearServingPreview()
  }, [selectedHall, selectedMeal, selectedDayOffset])

  // Saving new dietary preferences turns the filter back on
  useEffect(() => {
    setDietFilterOff(false)
  }, [userProfile.dietaryPreferences])

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

        // The account's saved Text size wins (it may have been changed on
        // another device); fall back to whatever this device last used.
        const savedTextSize = user.user_metadata?.text_size
        const textSize = isTextSize(savedTextSize) ? savedTextSize : getLocalTextSize()
        setLocalTextSize(textSize)
        // Same for Mascot animations: the account's choice wins, else this device's
        const savedMascot = user.user_metadata?.mascot_animations
        const mascotAnimations = typeof savedMascot === 'boolean' ? savedMascot : getLocalMascotAnimations()
        setLocalMascotAnimations(mascotAnimations)

        setUserProfile({
          nickname: (user.user_metadata?.nickname as string) || '',
          email: user.email || '',
          avatarUrl: profileRow?.avatar_url || (user.user_metadata?.avatar_url as string) || null,
          memberSince: user.created_at || null,
          dietaryPreferences: (user.user_metadata?.dietary_preferences as string[]) || [],
          textSize,
          mascotAnimations,
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
    setTargetsSaved(!!savedCals)
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
    setTargetsSaved(true)

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
          recipe_id, name, portion, calories, protein, carbs, sugar, fat,
          ingredients, allergens, dietary_tags
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

  // Neutral closed card text: "Closed today · Opens tomorrow 7 AM", from the
  // hall's real published hours. A gap between two windows today reads
  // "Closed now · Opens 4:30 PM".
  const nextOpening = useMemo(
    () => (isClosedNow ? getNextOpening(selectedHall, now, selectedDayOffset) : null),
    [isClosedNow, selectedHall, now, selectedDayOffset]
  )
  const closedLabel = selectedDayOffset === 0
    ? (nextOpening?.dayOffset === 0 ? 'Closed now' : 'Closed today')
    : `Closed ${getDayOffsetLabel(selectedDayOffset)}`
  const nextOpeningLabel = nextOpening
    ? nextOpening.dayOffset === 0
      ? `Opens ${nextOpening.time}`
      : nextOpening.dayOffset === 1
        ? `Opens tomorrow ${nextOpening.time}`
        : `Opens ${getDayOffsetLabel(nextOpening.dayOffset)} ${nextOpening.time}`
    : null

  // 2. Extract unique stations dynamically from raw menu data
  const availableStations = useMemo(() => {
    const stations = menu.map((entry) => getEffectiveStation(entry))
    const unique = Array.from(new Set(stations))
    return unique.sort((a, b) => getStationSortIndex(a) - getStationSortIndex(b))
  }, [menu])

  // Allergen avoidance: the exact words UCSC lists on each item's real
  // ALLERGENS line (e.g. "Wheat, Soy, Gluten, Sesame, Alcohol"). Selecting
  // one excludes any item whose allergens text mentions it. Word-boundary
  // matched so 'Fish' never matches inside 'Shellfish'.
  const ALLERGEN_PATTERNS: Record<string, RegExp> = {
    Milk: /\bmilk\b|dairy/i,
    Egg: /\beggs?\b/i,
    Wheat: /\bwheat\b/i,
    Gluten: /\bgluten\b/i,
    Soy: /\bsoy\b/i,
    Sesame: /\bsesame\b/i,
    Peanut: /\bpeanuts?\b/i,
    'Tree Nut': /\btree nuts?\b/i,
    Fish: /\bfish\b/i,
    Shellfish: /\bshellfish\b/i,
  }

  // Dietary-preference matching, grounded only in real data UCSC publishes
  // on each item's nutrition label (dietary icon list for diet type,
  // allergens text for allergen avoidance) -- never a guess from the
  // item's name. An item that hasn't been scraped for label data yet
  // (dietary_tags/allergens still null) fails every check rather than
  // being assumed safe, since a false "this has no milk" is worse than
  // an item temporarily missing from the list.
  const foodMatchesDietaryPreference = (food: FoodItem, pref: string): boolean => {
    switch (pref) {
      case 'Vegetarian':
        return !!food.dietary_tags?.some((t) => /vegetarian|vegan/i.test(t))
      case 'Vegan':
        return !!food.dietary_tags?.some((t) => /vegan/i.test(t))
      default: {
        const pattern = ALLERGEN_PATTERNS[pref]
        if (!pattern) return true
        return food.allergens != null && !pattern.test(food.allergens)
      }
    }
  }
  // An allergen chip / dietary tag that matches one of the allergens the
  // student avoids. "Gluten Friendly"-style tags are positives, never a match.
  const isAvoidedAllergen = (text: string): boolean => {
    if (/friendly|free/i.test(text)) return false
    return userProfile.dietaryPreferences.some((pref) => ALLERGEN_PATTERNS[pref]?.test(text))
  }

  // Dietary tags get distinct colors by kind instead of one shared green
  const dietaryTagClass = (tag: string): string => {
    if (isAvoidedAllergen(tag)) return 'bg-danger/15 text-danger border-danger/50'
    if (/vegan/i.test(tag)) return 'bg-macro-protein/15 text-macro-protein border-macro-protein/30'
    if (/vegetarian/i.test(tag)) return 'bg-veg/10 text-veg border-veg/30'
    if (/gluten/i.test(tag)) return 'bg-sky/10 text-sky border-sky/30'
    if (/halal|kosher/i.test(tag)) return 'bg-gold/10 text-gold border-gold/30'
    if (/pork|beef|meat|chicken|fish|shellfish/i.test(tag)) return 'bg-macro-fat/10 text-macro-fat border-macro-fat/30'
    if (/alcohol/i.test(tag)) return 'bg-macro-carbs/10 text-macro-carbs border-macro-carbs/30'
    return 'bg-white/5 text-fg border-white/15'
  }

  // Chip label for the saved preferences: "Vegan · Milk-free · Soy-free"
  const dietChipLabel = userProfile.dietaryPreferences
    .map((pref) => (ALLERGEN_PATTERNS[pref] ? `${pref}-free` : pref))
    .join(' · ')

  // 3. Filter raw items first by search input & clicked station pills.
  // dietHiddenCount is how many items the dietary filter removes (or would
  // remove, while it's switched off for the session) on top of the others.
  const { filteredMenu, dietHiddenCount } = useMemo(() => {
    let hidden = 0
    const list = menu.filter((entry) => {
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
      if (!matchesSearch || !matchesStation) return false

      const matchesDiet = userProfile.dietaryPreferences.every((pref) =>
        foodMatchesDietaryPreference(food, pref)
      )
      if (!matchesDiet) {
        hidden++
        return dietFilterOff
      }
      return true
    })
    return { filteredMenu: list, dietHiddenCount: hidden }
  }, [menu, searchQuery, activeStationFilters, userProfile.dietaryPreferences, dietFilterOff])

  // The filter row (diet chip, Stations button, selected stations) only
  // becomes a sideways scroller when its chips are actually wider than the
  // screen -- otherwise it has no overflow at all and can't be dragged in any
  // direction. Re-measured when its chips change or resize (Text size setting,
  // rotation).
  const filterRowRef = useRef<HTMLDivElement | null>(null)
  const [filterRowOverflows, setFilterRowOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = filterRowRef.current
    if (!el) return
    const measure = () => setFilterRowOverflows(el.scrollWidth > el.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    Array.from(el.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [activeStationFilters, dietHiddenCount, dietFilterOff, dietChipLabel, availableStations.length, showMenuSection])

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
    if (!user) {
      setTotalsLoaded(true) // signed out: the zeros are real
      return
    }

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

    // On error the strip keeps showing "–" rather than claiming 0 eaten
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
      setTotalsLoaded(true)
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
  // `count` is the serving multiplier: the menu row's + logs 1x, the food
  // detail sheet passes whatever the student picked there.
  // Resolves true once the log is saved, so callers (the detail sheet) can close.
  const handleLogFood = async (foodId: string, count: number = 1): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Please sign in to log food.', 'error')
      return false
    }

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
      showToast(`Couldn't log that: ${error.message}`, 'error')
      return false
    } else {
      // Quick, light confirmation tap — this is a frequent, low-stakes action.
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
      clearServingPreview()
      // Munch first, then the happy hop
      playCorner([{ mood: 'munch', ms: 900 }, { mood: 'happy', ms: 600 }])
      setJustLogged(prev => ({ ...prev, [foodId]: true }))
      setTimeout(() => {
        setJustLogged(prev => {
          const next = { ...prev }
          delete next[foodId]
          return next
        })
      }, 1400)
      fetchTodayTotals()
      return true
    }
  }

  // Swipe-to-delete on a meal history row: drag left past SWIPE_DELETE_THRESHOLD
  // and releasing removes the row (same undo window as the trash button).
  // SWIPE_MAX_DRAG caps how far the row can travel so the red
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

  // 8. Delete a logged meal -- with an undo window. The row disappears (and
  // drops out of the totals) right away, but the actual DB delete waits
  // UNDO_WINDOW_MS so an accidental swipe/tap can be taken back.
  const handleDeleteLog = (logId: string) => {
    if (pendingDeleteTimersRef.current.has(logId)) return
    const log = loggedMeals.find((l) => l.id === logId)

    // Firmer tap than logging — deleting is the more deliberate, less
    // frequent action, so it gets a touch more weight.
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
    // justDeleted slides the row out; hiddenLogIds keeps it out of the list
    // and totals until the delete commits (or is undone).
    setJustDeleted(prev => ({ ...prev, [logId]: true }))
    setHiddenLogIds(prev => [...prev, logId])
    setTimeout(() => {
      setJustDeleted(prev => {
        const next = { ...prev }
        delete next[logId]
        return next
      })
    }, 300)
    if (log) setUndoLog(log)
    playCorner([{ mood: 'oops', ms: 1000 }])

    pendingDeleteTimersRef.current.set(logId, setTimeout(() => commitDeleteLog(logId), UNDO_WINDOW_MS))
    undoClockRef.current = startUndoClock(logId, UNDO_WINDOW_MS)
  }

  // Finger on the undo toast: the delete waits until it lets go, then gets
  // whatever was left of the window (at least UNDO_RESUME_MS)
  const UNDO_RESUME_MS = 1500
  const holdUndo = (held: boolean) => {
    const clock = undoClockRef.current
    if (!clock || clock.held === held) return
    const timers = pendingDeleteTimersRef.current
    const timer = timers.get(clock.id)
    if (timer === undefined) return // already committed or undone
    clearTimeout(timer)
    if (held) {
      pauseUndoClock(clock)
      return
    }
    const logId = clock.id
    timers.set(logId, setTimeout(() => commitDeleteLog(logId), resumeUndoClock(clock, UNDO_RESUME_MS)))
  }

  const commitDeleteLog = async (logId: string) => {
    pendingDeleteTimersRef.current.delete(logId)
    setUndoLog(cur => (cur?.id === logId ? null : cur))

    const { error } = await supabase
      .from('meal_logs')
      .delete()
      .eq('id', logId)

    if (error) {
      showToast(`Couldn't remove that entry: ${error.message}`, 'error')
    } else {
      await fetchTodayTotals()
      fetchHistoricalLogs() // keep the calendar in sync if it's open
    }
    setHiddenLogIds(prev => prev.filter(id => id !== logId))
  }

  const handleUndoDelete = () => {
    if (!undoLog) return
    const logId = undoLog.id
    const timer = pendingDeleteTimersRef.current.get(logId)
    if (timer) clearTimeout(timer)
    pendingDeleteTimersRef.current.delete(logId)
    setHiddenLogIds(prev => prev.filter(id => id !== logId))
    setJustDeleted(prev => {
      const next = { ...prev }
      delete next[logId]
      return next
    })
    setUndoLog(null)
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  }

  // Leaving the dashboard mid-undo-window still commits the delete the
  // student asked for, rather than silently dropping it.
  useEffect(() => {
    const timers = pendingDeleteTimersRef.current
    return () => {
      timers.forEach((timer, logId) => {
        clearTimeout(timer)
        supabase.from('meal_logs').delete().eq('id', logId).then(() => {})
      })
      timers.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Totals with pending (undo-able) deletes already subtracted, so the
  // strip and rings react the moment a row is removed.
  const displayTotals = useMemo(() => {
    if (hiddenLogIds.length === 0) return totals
    return loggedMeals
      .filter((log) => !hiddenLogIds.includes(log.id))
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
  }, [totals, loggedMeals, hiddenLogIds])

  // "Close my rings": targets minus the same totals the strip/rings show
  // (pending undo-able deletes already subtracted)
  const remainingMacros: Macros = {
    calories: goalCalories - displayTotals.calories,
    protein: goalProtein - displayTotals.protein,
    carbs: goalCarbs - displayTotals.carbs,
    fat: goalFat - displayTotals.fat,
  }
  const allRingsClosed = (['calories', 'protein', 'carbs', 'fat'] as const).every((k) => remainingMacros[k] <= 0)
  // Under ~50 cal left there's nothing worth suggesting without going over
  const caloriesClosed = remainingMacros.calories < 50

  // What Sammy says when tapped: a short line from today's real totals vs
  // targets (progress only -- no health claims). Taps cycle through the
  // lines that apply right now.
  const sammyTapCountRef = useRef(0)
  const sammyTapMessage = (): string => {
    if (!totalsLoaded) return "Hi, I'm Sammy!"
    if (allRingsClosed) return 'All rings closed!'
    if (displayTotals.calories <= 0) return 'Nothing logged yet today. Ready when you are!'
    const pct = (value: number, goal: number) => (goal > 0 ? Math.round((value / goal) * 100) : 0)
    const rings = [
      { name: 'Calories', pct: pct(displayTotals.calories, goalCalories) },
      { name: 'Protein', pct: pct(displayTotals.protein, goalProtein) },
      { name: 'Carbs', pct: pct(displayTotals.carbs, goalCarbs) },
      { name: 'Fat', pct: pct(displayTotals.fat, goalFat) },
    ]
    const lines: string[] = []
    const closedNow = rings.filter((r) => r.pct >= 100).map((r) => r.name)
    if (closedNow.length > 0) lines.push(`${closedNow.join(' & ')} ${closedNow.length === 1 ? 'ring' : 'rings'} closed!`)
    const protein = rings[1]
    if (protein.pct < 100) lines.push(`Protein is at ${protein.pct}%!`)
    if (rings[0].pct < 25) lines.push(`Nice start! Calories are at ${rings[0].pct}%.`)
    if (remainingMacros.calories > 0) lines.push(`${Math.round(remainingMacros.calories)} cal left today.`)
    const closest = rings.filter((r) => r.pct < 100).sort((a, b) => b.pct - a.pct)[0]
    if (closest && closest.pct >= 50) lines.push(`${closest.name} is ${closest.pct}% there!`)
    return lines[sammyTapCountRef.current++ % lines.length] ?? 'Keep going!'
  }

  // (Re)builds the suggestion combos for the given rings to close. Toggling
  // a macro chip calls this again, which replaces any edits in the sheet.
  const computeSuggestions = (focus: MacroKey[]) => {
    // Only what's on screen: filteredMenu already applies the dietary,
    // allergen, station and search filters (and drops 0-nutrition rows)
    const candidates = filteredMenu.map((entry) => ({
      recipe_id: entry.food_items.recipe_id,
      name: entry.food_items.name,
      portion: entry.food_items.portion,
      station: cleanStationName(getEffectiveStation(entry)),
      calories: Number(entry.food_items.calories),
      protein: Number(entry.food_items.protein),
      carbs: Number(entry.food_items.carbs),
      fat: Number(entry.food_items.fat),
    }))
    setSuggestionCombos(suggestCombos(candidates, remainingMacros, focus).map((combo) => combo.items))
  }

  // Sammy "thinks" for a beat while suggestions are built (the search itself
  // takes ~70ms -- the pause just lets the think animation read). Closing
  // the sheet cancels a pending run so it can't reopen it.
  const [suggestionsThinking, setSuggestionsThinking] = useState(false)
  const thinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runSuggestions = (focus: MacroKey[], thinkMs: number) => {
    if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current)
    setSuggestionsThinking(true)
    setSuggestionCombos((prev) => prev ?? [])
    thinkTimerRef.current = setTimeout(() => {
      thinkTimerRef.current = null
      computeSuggestions(focus)
      setSuggestionsThinking(false)
    }, thinkMs)
  }
  const closeSuggestions = () => {
    if (thinkTimerRef.current) clearTimeout(thinkTimerRef.current)
    thinkTimerRef.current = null
    setSuggestionsThinking(false)
    setSuggestionCombos(null)
  }

  const openSuggestions = () => {
    runSuggestions(suggestFocus, 450)
    Haptics.selectionChanged().catch(() => {})
  }

  // Macro chips at the top of the sheet. The last chip that's on can't be
  // turned off. Saved per device; storage failures just skip saving.
  const toggleSuggestFocus = (macro: MacroKey) => {
    const isOn = suggestFocus.includes(macro)
    if (isOn && suggestFocus.length === 1) return
    const next = MACRO_KEYS.filter((k) => (k === macro ? !isOn : suggestFocus.includes(k)))
    setSuggestFocus(next)
    try {
      localStorage.setItem(SUGGEST_FOCUS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private mode etc. -- the choice still applies for this session
    }
    runSuggestions(next, 300)
    Haptics.selectionChanged().catch(() => {})
  }

  const updateComboItem = (comboIndex: number, itemIndex: number, servings: number | null) => {
    setSuggestionCombos((prev) =>
      prev?.map((items, ci) =>
        ci !== comboIndex
          ? items
          : servings === null
            ? items.filter((_, ii) => ii !== itemIndex)
            : items.map((item, ii) => (ii === itemIndex ? { ...item, servings } : item))
      ) ?? null
    )
    Haptics.selectionChanged().catch(() => {})
  }

  // Logs each item through handleLogFood (same totals/rings/undo path as the
  // menu's Log buttons), one at a time so rows land in order.
  const handleLogCombo = async (comboIndex: number) => {
    const items = suggestionCombos?.[comboIndex]
    if (!items || items.length === 0) return
    setLoggingComboIndex(comboIndex)
    let logged = 0
    for (const item of items) {
      // Stop at the first failure (e.g. signed out) -- handleLogFood has
      // already shown why, and the rest would fail the same way
      if (!(await handleLogFood(item.food.recipe_id, item.servings))) break
      logged++
    }
    setLoggingComboIndex(null)
    if (logged > 0) {
      closeSuggestions()
      showToast(
        logged === items.length
          ? `Logged ${logged} item${logged !== 1 ? 's' : ''}`
          : `Logged ${logged} of ${items.length} items`,
        logged === items.length ? 'success' : 'error'
      )
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
      className="min-h-dvh bg-app text-fg relative overflow-x-clip"
    >

      {/* TopAppBar */}
      <header className="glass-bar app-header fixed top-0 w-full z-50 flex justify-between items-center px-5 py-3 bg-app/60 backdrop-blur-xl">
        {/* Soft edge instead of a 1px divider: the header's tint and blur
            fade out over 12px where content scrolls under (globals.css) */}
        <div aria-hidden="true" className="app-header-fade" />
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
            <span className="text-xs font-bold text-fg/70">
              UCSC Macro Tracker
            </span>
          </div>
        </div>


        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/20 ml-1 flex items-center justify-center hover:bg-white/20 press active:scale-95 overflow-hidden"
            aria-label="Edit user profile"
          >
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-fg-subtle" />
            )}
          </button>
        </div>
      </header>

      {/* All toasts (ring closed, errors, undo) in one column above the
          floating tab bar -- kept outside <main> (and its desktop zoom
          wrapper) so it sits relative to the viewport. The undo toast is
          first, so it stays nearest the tab bar. */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} onExited={removeToast} onHold={holdToast}>
        {undoToast.item && (
          <Toast
            key={undoToast.item.id}
            action={{ label: 'Undo', onClick: handleUndoDelete }}
            leaving={undoToast.leaving}
            onExited={undoToast.onExited}
            onHold={holdUndo}
          >
            <span className="block truncate">Removed {undoToast.item.food_items?.name ?? 'entry'}</span>
          </Toast>
        )}
      </ToastStack>

      {/* Main Content */}
      <main className="app-main-top px-3 max-w-2xl mx-auto pb-[calc(env(safe-area-inset-bottom)+124px)] lg:max-w-[1100px] lg:px-5">
      <div className="lg:[zoom:1.3]">

        {/* Live macro totals banner — Log Menu only; Progress has its own rings for this.
            A slim single-row strip (value against target + a thin progress bar per
            macro) instead of four separate boxed tiles stacked 2x2 — same information,
            a fraction of the height. */}
        {/* Sticky just under the fixed header (3.75rem tall + 1px border, plus
            its safe-area inset) so the "+N" serving preview stays visible while
            scrolled down the menu. Desktop divides by the 1.3 zoom below. */}
        {activeTab === 'log' && (
          <div className="sticky z-40 top-[calc(env(safe-area-inset-top)+3.75rem+1px)] lg:top-[calc((3.75rem+1px)/1.3)] rounded-2xl px-4 py-3 mb-3 flex items-stretch gap-4 bg-surface border border-white/10 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.7)]">
            {[
              { label: 'Calories', value: displayTotals.calories, goal: goalCalories, color: 'var(--color-macro-cal)', unit: '', key: 'calories' as const },
              { label: 'Protein', value: displayTotals.protein, goal: goalProtein, color: 'var(--color-macro-protein)', unit: 'g', key: 'protein' as const },
              { label: 'Carbs', value: displayTotals.carbs, goal: goalCarbs, color: 'var(--color-macro-carbs)', unit: 'g', key: 'carbs' as const },
              { label: 'Fat', value: displayTotals.fat, goal: goalFat, color: 'var(--color-macro-fat)', unit: 'g', key: 'fat' as const },
            ].map((m, i) => (
              <MacroBarItem
                key={m.label}
                label={m.label}
                value={m.value}
                goal={m.goal}
                color={m.color}
                unit={m.unit}
                bordered={i > 0}
                loaded={totalsLoaded}
                preview={servingPreview ? (servingPreview.food[m.key] || 0) * servingPreview.servings : 0}
              />
            ))}
          </div>
        )}

        {/* "Close my rings" -- what's left today, and a way to get combos
            from the current menu that fill it */}
        {activeTab === 'log' && (
          <div className="rounded-2xl pl-3 pr-2 py-2 mb-6 min-h-tap flex items-center gap-3 bg-surface border border-white/10">
            <Sammy mood="idle" size={2} onTapMessage={sammyTapMessage} bubbleAlign="left" className="-my-2.5 -mx-0.5" />
            {!totalsLoaded ? (
              <p className="text-sm text-fg-muted">Checking what&apos;s left…</p>
            ) : !targetsSaved ? (
              <>
                <p className="text-sm text-fg-muted">Set targets to get suggestions</p>
                <button
                  type="button"
                  onClick={() => setIsTargetsModalOpen(true)}
                  className="ml-auto shrink-0 relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] px-3 py-1.5 rounded-lg text-xs font-bold text-sky hover:bg-sky/10 active:scale-95 motion-reduce:active:scale-100 press"
                >
                  Set targets
                </button>
              </>
            ) : allRingsClosed ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gold">
                <Check size={14} strokeWidth={3} aria-hidden="true" />
                Rings closed
              </p>
            ) : caloriesClosed ? (
              <p className="text-sm text-fg-muted">
                Calorie ring closed
                {remainingMacros.protein > 0 && ` · ${Math.round(remainingMacros.protein)}g protein left`}
              </p>
            ) : (
              <>
                <p className="min-w-0 text-sm font-semibold tabular-nums truncate">
                  <span className="text-macro-cal">{Math.round(remainingMacros.calories)} cal</span>
                  {remainingMacros.protein > 0 && (
                    <span className="text-macro-protein"> · {Math.round(remainingMacros.protein)}g protein</span>
                  )}
                  <span className="text-fg-muted font-medium"> left</span>
                </p>
                <button
                  type="button"
                  onClick={openSuggestions}
                  aria-haspopup="dialog"
                  className="ml-auto shrink-0 relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] px-3 py-1.5 rounded-lg bg-gold text-on-gold text-xs font-bold shadow-md hover:brightness-105 active:scale-95 motion-reduce:active:scale-100 press"
                >
                  Suggest meals
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'log' ? (
          <div className="space-y-6">
            {/* Hall + meal selector */}
            <div className="rounded-2xl p-5 space-y-4 bg-surface border border-white/10">
              <div className="flex flex-col md:flex-row gap-3">
                <select
                  value={selectedHall}
                  onChange={(e) => {
                    setSelectedHall(e.target.value)
                    Haptics.selectionChanged().catch(() => {})
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-surface-2 p-3 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40"
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
              <div className="flex bg-surface-2 p-1 rounded-xl gap-1">
                {DAY_OFFSETS.map(offset => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => {
                      setSelectedDayOffset(offset)
                      Haptics.selectionChanged().catch(() => {})
                    }}
                    className={`relative flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg press active:scale-95 whitespace-nowrap after:absolute after:inset-x-0 after:content-[''] after:-inset-y-2 ${selectedDayOffset === offset
                      ? 'bg-gold/15 text-gold border border-gold/40'
                      : 'text-fg-muted hover:text-fg border border-transparent'
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
                <p className="text-left text-sm font-semibold text-macro-fat">
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
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
                    />
                    <path
                      d={DAY_TRACK_PATH}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="1"
                      strokeWidth="6"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={100 - dayTrack.markerPct}
                      style={{ filter: 'drop-shadow(0 0 3px rgba(214,185,58,0.85))' }}
                      ref={dayTrackGlowRef}
                      className="text-gold transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
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
                          style={{ transition: trackDragPct !== null || reduceMotion ? 'none' : 'transform 900ms ease-out' }}
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
                                {/* SMIL can't be paused from CSS, so Reduce Motion
                                    drops it -- the head then rests upright (0deg,
                                    the middle of its swing). */}
                                {!reduceMotion && (
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
                                )}
                                <SlugHead />
                              </g>
                            )}
                          </g>
                          {/* Two small "Zz" marks drifting up and fading near the
                              top-right of the face while asleep — outside the
                              mirrored/scaled head group so they stay upright and
                              unflipped regardless of which way the head is facing. */}
                          {/* Reduce Motion: the z's hold still at their visible opacity */}
                          {isSleeping && (
                            <g style={{ pointerEvents: 'none' }}>
                              <text x="13" y="-16" fontSize="9" fontWeight="bold" className="fill-sky" opacity={reduceMotion ? 0.9 : undefined}>
                                {!reduceMotion && (
                                  <>
                                    <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.7;1" dur="2.4s" repeatCount="indefinite" />
                                    <animateTransform attributeName="transform" type="translate" values="0 6;0 -6" dur="2.4s" repeatCount="indefinite" />
                                  </>
                                )}
                                z
                              </text>
                              <text x="19" y="-23" fontSize="6" fontWeight="bold" className="fill-sky" opacity={reduceMotion ? 0.7 : undefined}>
                                {!reduceMotion && (
                                  <>
                                    <animate attributeName="opacity" values="0;0.7;0.7;0" keyTimes="0;0.15;0.7;1" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                                    <animateTransform attributeName="transform" type="translate" values="0 4;0 -8" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
                                  </>
                                )}
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
                        aria-label={`Show ${seg.label} menu`}
                        aria-pressed={i === dayTrackSegmentIndexForPct(dayTrack, headPct)}
                        className={`@container relative text-center py-1 text-9 font-bold whitespace-nowrap transition-colors duration-500 active:scale-90 after:absolute after:inset-x-0 after:content-[''] after:-inset-y-3 ${
                          i === dayTrackSegmentIndexForPct(dayTrack, headPct) ? 'text-gold' : 'text-fg-muted'
                        }`}
                      >
                        {/* Full meal names; only "Late Night" shortens, and only when
                            its segment is narrower than the full words need */}
                        {seg.label === 'Late Night' ? (
                          <>
                            <span className="hidden @[3.5rem]:inline">Late Night</span>
                            <span className="@[3.5rem]:hidden">Late</span>
                          </>
                        ) : (
                          seg.label
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Open / close times, sky blue to match the logo's accent color */}
                  <div className="flex justify-between">
                    <span className="text-10 font-bold text-sky">
                      {dayTrack.opensAt}
                    </span>
                    <span className="text-10 font-bold text-sky">
                      {dayTrack.closesAt}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3">
                {/* Search + station filter pills — hidden when the hall is closed right now */}
                {showMenuSection && (
                  <div className="flex-1 min-w-0 pt-4 border-t border-white/10 space-y-3">
                    <div className="relative w-full">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={18} aria-hidden="true" />
                      <input
                        type="search"
                        aria-label="Search menu items"
                        placeholder="Search today's items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-surface-2 pl-10 pr-9 py-2.5 text-fg font-medium text-input focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg press active:scale-90"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* One slim row: dietary chip, then the "Stations" button that
                        opens the station picker sheet, then the stations currently
                        selected. Only scrolls (sideways only) when it overflows --
                        overflow-y-hidden matters because overflow-x-auto alone turns
                        overflow-y to auto, and the Show button's enlarged tap area
                        (after:-inset-2) pokes out vertically, giving the row a few
                        px of up/down/diagonal drag. No touch-action restriction, so
                        vertical swipes starting here still scroll the page. */}
                    {(availableStations.length > 0 || dietHiddenCount > 0) && (
                      <div
                        ref={filterRowRef}
                        className={`flex items-center gap-2 pt-1 -mx-5 px-5 ${filterRowOverflows ? 'overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-none' : ''}`}
                      >
                        {dietHiddenCount > 0 && (
                          <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-sky/30 bg-sky/10 pl-3 pr-1 py-1 whitespace-nowrap">
                            <span className="text-xs font-semibold text-sky max-w-[11rem] truncate">{dietChipLabel}</span>
                            <span className="text-xs text-fg-muted tabular-nums">
                              , {dietHiddenCount} {dietFilterOff ? 'shown' : 'hidden'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setDietFilterOff((off) => !off)
                                Haptics.selectionChanged().catch(() => {})
                              }}
                              aria-label={dietFilterOff ? 'Hide items that do not match your dietary preferences' : `Show ${dietHiddenCount} hidden items`}
                              className="relative after:absolute after:-inset-2 after:content-[''] rounded-full px-2 py-0.5 text-xs font-bold text-gold hover:bg-gold/10 active:scale-95 press"
                            >
                              {dietFilterOff ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        )}
                        {availableStations.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsStationSheetOpen(true)
                              Haptics.selectionChanged().catch(() => {})
                            }}
                            aria-haspopup="dialog"
                            aria-label={`Filter by station, ${activeStationFilters.length || 'all'} selected`}
                            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold press active:scale-95 motion-reduce:active:scale-100 ${activeStationFilters.length > 0
                              ? 'bg-gold/15 text-gold border-gold/40'
                              : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                              }`}
                          >
                            <SlidersHorizontal size={14} aria-hidden="true" />
                            Stations · {activeStationFilters.length || 'All'}
                          </button>
                        )}
                        {/* What's filtering right now -- tap one to remove it */}
                        {activeStationFilters.map((station) => {
                          const name = cleanStationName(station.includes(' - ') ? station.split(' - ')[1] : station)
                          return (
                            <button
                              key={station}
                              type="button"
                              onClick={() => handleToggleStationFilter(station)}
                              aria-label={`Remove ${name} filter`}
                              className="shrink-0 whitespace-nowrap flex items-center gap-1 px-2.5 py-1 rounded-full border bg-gold/15 text-gold border-gold/40 text-xs font-bold press active:scale-95 motion-reduce:active:scale-100"
                            >
                              {name}
                              <X size={12} strokeWidth={2.75} aria-hidden="true" />
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
                <div role="status" className="rounded-2xl p-4 bg-surface-2 border border-white/10 text-sm flex items-center justify-center gap-3">
                  <Sammy mood="sleep" size={2} />
                  <p className="min-w-0">
                    <span className="font-semibold text-fg">{closedLabel}</span>
                    {nextOpeningLabel && <span className="text-fg-muted"> · {nextOpeningLabel}</span>}
                  </p>
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
                    <div className="space-y-1" role="status" aria-label="Loading menu">
                      <div className="flex justify-center pt-2 pb-1">
                        <Sammy mood="loading" size={2} />
                      </div>
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="py-4 flex items-center justify-between gap-4 animate-pulse motion-reduce:animate-none"
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
                    <div className="py-12 flex flex-col items-center gap-3 text-center text-fg-subtle font-medium">
                      <Sammy mood={isClosedNow ? 'sleep' : 'idle'} size={3} />
                      {menu.length === 0
                        ? `No items found for this meal period ${selectedDayOffset === 0 ? 'today' : selectedDayOffset === 1 ? 'tomorrow' : `on ${getDayOffsetLabel(selectedDayOffset)}`}.`
                        : dietHiddenCount > 0 && !dietFilterOff
                          ? 'No menu items match your search, station or dietary filters.'
                          : 'No menu items match your search or station filters.'}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {parentGroupedMenu.map(({ parent, subgroups }) => (
                        <div key={parent} className="space-y-3">
                          <div className="flex items-center">
                            <span className="text-xs font-black tracking-wider text-[#00325b] uppercase bg-sky border border-sky px-3 py-1 rounded-lg shadow-sm">
                              {cleanStationName(parent)}
                            </span>
                            <div className="flex-1 h-px bg-white/10 ml-4" />
                          </div>

                          {subgroups.map(({ sub, entries }) => (
                            <div key={sub || 'none'} className="space-y-2">
                              {sub && (
                                <p className="inline-block text-sm font-bold tracking-wider text-sky bg-sky/10 uppercase px-2 py-0.5 rounded-lg">
                                  {sub}
                                </p>
                              )}
                              <div className="divide-y divide-white/10">
                                {entries.map((entry, entryIndex) => {
                                  const food = entry.food_items
                                  if (!food) return null
                                  const rowServings = servings[food.recipe_id] ?? 1
                                  return (
                                    <article
                                      key={food.recipe_id}
                                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl px-3 -mx-3 hover:bg-white/5 transition-colors animate-row-in"
                                      style={{ animationDelay: `${Math.min(entryIndex, 8) * 35}ms` }}
                                    >
                                      {/* Name, portion and macros are one tap target that opens the food sheet */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDetailFood(food)
                                          setDetailServings(rowServings)
                                          Haptics.selectionChanged().catch(() => {})
                                        }}
                                        aria-label={`${food.name}, details`}
                                        className="group min-w-0 sm:flex-1 text-left rounded-lg active:opacity-70"
                                      >
                                        <span className="flex items-start gap-1 font-semibold text-fg">
                                          <span className="min-w-0">{food.name}</span>
                                          <ChevronRight size={16} className="shrink-0 mt-[0.2em] text-fg-muted group-hover:text-fg transition-colors" aria-hidden="true" />
                                        </span>
                                        <span className="block text-xs text-fg-muted mt-0.5">
                                          {food.portion || '1 serving'}
                                          {rowServings !== 1 && ` × ${rowServings}`}
                                        </span>
                                        {/* Scales with the serving pills below, so it shows what Log will add */}
                                        <span className="flex flex-wrap gap-1.5 mt-1.5 text-11 font-semibold tabular-nums">
                                          <span className="rounded-md px-1.5 bg-macro-cal/15 text-macro-cal">{Math.round(food.calories * rowServings)} cal</span>
                                          <span className="rounded-md px-1.5 bg-macro-protein/15 text-macro-protein">P {Math.round(food.protein * rowServings)}g</span>
                                          <span className="rounded-md px-1.5 bg-macro-carbs/15 text-macro-carbs">C {Math.round(food.carbs * rowServings)}g</span>
                                          <span className="rounded-md px-1.5 bg-macro-fat/15 text-macro-fat">F {Math.round(food.fat * rowServings)}g</span>
                                        </span>
                                      </button>

                                      <div className="flex items-center justify-between w-full gap-3 sm:w-auto sm:justify-start">
                                        <div role="radiogroup" aria-label={`Servings of ${food.name}`} className="flex bg-surface-2 p-1.5 rounded-xl gap-1">
                                          {SERVING_OPTIONS.map((value) => {
                                            const isSelected = rowServings === value
                                            return (
                                              <button
                                                key={value}
                                                type="button"
                                                role="radio"
                                                aria-checked={isSelected}
                                                onClick={() => {
                                                  setServings({ ...servings, [food.recipe_id]: value })
                                                  showServingPreview(food, value)
                                                }}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg press active:scale-90 ${isSelected
                                                  ? 'bg-gold/15 text-gold'
                                                  : 'text-fg-muted hover:text-fg'
                                                  }`}
                                              >
                                                {value}x
                                              </button>
                                            )
                                          })}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleLogFood(food.recipe_id, rowServings)}
                                          disabled={!!justLogged[food.recipe_id]}
                                          aria-label={justLogged[food.recipe_id] ? `Logged ${food.name}` : `Log ${rowServings} serving${rowServings !== 1 ? 's' : ''} of ${food.name}`}
                                          className={`relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] flex min-h-btn min-w-tap items-center justify-center rounded-lg px-3.5 text-xs font-bold shadow-md transition-colors duration-300 active:scale-95 ${justLogged[food.recipe_id]
                                            ? 'bg-macro-protein text-on-gold'
                                            : 'bg-gold text-on-gold hover:brightness-105'
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
            <div className="rounded-2xl p-4 bg-surface border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {showCalendar ? 'Past Rings Calendar' : 'Today'}
                  </h2>
                  <p
                    className={
                      showCalendar
                        ? 'text-xs text-fg-subtle/70 mt-0.5'
                        : 'text-sm font-bold mt-0.5 text-fg-subtle'
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
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl press active:scale-95 border ${showCalendar
                      ? 'bg-gold/15 text-gold border-gold/40'
                      : 'bg-white/5 text-fg-subtle hover:bg-white/10 border-white/15'
                      }`}
                  >
                    <Calendar size={14} />
                    {showCalendar ? "View Today's Rings" : 'History Calendar'}
                  </button>

                  {/* Set Targets button now opens the SetTargetsModal */}
                  <button
                    onClick={() => setIsTargetsModalOpen(true)}
                    className="bg-gray-800 text-xs font-bold text-fg-subtle hover:bg-gray-700 px-3 py-2 rounded-xl press active:scale-95 border border-gray-700"
                  >
                    Set Targets
                  </button>
                </div>
              </div>

              {!showCalendar ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ProgressRing value={displayTotals.calories} goal={goalCalories} strokeColor="var(--color-macro-cal)" labelColor="var(--color-macro-cal)" label="Calories" unit="kcal" loaded={totalsLoaded} />
                  <ProgressRing value={displayTotals.protein} goal={goalProtein} strokeColor="var(--color-macro-protein)" labelColor="var(--color-macro-protein)" label="Protein" unit="g" loaded={totalsLoaded} />
                  <ProgressRing value={displayTotals.carbs} goal={goalCarbs} strokeColor="var(--color-macro-carbs)" labelColor="var(--color-macro-carbs)" label="Carbs" unit="g" loaded={totalsLoaded} />
                  <ProgressRing value={displayTotals.fat} goal={goalFat} strokeColor="var(--color-macro-fat)" labelColor="var(--color-macro-fat)" label="Fat" unit="g" loaded={totalsLoaded} />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex bg-[#171f33] p-1.5 rounded-xl gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain">
                    {[
                      { key: 'calories', label: 'Calories', color: 'var(--color-macro-cal)', text: '#00325b' },
                      { key: 'protein', label: 'Protein', color: 'var(--color-macro-protein)', text: '#102e10' },
                      { key: 'carbs', label: 'Carbs', color: 'var(--color-macro-carbs)', text: '#612f5e' },
                      { key: 'fat', label: 'Fat', color: 'var(--color-macro-fat)', text: '#4c0519' }
                    ].map((macro) => (
                      <button
                        key={macro.key}
                        type="button"
                        onClick={() => setCalendarMacro(macro.key as any)}
                        className="flex-1 py-1.5 px-3 text-xs font-black rounded-lg press active:scale-95 whitespace-nowrap"
                        style={
                          calendarMacro === macro.key
                            ? { backgroundColor: macro.color, color: macro.text }
                            : { color: 'var(--color-fg-subtle)' }
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
                        className="p-2 rounded-lg hover:bg-white/10 text-fg-subtle hover:text-fg press active:scale-90"
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                      </button>

                      <p className="text-sm font-black text-fg">
                        {calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>

                      <button
                        type="button"
                        onClick={goToNextMonth}
                        disabled={isCurrentMonth}
                        className="p-2 rounded-lg hover:bg-white/10 text-fg-subtle hover:text-fg press active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        aria-label="Next month"
                      >
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-extrabold text-fg-subtle/70">
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
                        let ringColor = 'var(--color-sky)'
                        let unit = 'kcal'

                        if (calendarMacro === 'calories') {
                          actualVal = dayStats.calories; targetedGoal = goalCalories; ringColor = 'var(--color-macro-cal)'; unit = 'kcal'
                        } else if (calendarMacro === 'protein') {
                          actualVal = dayStats.protein; targetedGoal = goalProtein; ringColor = 'var(--color-macro-protein)'; unit = 'g'
                        } else if (calendarMacro === 'carbs') {
                          actualVal = dayStats.carbs; targetedGoal = goalCarbs; ringColor = 'var(--color-macro-carbs)'; unit = 'g'
                        } else if (calendarMacro === 'fat') {
                          actualVal = dayStats.fat; targetedGoal = goalFat; ringColor = 'var(--color-macro-fat)'; unit = 'g'
                        }

                        return (
                          <div
                            key={cell.dateString}
                            className="aspect-square bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-between p-1.5 hover:bg-white/10 transition relative group"
                          >
                            <span className="text-xs font-black text-fg-subtle">{cell.dayNum}</span>
                            <MiniProgressRing value={actualVal} goal={targetedGoal} strokeColor={ringColor} />
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#060e20] text-fg text-10 font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-md border border-white/10">
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
            <div className="rounded-2xl p-5 bg-surface border border-white/10">
              <h2 className="text-lg font-bold tracking-tight mb-4">Everything Logged Today</h2>

              {/* Grouped by meal (only meals with items). Rows mid-undo stay
                  mounted only while their slide-out plays; group calories
                  leave out pending deletes, same as displayTotals. */}
              {(() => {
                const visibleLogs = loggedMeals.filter(
                  (log) => !hiddenLogIds.includes(log.id) || justDeleted[log.id]
                )
                if (visibleLogs.length === 0) {
                  return (
                    <div className="py-12 flex flex-col items-center gap-3 text-center text-fg-muted font-medium">
                      <Sammy mood="idle" size={3} />
                      You haven't logged any foods today yet. Go back to Log Menu to add meals!
                    </div>
                  )
                }

                const groups = new Map<string, MealLog[]>()
                visibleLogs.forEach((log) => {
                  const key = log.meal_type || 'Other'
                  groups.set(key, [...(groups.get(key) ?? []), log])
                })
                const orderIndex = (meal: string) => {
                  const i = LOG_MEAL_ORDER.indexOf(meal)
                  return i === -1 ? LOG_MEAL_ORDER.length : i
                }
                const orderedGroups = Array.from(groups.entries()).sort(
                  ([a], [b]) => orderIndex(a) - orderIndex(b) || a.localeCompare(b)
                )

                return (
                  <div className="space-y-4">
                    {orderedGroups.map(([meal, logs]) => {
                      const groupCalories = logs
                        .filter((log) => !hiddenLogIds.includes(log.id))
                        .reduce((sum, log) => sum + (Number(log.food_items?.calories) || 0) * (Number(log.servings) || 1), 0)
                      return (
                        <section key={meal} aria-label={`${meal}, ${Math.round(groupCalories)} calories`}>
                          <h3 className="flex items-baseline justify-between gap-3 text-xs font-bold uppercase tracking-wider text-sky">
                            <span className="capitalize">{meal}</span>
                            <span className="text-macro-cal tabular-nums normal-case tracking-normal">{Math.round(groupCalories)} cal</span>
                          </h3>
                          <div className="divide-y divide-white/10">
                            {logs.map((log) => {
                              const swipeOffset = justDeleted[log.id]
                                ? -400
                                : (isSwipeDragging === log.id ? swipeDragOffset : 0)
                              const s = log.servings
                              return (
                              <div key={log.id} className="relative overflow-hidden rounded-xl">
                                {/* Red surface revealed as the row is swiped left (decorative --
                                    the trash button on the row is the accessible way to delete) */}
                                <div
                                  aria-hidden="true"
                                  className="absolute inset-0 flex items-center justify-end pr-6 bg-danger text-[#3b0a0a]"
                                >
                                  <Trash2 size={18} />
                                </div>

                                <div
                                  onPointerDown={(e) => handleSwipePointerDown(log.id, e)}
                                  style={{
                                    transform: `translateX(${swipeOffset}px)`,
                                    opacity: justDeleted[log.id] ? 0 : 1,
                                    transition: isSwipeDragging === log.id || reduceMotion ? 'none' : 'transform 0.25s ease-out, opacity 0.2s ease-out',
                                  }}
                                  className="relative bg-surface py-3 flex items-center gap-3 touch-pan-y"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-semibold text-fg leading-snug">{log.food_items?.name}</p>
                                    <p className="text-xs text-fg-muted mt-0.5">
                                      {log.dining_hall} • {s} serving{s !== 1 ? 's' : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs font-semibold tabular-nums">
                                      <span className="text-macro-cal">{Math.round((log.food_items?.calories || 0) * s)} cal</span>
                                      <span className="text-macro-protein">P {Math.round((log.food_items?.protein || 0) * s)}g</span>
                                      <span className="text-macro-carbs">C {Math.round((log.food_items?.carbs || 0) * s)}g</span>
                                      <span className="text-macro-fat">F {Math.round((log.food_items?.fat || 0) * s)}g</span>
                                    </div>
                                  </div>
                                  {/* Visible delete -- swipe is a shortcut, not the only way */}
                                  <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => handleDeleteLog(log.id)}
                                    disabled={!!justDeleted[log.id]}
                                    aria-label={`Remove ${log.food_items?.name ?? 'this entry'}`}
                                    className="p-2 shrink-0 flex items-center justify-center rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 press active:scale-90 motion-reduce:active:scale-100"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
      </main>

      {/* Floating tab bar -- an iOS-style pill that floats above the content,
          lifted off the bottom edge by the home-indicator inset + 12px. The
          gold capsule behind the active tab slides between the two halves. */}
      <div
        className="fixed left-0 right-0 z-50 px-4 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <nav
          aria-label="Main"
          className="glass-bar pointer-events-auto relative grid grid-cols-2 w-full max-w-[340px] p-1 rounded-full bg-app/75 backdrop-blur-2xl border border-white/15 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.65)]"
        >
          {/* Sammy perched on top of the pill's right end -- above the nav,
              never over its buttons. Tappable (44px target) for a progress
              bubble; the menu's bottom padding lets every row scroll clear
              of him, like the nav itself. */}
          <span className="absolute bottom-full right-4">
            <Sammy
              mood={cornerPlay?.mood ?? (isClosedNow ? 'sleep' : 'idle')}
              moodKey={cornerPlay?.key ?? 0}
              sparkleColors={cornerPlay?.colors}
              size={2}
              variety
              onTapMessage={sammyTapMessage}
              bubbleAlign="right"
            />
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-gold/15 border border-gold/30 transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: activeTab === 'progress' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          <button
            type="button"
            onClick={() => {
              setActiveTab('log')
              Haptics.selectionChanged().catch(() => {})
            }}
            aria-current={activeTab === 'log' ? 'page' : undefined}
            className={`relative z-10 flex flex-col items-center justify-center py-1 rounded-full press after:absolute after:inset-x-0 after:content-[''] after:-inset-y-1 active:scale-95 motion-reduce:active:scale-100 ${activeTab === 'log' ? 'text-gold' : 'text-fg-muted hover:text-fg'
              }`}
          >
            <UtensilsCrossed size={20} strokeWidth={activeTab === 'log' ? 2.5 : 2} />
            <span className="text-10 font-bold leading-none mt-0.5">Menu</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('progress')
              Haptics.selectionChanged().catch(() => {})
            }}
            aria-current={activeTab === 'progress' ? 'page' : undefined}
            className={`relative z-10 flex flex-col items-center justify-center py-1 rounded-full press after:absolute after:inset-x-0 after:content-[''] after:-inset-y-1 active:scale-95 motion-reduce:active:scale-100 ${activeTab === 'progress' ? 'text-gold' : 'text-fg-muted hover:text-fg'
              }`}
          >
            <LineChart size={20} strokeWidth={activeTab === 'progress' ? 2.5 : 2} />
            <span className="text-10 font-bold leading-none mt-0.5">Progress</span>
          </button>
        </nav>
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
      {showWelcome && <WelcomeCard onClose={dismissWelcome} />}

      {/* "Close my rings" suggestions -- 2-3 editable combos from the current
          (filtered) menu. Servings/removals update each combo's totals live;
          "Log all" goes through handleLogFood for every item. */}
      {suggestionCombos && (
        <BottomSheet onClose={closeSuggestions} labelledBy="suggestions-title">
          <SheetCloseButton
            aria-label="Close"
            className="absolute -top-1 right-1.5 size-tap flex items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg press active:scale-90 motion-reduce:active:scale-100"
          >
            <X size={20} />
          </SheetCloseButton>
          <h2 id="suggestions-title" className="flex items-center gap-2 text-lg font-bold tracking-tight text-fg pr-10">
            <Sammy mood={suggestionsThinking ? 'think' : 'idle'} size={2} />
            Close my rings
          </h2>
          <p className="text-xs text-fg-muted mt-0.5">
            From {selectedHall}, {getDayOffsetLabel(selectedDayOffset).toLowerCase() === 'today' ? '' : `${getDayOffsetLabel(selectedDayOffset)} `}{selectedMeal}
          </p>

          {/* Which rings to close -- toggling re-runs the suggestions */}
          <div role="group" aria-label="Rings to close" className="mt-3 flex flex-wrap gap-1.5">
            {MACRO_KEYS.map((macro) => {
              const isOn = suggestFocus.includes(macro)
              const isLastOn = isOn && suggestFocus.length === 1
              return (
                <button
                  key={macro}
                  type="button"
                  aria-pressed={isOn}
                  aria-disabled={isLastOn || undefined}
                  aria-label={`${MACRO_CHIP_LABELS[macro]}${isLastOn ? ', at least one ring must stay selected' : ''}`}
                  onClick={() => toggleSuggestFocus(macro)}
                  className={`relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-5 press active:scale-95 motion-reduce:active:scale-100 ${
                    isOn
                      ? 'bg-gold text-on-gold'
                      : 'bg-white/5 text-fg border border-white/15 hover:bg-white/10'
                  } ${isLastOn ? 'cursor-not-allowed' : ''}`}
                >
                  {isOn && <Check size={12} aria-hidden="true" />}
                  {MACRO_CHIP_LABELS[macro]}
                </button>
              )
            })}
          </div>
          {(() => {
            const closed = suggestFocus.filter((k) => !activeFocus([k], remainingMacros).length)
            return closed.length > 0 ? (
              <p className="mt-2 text-xs text-fg-muted">
                {closed.map((k) => MACRO_CHIP_LABELS[k]).join(' and ')} {closed.length === 1 ? 'ring is' : 'rings are'} already closed, so {closed.length === 1 ? "it isn't" : "they aren't"} counted.
              </p>
            ) : null
          })()}

          {suggestionsThinking ? (
            <p role="status" className="py-10 text-center text-sm text-fg-muted">Sammy is thinking…</p>
          ) : suggestionCombos.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-muted">
              {activeFocus(suggestFocus, remainingMacros).length === 0
                ? 'Every ring you picked is already closed. Turn on another one above.'
                : 'Nothing on this menu fits what’s left right now. Try another meal or loosen your station or search filters.'}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {suggestionCombos.map((items, comboIndex) => {
                const t = comboTotals(items)
                const after = {
                  calories: remainingMacros.calories - t.calories,
                  protein: remainingMacros.protein - t.protein,
                }
                const isLogging = loggingComboIndex === comboIndex
                return (
                  <section
                    key={comboIndex}
                    aria-labelledby={`combo-${comboIndex}-title`}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 id={`combo-${comboIndex}-title`} className="text-xs font-bold uppercase tracking-wider text-sky">
                        Option {comboIndex + 1}
                      </h3>
                      <p className="text-11 text-fg-muted tabular-nums">
                        {Math.round(after.calories) >= 0
                          ? `Leaves ${Math.round(after.calories)} cal`
                          : `${Math.abs(Math.round(after.calories))} cal over`}
                        {remainingMacros.protein > 0 && ` · ${Math.max(0, Math.round(after.protein))}g protein left`}
                      </p>
                    </div>

                    <ul className="mt-1 divide-y divide-white/10">
                      {items.map((item, itemIndex) => (
                        <li key={item.food.recipe_id} className="py-2 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-fg leading-snug">{item.food.name}</p>
                            <p className="text-11 text-fg-muted truncate">
                              {item.food.station} · {Math.round(item.food.calories * item.servings)} cal · P {Math.round(item.food.protein * item.servings)}g
                            </p>
                          </div>
                          {/* Servings stepper: 0.5 steps, 0.5-2. Visible buttons are
                              small; ::after pads each tap area to 44px. */}
                          <div role="group" aria-label={`Servings of ${item.food.name}`} className="shrink-0 flex items-center rounded-lg bg-app/60">
                            <button
                              type="button"
                              onClick={() => updateComboItem(comboIndex, itemIndex, item.servings - SUGGESTION_SERVING_STEP)}
                              disabled={isLogging || item.servings <= SUGGESTION_MIN_SERVINGS}
                              aria-label={`Fewer servings of ${item.food.name}`}
                              className="relative after:absolute after:-inset-x-2 after:-inset-y-2 after:content-[''] size-7 flex items-center justify-center text-fg-muted hover:text-fg disabled:opacity-30 press"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-9 text-center text-xs font-bold text-gold tabular-nums" aria-live="polite">
                              {item.servings}×
                            </span>
                            <button
                              type="button"
                              onClick={() => updateComboItem(comboIndex, itemIndex, item.servings + SUGGESTION_SERVING_STEP)}
                              disabled={isLogging || item.servings >= SUGGESTION_MAX_SERVINGS}
                              aria-label={`More servings of ${item.food.name}`}
                              className="relative after:absolute after:-inset-x-2 after:-inset-y-2 after:content-[''] size-7 flex items-center justify-center text-fg-muted hover:text-fg disabled:opacity-30 press"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateComboItem(comboIndex, itemIndex, null)}
                            disabled={isLogging}
                            aria-label={`Remove ${item.food.name} from option ${comboIndex + 1}`}
                            className="shrink-0 relative after:absolute after:-inset-2 after:content-[''] size-7 flex items-center justify-center rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 disabled:opacity-30 press"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>

                    {items.length === 0 ? (
                      <p className="py-2 text-sm text-fg-muted">All items removed.</p>
                    ) : (
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="flex flex-wrap gap-1.5 text-11 font-semibold tabular-nums" aria-label={`Together: ${Math.round(t.calories)} calories, ${Math.round(t.protein)} grams protein, ${Math.round(t.carbs)} grams carbs, ${Math.round(t.fat)} grams fat`}>
                          <span className="rounded-md px-1.5 bg-macro-cal/15 text-macro-cal">{Math.round(t.calories)} cal</span>
                          <span className="rounded-md px-1.5 bg-macro-protein/15 text-macro-protein">P {Math.round(t.protein)}g</span>
                          <span className="rounded-md px-1.5 bg-macro-carbs/15 text-macro-carbs">C {Math.round(t.carbs)}g</span>
                          <span className="rounded-md px-1.5 bg-macro-fat/15 text-macro-fat">F {Math.round(t.fat)}g</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => handleLogCombo(comboIndex)}
                          disabled={loggingComboIndex !== null}
                          aria-label={`Log all ${items.length} items in option ${comboIndex + 1}`}
                          className="shrink-0 relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] min-h-btn px-3.5 flex items-center gap-1.5 rounded-lg bg-gold text-on-gold text-xs font-bold shadow-md hover:brightness-105 active:scale-95 motion-reduce:active:scale-100 press disabled:opacity-60"
                        >
                          {isLogging ? 'Logging…' : (
                            <>
                              <Plus size={14} strokeWidth={2.75} aria-hidden="true" />
                              Log all
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-fg-muted">
            Suggestions use the menu&apos;s listed nutrition. Not medical advice.
          </p>
        </BottomSheet>
      )}

      {/* Station picker -- every station as a wrapping multi-select chip (same
          toggle + look as the old inline pills). Changes apply as they're tapped;
          Done just closes. */}
      {isStationSheetOpen && (
        <BottomSheet onClose={() => setIsStationSheetOpen(false)} labelledBy="station-sheet-title">
          <h2 id="station-sheet-title" className="text-lg font-bold tracking-tight text-fg mb-3">
            Stations
          </h2>
          <div className="flex flex-wrap gap-2">
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
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 rounded-full border press active:scale-95 motion-reduce:active:scale-100 flex flex-col items-center leading-tight ${isActive
                    ? 'bg-gold/15 text-gold border-gold/40'
                    : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                    }`}
                >
                  {parentLabel && (
                    <span className={`text-9 font-semibold uppercase tracking-wide ${isActive ? 'text-gold/70' : 'text-sky'}`}>
                      {parentLabel}
                    </span>
                  )}
                  <span className="text-xs font-bold">{cleanStationName(subLabel)}</span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => {
                setActiveStationFilters([])
                Haptics.selectionChanged().catch(() => {})
              }}
              disabled={activeStationFilters.length === 0}
              className="flex-1 min-h-tap rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-fg hover:bg-white/10 press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
            >
              Clear
            </button>
            <SheetCloseButton
              className="flex-1 min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100"
            >
              Done
            </SheetCloseButton>
          </div>
        </BottomSheet>
      )}

      {/* Food detail sheet -- tapping an item's row slides this up as a bottom
          sheet. Ingredients/allergens/dietary icons come from UCSC's
          nutrition label page; older recipes the scraper hasn't captured a
          label for yet just omit those sections instead of showing nothing. */}
      {detailFood && (
        <BottomSheet onClose={() => setDetailFood(null)} labelledBy="food-detail-title">
            <SheetCloseButton
              aria-label="Close"
              className="absolute -top-1 right-1.5 size-tap flex items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg press active:scale-90"
            >
              <X size={20} />
            </SheetCloseButton>

            <h2 id="food-detail-title" className="text-xl font-bold tracking-tight text-fg pr-10">
              {detailFood.name}
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              {detailFood.portion || '1 serving'}
              {detailServings !== 1 && ` × ${detailServings}`}
            </p>

            {/* Macros scale with the serving picker below, so what you see is what gets logged */}
            <div className="grid grid-cols-4 gap-2 mt-4 tabular-nums">
              {[
                { label: 'Cal', value: detailFood.calories, unit: '', cls: 'text-macro-cal' },
                { label: 'Protein', value: detailFood.protein, unit: 'g', cls: 'text-macro-protein' },
                { label: 'Carbs', value: detailFood.carbs, unit: 'g', cls: 'text-macro-carbs' },
                { label: 'Fat', value: detailFood.fat, unit: 'g', cls: 'text-macro-fat' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-white/5 px-2 py-2 text-center">
                  <span className={`block text-lg font-bold leading-tight ${m.cls}`}>
                    {Math.round(m.value * detailServings)}{m.unit}
                  </span>
                  <span className="block text-xs text-fg-muted">{m.label}</span>
                </div>
              ))}
            </div>

            {detailFood.dietary_tags && detailFood.dietary_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {detailFood.dietary_tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${dietaryTagClass(tag)}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {detailFood.ingredients ? (
              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-1.5">Ingredients</h3>
                <p className="text-sm leading-relaxed text-fg">{detailFood.ingredients}</p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-fg-muted italic">
                Ingredient list not available for this item yet.
              </p>
            )}

            {detailFood.allergens && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-1.5">Allergens</h3>
                {/* One chip per allergen; ones the student avoids are flagged in danger red */}
                <div className="flex flex-wrap gap-2">
                  {detailFood.allergens.split(',').map((a) => a.trim()).filter(Boolean).map((allergen, i) => {
                    const avoided = isAvoidedAllergen(allergen)
                    return (
                      <span
                        key={`${allergen}-${i}`}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${avoided
                          ? 'bg-danger/20 text-danger border-danger/60'
                          : 'bg-white/5 text-fg border-white/15'
                          }`}
                      >
                        {allergen}
                        {avoided && <span className="sr-only"> (you avoid this)</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-fg-muted">
              From UCSC Dining's published nutrition label. Always confirm with staff if you have a serious allergy.
            </p>

            {/* Serving size + Log -- moved here from the menu row, which now logs 1x in one tap */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <p id="detail-servings-label" className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">Servings</p>
              <div role="radiogroup" aria-labelledby="detail-servings-label" className="flex bg-app/60 p-1 rounded-xl gap-1">
                {SERVING_OPTIONS.map((value) => {
                  const isSelected = detailServings === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setDetailServings(value)
                        setServings((prev) => ({ ...prev, [detailFood.recipe_id]: value }))
                        Haptics.selectionChanged().catch(() => {})
                      }}
                      className={`relative flex-1 py-1.5 text-xs font-bold rounded-lg after:absolute after:inset-x-0 after:content-[''] after:-inset-y-2 press active:scale-95 tabular-nums ${isSelected
                        ? 'bg-gold/15 text-gold border border-gold/40'
                        : 'text-fg-muted hover:text-fg border border-transparent'
                        }`}
                    >
                      {value}×
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const logged = await handleLogFood(detailFood.recipe_id, detailServings)
                  if (logged) setDetailFood(null)
                }}
                className="relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] mt-3 w-full min-h-btn py-2 flex items-center justify-center gap-1.5 rounded-xl bg-gold text-on-gold text-sm font-semibold shadow-md hover:brightness-105 active:scale-[0.98] press"
              >
                <Plus size={16} strokeWidth={2.75} />
                Log {detailServings === 1 ? '1 serving' : `${detailServings} servings`}
              </button>
            </div>
        </BottomSheet>
      )}
    </div>
  )
}
