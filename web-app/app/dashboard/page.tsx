'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import SetTargetsModal, { DailyTargets } from './SetTargetsModal'
import UserProfileModal, { UserProfile } from './UserProfileModal'
import { getHallOpenStatus } from '@/lib/diningHours'
import { classifyByName } from '@/lib/stationClassifier'

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

const DINING_HALLS = [
  "John R. Lewis & College Nine Dining Hall",
  "Cowell & Stevenson Dining Hall",
  "Crown & Merrill Dining Hall",
  "Porter & Kresge Dining Hall",
  "Rachel Carson & Oakes Dining Hall",
  "Stevenson Coffee House",
  "Perk Coffee Bar",
]

const getEffectiveStation = (entry: MenuEntry): string => {
  const rawStation = entry.station?.trim()
  if (rawStation) return rawStation // trust scraped value when present — Entrees, Grill, etc. already work
  const byName = classifyByName(entry.food_items?.name || '')
  return byName || 'General'
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
  const radius = 50
  const stroke = 10
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI

  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/10">
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
          <span className="font-['JetBrains_Mono'] text-lg font-black tracking-tight text-[#dae2fd]">
            {goal > 0 ? Math.round((value / goal) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="text-center mt-3">
        <p className="text-sm font-black" style={{ color: labelColor }}>{label}</p>
        <p className="font-['JetBrains_Mono'] text-xs text-[#c2c6d0] font-semibold mt-0.5">
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
  const [selectedMeal, setSelectedMeal] = useState('Breakfast')
  const [availableMealTypes, setAvailableMealTypes] = useState<string[]>(['Breakfast', 'Lunch', 'Dinner'])
  const [hallStatus, setHallStatus] = useState<HallStatus | null>(null)
  const [servings, setServings] = useState<{ [key: string]: number }>({})
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
        setUserProfile({
          nickname: (user.user_metadata?.nickname as string) || '',
          email: user.email || '',
          avatarUrl: (user.user_metadata?.avatar_url as string) || null,
          memberSince: user.created_at || null,
          dietaryPreferences: (user.user_metadata?.dietary_preferences as string[]) || [],
        })
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    fetchTodayMenu()
    fetchTodayTotals()
  }, [selectedHall, selectedMeal])

  // Sync available meal-type tabs and the open/closed status whenever the hall changes
  useEffect(() => {
    const syncMealTypes = async () => {
      const types = await fetchMealTypesForHall(selectedHall)
      if (types.length > 0 && !types.includes(selectedMeal)) {
        setSelectedMeal(types[0])
      }
    }
    syncMealTypes()
    fetchHallStatus(selectedHall)
  }, [selectedHall])

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
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Los_Angeles'
    })

    const { data, error } = await supabase
      .from('daily_menus')
      .select(`
        food_item_id, dining_hall, meal_type, station,
        food_items:food_item_id (
          recipe_id, name, portion, calories, protein, carbs, sugar, fat
        )
      `)
      .eq('date', todayStr)
      .eq('dining_hall', selectedHall)
      .eq('meal_type', selectedMeal)

    if (!error && data) {
      setMenu(data as unknown as MenuEntry[])
    }
    setLoading(false)
  }

  // Fetch which meal_type values actually exist for this hall today.
  // Real dining halls have Breakfast/Lunch/Dinner; cafes/markets may only have
  // one value like "Menu" or "ALL"; retail spots with no scraped data at all
  // (e.g. Merrill Market) get an empty array so the tab row hides entirely.
  const fetchMealTypesForHall = async (hall: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Los_Angeles'
    })

    const { data, error } = await supabase
      .from('daily_menus')
      .select('meal_type')
      .eq('dining_hall', hall)
      .eq('date', todayStr)

    if (error || !data || data.length === 0) {
      setAvailableMealTypes([])
      return []
    }

    const found = Array.from(new Set(data.map((row) => row.meal_type)))

    // Keep Breakfast -> Lunch -> Dinner order when present; anything else
    // (e.g. "Menu", "ALL") gets appended after.
    const preferredOrder = ['Breakfast', 'Lunch', 'Dinner']
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

  // 2. Extract unique stations dynamically from raw menu data
  const availableStations = useMemo(() => {
    const stations = menu.map((entry) => getEffectiveStation(entry))
    return Array.from(new Set(stations))
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
      alert('Food logged successfully!')
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
      fetchTodayTotals()
      if (showCalendar) fetchHistoricalLogs() // Also sync up calendar dynamically
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
            className="w-9 h-9 rounded-full bg-white/10 border border-white/20 ml-1 flex items-center justify-center hover:bg-white/20 transition-colors active:scale-95"
            aria-label="Edit user profile"
          >
            <User size={18} className="text-[#c2c6d0]" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[150px] px-5 max-w-[1200px] mx-auto pb-[130px]">

        {/* Live macro totals banner */}
        <div className="rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5 shadow-[0_10px_40px_-10px_rgba(0,60,108,0.4)]">
          <div className="bg-white/5 p-3 rounded-xl text-center">
            <p className="font-['JetBrains_Mono'] text-[10px] font-semibold text-[#d8b61c] uppercase tracking-wider">Calories</p>
            <p className="text-xl font-black mt-1">{Math.round(totals.calories)} kcal</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl text-center">
            <p className="font-['JetBrains_Mono'] text-[10px] font-semibold text-[#5bb448] uppercase tracking-wider">Protein</p>
            <p className="text-xl font-black mt-1">{Math.round(totals.protein)}g</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl text-center">
            <p className="font-['JetBrains_Mono'] text-[10px] font-semibold text-[#bd5db8] uppercase tracking-wider">Carbs</p>
            <p className="text-xl font-black mt-1">{Math.round(totals.carbs)}g</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl text-center">
            <p className="font-['JetBrains_Mono'] text-[10px] font-semibold text-[#fb7185] uppercase tracking-wider">Fat</p>
            <p className="text-xl font-black mt-1">{Math.round(totals.fat)}g</p>
          </div>
        </div>

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
                  {DINING_HALLS.map(hall => <option key={hall} value={hall}>{hall}</option>)}
                </select>

                {availableMealTypes.length > 0 && !(hallStatus && !hallStatus.is_open) && (
                  <div className="flex bg-[#171f33] p-1.5 rounded-xl gap-1">
                    {availableMealTypes.map(meal => (
                      <button
                        key={meal}
                        onClick={() => setSelectedMeal(meal)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${selectedMeal === meal
                          ? 'bg-[#d6b93a] text-[#6b5300] shadow-md shadow-[#d6b93a]/20'
                          : 'text-[#c2c6d0] hover:text-[#dae2fd]'
                          }`}
                      >
                        {meal}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search + station filter pills */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <p className="font-['JetBrains_Mono'] text-[11px] font-bold text-[#c2c6d0] uppercase tracking-wider">Search & Station Filters</p>
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
                      return (
                        <button
                          key={station}
                          type="button"
                          onClick={() => handleToggleStationFilter(station)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${isActive
                            ? 'bg-[#d6b93a] text-[#6b5300] border-[#d6b93a] shadow-sm'
                            : 'bg-white/5 text-[#c2c6d0] hover:bg-white/10 border-white/15'
                            }`}
                        >
                          {cleanStationName(station)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Dining hall closed banner */}
            {hallStatus && !hallStatus.is_open && (
              <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/30 text-red-300 font-semibold text-sm text-center">
                Dining Hall is Closed
              </div>
            )}

            {/* Menu items — hidden entirely when the hall is closed with no scraped data */}
            {!(hallStatus && !hallStatus.is_open) && (
              <div className="rounded-2xl p-5 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5">
                <h2 className="text-lg font-bold mb-5 tracking-tight">Today's Menu ({selectedMeal})</h2>

                {loading ? (
                  <div className="py-12 text-center text-[#c2c6d0] font-medium">Loading items...</div>
                ) : Object.keys(groupedMenu).length === 0 ? (
                  <div className="py-12 text-center text-[#c2c6d0] font-medium">
                    {menu.length === 0
                      ? "No items found for this meal period today."
                      : "No menu items match your search or station filters."}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedMenu).map(([stationRaw, entries]) => (
                      <div key={stationRaw} className="space-y-3">
                        <div className="flex items-center">
                          <span className="font-['JetBrains_Mono'] text-xs font-black tracking-wider text-[#a1c9ff] uppercase bg-[#003c6c]/40 border border-[#a1c9ff]/20 px-3 py-1 rounded-lg">
                            {cleanStationName(stationRaw)}
                          </span>
                          <div className="flex-1 h-px bg-white/10 ml-4" />
                        </div>

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
                                  <div className="flex gap-3 mt-1.5 font-['JetBrains_Mono'] text-xs font-semibold text-[#c2c6d0]">
                                    <span className="text-[#a1c9ff] bg-[#a1c9ff]/10 px-2 py-0.5 rounded-md">Cals: {food.calories}</span>
                                    <span>P: {food.protein}g</span>
                                    <span>C: {food.carbs}g</span>
                                    <span>F: {food.fat}g</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
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
                                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isSelected
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
                                    className="rounded-lg bg-[#d6b93a] px-4 py-2 text-sm font-bold text-[#6b5300] transition hover:brightness-105 active:scale-95 shadow-md shadow-[#d6b93a]/20"
                                  >
                                    Log
                                  </button>
                                </div>
                              </article>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* PROGRESS TAB */
          <div className="space-y-6">
            <div className="rounded-2xl p-5 bg-[rgba(30,41,59,0.6)] backdrop-blur-2xl border-t border-l border-white/15 border-b border-r border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

                      <p className="font-['JetBrains_Mono'] text-sm font-black text-[#dae2fd] uppercase tracking-wider">
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

                    <div className="grid grid-cols-7 gap-2 mb-2 text-center font-['JetBrains_Mono'] text-xs font-extrabold text-[#c2c6d0]/70">
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
                        <div className="flex gap-2 mt-1 font-['JetBrains_Mono'] text-xs text-[#c2c6d0]">
                          <span>Cals: {Math.round((log.food_items?.calories || 0) * log.servings)}</span>
                          <span>P: {Math.round((log.food_items?.protein || 0) * log.servings)}g</span>
                          <span>C: {Math.round((log.food_items?.carbs || 0) * log.servings)}g</span>
                          <span>F: {Math.round((log.food_items?.fat || 0) * log.servings)}g</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#ffb4ab] bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 px-3 py-1.5 rounded-lg transition active:scale-95"
                      >
                        <Trash2 size={12} />
                        Delete
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
            <span className="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-wide">Log Menu</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center gap-1 py-1.5 px-7 rounded-xl transition-all ${activeTab === 'progress' ? 'text-[#ffe6ab] scale-105' : 'text-[#c2c6d0]/70 hover:text-[#dae2fd]'
              }`}
          >
            <LineChart size={22} strokeWidth={activeTab === 'progress' ? 2.5 : 2} />
            <span className="font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-wide">Progress</span>
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
          onClose={() => setIsProfileModalOpen(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  )
}