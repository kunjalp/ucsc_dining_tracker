'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import SetTargetsModal, { DailyTargets } from './SetTargetsModal'
import UserProfileModal, { UserProfile } from './UserProfileModal'
import { getHallOpenStatus, getHallStatusForDate, getMealCountdown, formatCountdown, getDayTrack } from '@/lib/diningHours'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
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

// How many days ahead the app lets students browse — matches DAYS_AHEAD in
// scraper/scrape_upcoming.py, which is what actually populates these dates.
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
function SlugProfile() {
  return (
    <>
      <path
        d="M -16 0 C -16 -7 -6 -10 4 -9 C 12 -8.3 16 -4 16 0 C 16 4.5 10 8 0 8 C -9 8 -16 5.5 -16 0 Z"
        fill="#d6b93a"
        stroke="#0b1326"
        strokeWidth="1.2"
      />
      <path
        d="M -2 -8.3 C 4 -8.6 10 -6.5 14 -2.5"
        fill="none"
        stroke="#a1c9ff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M -10 6.5 C -4 8 4 7.6 10 5.5"
        fill="none"
        stroke="#a1c9ff"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="-14" cy="-2" r="3.4" fill="#d6b93a" stroke="#0b1326" strokeWidth="1" />
      <line x1="-16" y1="-4.5" x2="-19" y2="-9.5" stroke="#d6b93a" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="-13" y1="-5" x2="-14" y2="-10" stroke="#d6b93a" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="-19.5" cy="-10.3" r="1.5" fill="#d6b93a" />
      <circle cx="-14.3" cy="-10.8" r="1.5" fill="#d6b93a" />
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
const WAVE_AMPLITUDE = 12
const WAVE_CYCLES = 1.5 // how many full ripples across the track

function wavePoint(t: number): Point {
  const x = WAVE_X0 + t * (WAVE_X1 - WAVE_X0)
  const y = WAVE_BASE_Y - WAVE_AMPLITUDE * Math.sin(2 * Math.PI * WAVE_CYCLES * t)
  return [x, y]
}

// The marker's rock/tilt as it rides the wave — same phase as the wave's
// actual slope (steepest where the wave is steepest, level at each crest
// and trough), but capped at exactly +/-70 degrees rather than the much
// steeper angle the raw geometry implies, so it reads as a deliberate
// rocking motion rather than a spin.
function waveRotation(t: number): number {
  return -70 * Math.cos(2 * Math.PI * WAVE_CYCLES * t)
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
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-base font-black tracking-tight text-[#dae2fd]">
            {goal > 0 ? Math.round((value / goal) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="text-center mt-2">
        <p className="text-sm font-black" style={{ color: labelColor }}>{label}</p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#c2c6d0] font-semibold mt-0.5">
          {Math.round(value)} / {goal} {unit}
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
  const [goalMode, setGoalMode] = useState<'recommended' | 'manual'>('recommended')

  // SEARCH & STATION FILTER STATES
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStationFilters, setActiveStationFilters] = useState<string[]>([])

  // Daily targets state settings (now tracking all 4 macro targets)
  const [goalCalories, setGoalCalories] = useState(2000)
  const [goalProtein, setGoalProtein] = useState(120)
  const [goalCarbs, setGoalCarbs] = useState(250)
  const [goalFat, setGoalFat] = useState(70)
  const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false)

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
  useEffect(() => {
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

  // Today's "day track" — the dining hall's scheduled periods laid out
  // proportionally to their real length, with a live "now" marker. Same
  // today-only scope as the countdown above.
  const dayTrack = useMemo(() => {
    if (selectedDayOffset !== 0) return null
    return getDayTrack(selectedHall, now)
  }, [selectedHall, selectedDayOffset, now])

  // A light haptic tap when the day track crosses from one meal period
  // into the next (e.g. Breakfast -> Lunch) — a quiet "something changed"
  // cue. Skipped on the very first render for a hall (nothing "changed"
  // yet) and reset silently on hall switches so jumping between halls
  // doesn't fire a spurious buzz.
  const prevTrackKeyRef = useRef<string | null>(null)
  const prevActiveIndexRef = useRef<number | null>(null)
  useEffect(() => {
    const trackKey = selectedHall
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
  }, [selectedHall, dayTrack?.activeIndex])

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

  // Show scrollbar on Log Menu, hide it on Progress
  useEffect(() => {
    if (activeTab === 'progress') {
      document.body.classList.add('hide-scrollbar')
    } else {
      document.body.classList.remove('hide-scrollbar')
    }
  }, [activeTab])

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
      if (types.length > 0 && !types.includes(selectedMeal)) {
        // Prefer whichever period is live right now (today only) over just
        // falling back to the first tab, so switching to a hall you haven't
        // viewed yet still opens on "now" instead of always Breakfast.
        const current = selectedDayOffset === 0 ? getCurrentMealPeriodLabel(selectedHall) : null
        setSelectedMeal(current && types.includes(current) ? current : types[0])
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

    const { data, error } = await supabase
      .from('daily_menus')
      .select(`
        food_item_id, dining_hall, meal_type, station,
        food_items:food_item_id (
          recipe_id, name, portion, calories, protein, carbs, sugar, fat
        )
      `)
      .eq('date', dateStr)
      .eq('dining_hall', selectedHall)
      .eq('meal_type', selectedMeal)

    if (!error && data) {
      setMenu(data as unknown as MenuEntry[])
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

  // 3. Filter raw items first by search input & clicked station pills
  const filteredMenu = useMemo(() => {
    return menu.filter((entry) => {
      const food = entry.food_items
      if (!food) return false

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
      {/* Ambient background glow */}
      <div className="fixed top-0 left-0 w-full h-[512px] bg-gradient-to-b from-[#003c6c]/20 to-transparent pointer-events-none -z-10 blur-3xl" />

      {/* TopAppBar */}
      <header className="app-header fixed top-0 w-full z-50 flex justify-between items-center px-5 py-4 bg-[#0b1326]/60 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-4">
          <img
            src="/sammy-logo-transparent.png"
            alt="Sammy's Palate"
            className="h-11 w-11 object-contain shrink-0"
          />

          {/* Stacked container */}
          <div className="flex flex-col">
            <span className="font-extrabold text-lg text-[#ffe6ab] tracking-tight leading-none mb-0.5">
              Sammy's Palate
            </span>
            <span className="text-xs font-bold text-[#dae2fd]/70 tracking-wide uppercase">
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

      {/* Main Content */}
      <main className="pt-[150px] px-5 max-w-[1200px] mx-auto pb-[130px]">

        {/* Live macro totals banner — Log Menu only; Progress has its own rings for this */}
        {activeTab === 'log' && (
          <div className="rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_10px_40px_-10px_rgba(0,60,108,0.4)]">
            <div className="bg-white/5 p-3 rounded-xl text-center">
              <p className="text-xs font-semibold text-[#d8b61c] uppercase tracking-wider">Calories</p>
              <p className="text-lg font-black mt-1">{Math.round(totals.calories)} kcal</p>
            </div>
            <div className="bg-white/5 p-3 rounded-xl text-center">
              <p className="text-xs font-semibold text-[#5bb448] uppercase tracking-wider">Protein</p>
              <p className="text-lg font-black mt-1">{Math.round(totals.protein)}g</p>
            </div>
            <div className="bg-white/5 p-3 rounded-xl text-center">
              <p className="text-xs font-semibold text-[#bd5db8] uppercase tracking-wider">Carbs</p>
              <p className="text-lg font-black mt-1">{Math.round(totals.carbs)}g</p>
            </div>
            <div className="bg-white/5 p-3 rounded-xl text-center">
              <p className="text-xs font-semibold text-[#fb7185] uppercase tracking-wider">Fat</p>
              <p className="text-lg font-black mt-1">{Math.round(totals.fat)}g</p>
            </div>
          </div>
        )}

        {activeTab === 'log' ? (
          <div className="space-y-6">
            {/* Hall + meal selector */}
            <div className="rounded-2xl p-5 space-y-4 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5">
              <h2 className="text-lg font-bold tracking-tight">Select Dining Location</h2>
              <div className="flex flex-col md:flex-row gap-3">
                <select
                  value={selectedHall}
                  onChange={(e) => setSelectedHall(e.target.value)}
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
              <div className="flex bg-[#171f33] p-1.5 rounded-xl gap-1 border border-white/10">
                {DAY_OFFSETS.map(offset => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setSelectedDayOffset(offset)}
                    className={`flex-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${selectedDayOffset === offset
                      ? 'bg-[#d6b93a] text-[#6b5300] shadow-md shadow-[#d6b93a]/20'
                      : 'text-[#c2c6d0] hover:text-[#dae2fd]'
                      }`}
                  >
                    {getDayOffsetLabel(offset)}
                  </button>
                ))}
              </div>

              {/* Only worth showing as tabs when there's an actual choice to make —
                  cafes/markets with a single period (e.g. "Menu", "ALL") skip straight
                  to the items instead of showing a single, un-clickable-feeling tab. */}
              {availableMealTypes.length > 1 && showMenuSection && (
                <div className="flex bg-[#171f33] p-2 rounded-xl gap-1">
                  {availableMealTypes.map(meal => (
                    <button
                      key={meal}
                      onClick={() => setSelectedMeal(meal)}
                      className={`flex-1 px-2 py-2.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${selectedMeal === meal
                        ? 'bg-[#d6b93a] text-[#6b5300] shadow-md shadow-[#d6b93a]/20'
                        : 'text-[#c2c6d0] hover:text-[#dae2fd]'
                        }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              )}

              {/* Countdown to the next meal-period milestone (Breakfast/Lunch/
                  Dinner/Late Night) while service is running, "Opens at X"
                  before today's first period, "Closing at X" during the
                  day's last period — dining halls only, today only. */}
              {mealCountdown && (
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
                      glowing gold stroke drawn up to "now" using the path's own
                      declared length (pathLength=100), so the dash math lines up
                      directly with dayTrack.markerPct with no arc-length calculation
                      needed; a light-blue dashed accent rides on top of it, echoing
                      the highlight patches on the real logo's gold band. Sammy's
                      side profile rides the wave itself, rocking between +70 and
                      -70 degrees in step with the wave's own rise and fall. */}
                  <svg viewBox="0 0 300 64" className="w-full" style={{ height: 58, overflow: 'visible' }}>
                    <path d={DAY_TRACK_PATH} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
                    <path
                      d={DAY_TRACK_PATH}
                      fill="none"
                      stroke="#d6b93a"
                      strokeOpacity="0.75"
                      strokeWidth="6"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={100 - dayTrack.markerPct}
                      className="animate-glow-pulse transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                    <path
                      d={DAY_TRACK_PATH}
                      fill="none"
                      stroke="#a1c9ff"
                      strokeOpacity="0.8"
                      strokeWidth="3"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray="6 14"
                    />
                    {[...dayTrack.segments.map((seg) => seg.startPct), 100].map((pct, i) => {
                      const [tx, ty] = wavePoint(pct / 100)
                      return <circle key={i} cx={tx} cy={ty} r="2" fill="#a1c9ff" fillOpacity="0.6" />
                    })}
                    {(() => {
                      const t = dayTrack.markerPct / 100
                      const [mx, my] = wavePoint(t)
                      const angle = waveRotation(t)
                      return (
                        <g
                          style={{
                            transition: 'transform 1000ms linear',
                            filter: 'drop-shadow(0 0 3px rgba(214,185,58,0.6))',
                          }}
                          transform={`translate(${mx} ${my}) rotate(${angle})`}
                        >
                          <SlugProfile />
                        </g>
                      )
                    })()}
                  </svg>
                  <div className="flex">
                    {dayTrack.segments.map((seg, i) => (
                      <div
                        key={`${seg.label}-label-${i}`}
                        style={{ width: `${seg.widthPct}%` }}
                        className={`text-center font-[family-name:var(--font-jetbrains-mono)] text-[9px] font-bold uppercase tracking-wider transition-colors duration-500 ${
                          i === dayTrack.activeIndex ? 'text-[#d6b93a]' : 'text-[#c2c6d0]/40'
                        }`}
                      >
                        {seg.label === 'Late Night' ? 'LN' : seg.label === 'Brunch' ? 'Br' : seg.label[0]}
                      </div>
                    ))}
                  </div>
                  {/* Open / close times, sky blue to match the logo's accent color */}
                  <div className="flex justify-between">
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold text-[#a1c9ff]">
                      {dayTrack.opensAt}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold text-[#a1c9ff]">
                      {dayTrack.closesAt}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-3">
                {/* Search + station filter pills — hidden when the hall is closed right now */}
                {showMenuSection && (
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-bold text-[#c2c6d0] uppercase tracking-wider">Search & Station Filters</p>
                    <div className="relative w-full">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c2c6d0]" size={16} />
                      <input
                        type="text"
                        placeholder="Search today's items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#171f33] pl-10 pr-4 py-2.5 text-[#dae2fd] font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#d6b93a]/40 placeholder-[#c2c6d0]/50"
                      />
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
                              className={`px-3 py-1.5 rounded-full border transition flex flex-col items-center leading-tight ${isActive
                                ? 'bg-[#d6b93a] text-[#6b5300] border-[#d6b93a] shadow-sm'
                                : 'bg-white/5 text-[#c2c6d0] hover:bg-white/10 border-white/15'
                                }`}
                            >
                              {parentLabel && (
                                <span className={`text-[9px] font-semibold uppercase tracking-wide ${isActive ? 'text-[#6b5300]/70' : 'text-[#a1c9ff]'}`}>
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

              {/* Menu items — hidden when the hall is closed right now, except when it's
                  opening later today (previewing today's already-scraped menu before open) */}
              {showMenuSection && (
                <div>
                  <h2 className="text-lg font-bold mb-5 tracking-tight">
                    {getDayOffsetLabel(selectedDayOffset)}'s Menu
                    {availableMealTypes.length > 1 && ` (${selectedMeal})`}
                  </h2>

                  {loading ? (
                    <div className="py-12 text-center text-[#c2c6d0] font-medium">Loading items...</div>
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
                            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-black tracking-wider text-[#00325b] uppercase bg-[#a1c9ff] border border-[#a1c9ff] px-3 py-1 rounded-lg shadow-sm">
                              {cleanStationName(parent)}
                            </span>
                            <div className="flex-1 h-px bg-white/10 ml-4" />
                          </div>

                          {subgroups.map(({ sub, entries }) => (
                            <div key={sub || 'none'} className="space-y-2">
                              {sub && (
                                <p className="inline-block font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold tracking-wider text-[#a1c9ff] bg-[#a1c9ff]/10 uppercase px-2 py-0.5 rounded-md">
                                  {sub}
                                </p>
                              )}
                              <div className="divide-y divide-white/10">
                                {entries.map((entry) => {
                                  const food = entry.food_items
                                  if (!food) return null
                                  return (
                                    <article
                                      key={food.recipe_id}
                                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl px-3 -mx-3 hover:bg-white/5 transition-colors"
                                    >
                                      <div>
                                        <h4 className="font-bold text-[#dae2fd]">{food.name}</h4>
                                        <p className="text-xs text-[#c2c6d0]/70 mt-0.5">
                                          Serving Size: {food.portion || '1 serving'}
                                        </p>
                                        <div className="flex gap-3 mt-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold">
                                          <span className="text-[#d8b61c]">Cals: {food.calories}</span>
                                          <span className="text-[#5bb448]">P: {food.protein}g</span>
                                          <span className="text-[#bd5db8]">C: {food.carbs}g</span>
                                          <span className="text-[#fb7185]">F: {food.fat}g</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between w-full gap-3">
                                        <div className="flex bg-[#171f33] p-1 rounded-xl gap-1 border border-white/10">
                                          {[
                                            { label: '1/4x', value: 0.25 },
                                            { label: '1/2x', value: 0.5 },
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
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${isSelected
                                                  ? 'bg-[#d6b93a] text-[#6b5300] shadow-sm'
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
                                            ? 'bg-[#5bb448] text-white shadow-[#5bb448]/25'
                                            : 'bg-[#d6b93a] text-[#6b5300] shadow-[#d6b93a]/20 hover:brightness-105'
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
            <div className="rounded-2xl p-4 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {showCalendar ? 'Past Rings Calendar' : "Today's Progress Breakdown"}
                  </h2>
                  <p
                    className={
                      showCalendar
                        ? 'text-xs text-[#c2c6d0]/70 mt-0.5'
                        : `text-sm font-bold mt-0.5 ${goalMode === 'recommended' ? 'text-[#a1c9ff]' : 'text-[#ffe6ab]'}`
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
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition border ${showCalendar
                      ? 'bg-[#d6b93a] text-[#6b5300] border-[#d6b93a]'
                      : 'bg-white/5 text-[#c2c6d0] hover:bg-white/10 border-white/15'
                      }`}
                  >
                    <Calendar size={14} />
                    {showCalendar ? "View Today's Rings" : 'History Calendar'}
                  </button>

                  {/* Set Targets button now opens the SetTargetsModal */}
                  <button
                    onClick={() => setIsTargetsModalOpen(true)}
                    className="bg-gray-800 text-xs font-bold text-[#c2c6d0] hover:bg-gray-700 px-3 py-2 rounded-xl transition border border-gray-700"
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
                        className="flex-1 py-1.5 px-3 text-xs font-black rounded-lg transition-all whitespace-nowrap"
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
                        className="p-2 rounded-lg hover:bg-white/10 text-[#c2c6d0] hover:text-[#dae2fd] transition"
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                      </button>

                      <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-black text-[#dae2fd] uppercase tracking-wider">
                        {calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>

                      <button
                        type="button"
                        onClick={goToNextMonth}
                        disabled={isCurrentMonth}
                        className="p-2 rounded-lg hover:bg-white/10 text-[#c2c6d0] hover:text-[#dae2fd] transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        aria-label="Next month"
                      >
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2 text-center font-[family-name:var(--font-jetbrains-mono)] text-xs font-extrabold text-[#c2c6d0]/70">
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
            <div className="rounded-2xl p-5 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5">
              <h2 className="text-lg font-bold tracking-tight mb-4">Everything Logged Today</h2>

              {loggedMeals.length === 0 ? (
                <div className="py-12 text-center text-[#c2c6d0] font-medium">
                  You haven't logged any foods today yet. Go back to Log Menu to add meals!
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {loggedMeals.map((log) => (
                    <div key={log.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-[#dae2fd]">{log.food_items?.name}</h4>
                        <p className="text-xs text-[#c2c6d0]/70 mt-0.5">
                          {log.dining_hall} • <span className="capitalize">{log.meal_type}</span> • {log.servings}x serving(s)
                        </p>
                        <div className="flex gap-2 mt-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[#c2c6d0]">
                          <span>Cals: {Math.round((log.food_items?.calories || 0) * log.servings)}</span>
                          <span>P: {Math.round((log.food_items?.protein || 0) * log.servings)}g</span>
                          <span>C: {Math.round((log.food_items?.carbs || 0) * log.servings)}g</span>
                          <span>F: {Math.round((log.food_items?.fat || 0) * log.servings)}g</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        disabled={!!justDeleted[log.id]}
                        className={`flex min-w-[76px] items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors duration-300 active:scale-95 ${justDeleted[log.id]
                            ? 'bg-[#ffb4ab] text-[#5c1a13]'
                            : 'text-[#ffb4ab] bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20'
                          }`}
                      >
                        {justDeleted[log.id] ? (
                          <Check size={14} strokeWidth={3} className="animate-check-pop" />
                        ) : (
                          <>
                            <Trash2 size={12} />
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky bottom nav */}
      <div className="app-bottom-nav fixed bottom-0 left-0 right-0 bg-[#0b1326]/70 backdrop-blur-2xl border-t border-white/15 shadow-2xl py-3 px-6 z-50">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab('log')}
            className={`flex flex-col items-center gap-1 py-1.5 px-7 rounded-xl transition-all ${activeTab === 'log' ? 'text-[#ffe6ab] scale-105' : 'text-[#c2c6d0]/70 hover:text-[#dae2fd]'
              }`}
          >
            <UtensilsCrossed size={22} strokeWidth={activeTab === 'log' ? 2.5 : 2} />
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold uppercase tracking-wide">Log Menu</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center gap-1 py-1.5 px-7 rounded-xl transition-all ${activeTab === 'progress' ? 'text-[#ffe6ab] scale-105' : 'text-[#c2c6d0]/70 hover:text-[#dae2fd]'
              }`}
          >
            <LineChart size={22} strokeWidth={activeTab === 'progress' ? 2.5 : 2} />
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold uppercase tracking-wide">Progress</span>
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
    </div>
  )
}