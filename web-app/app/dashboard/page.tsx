'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

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

const DINING_HALLS = [
  "John R. Lewis & College Nine Dining Hall",
  "Cowell & Stevenson Dining Hall",
  "Crown & Merrill Dining Hall",
  "Porter & Kresge Dining Hall",
  "Rachel Carson & Oakes Dining Hall",
  "Stevenson Coffee House",
  "Perk Coffee Bar",
  "Merrill Market"
]

// Pure SVG Circular Progress Ring UI Component
interface ProgressRingProps {
  value: number
  goal: number
  colorClass: string
  trailColorClass: string
  textColorClass: string
  label: string
  unit: string
}

function ProgressRing({ value, goal, colorClass, trailColorClass, textColorClass, label, unit }: ProgressRingProps) {
  const radius = 50
  const stroke = 10
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
      <div className="relative flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            className={trailColorClass}
            strokeWidth={stroke}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            className={`${colorClass} transition-all duration-500 ease-out`}
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        
        <div className="absolute text-center">
          <span className="text-lg font-black tracking-tight text-slate-800">
            {goal > 0 ? Math.round((value / goal) * 100) : 0}%
          </span>
        </div>
      </div>

      <div className="text-center mt-3">
        <p className={`text-sm font-black ${textColorClass}`}>{label}</p>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">
          {Math.round(value)} / {goal} {unit}
        </p>
      </div>
    </div>
  )
}

// Mini-Ring Component for the Calendar cells
function MiniProgressRing({ value, goal, colorClass }: { value: number; goal: number; colorClass: string }) {
  const radius = 16
  const stroke = 4
  const normalizedRadius = radius - stroke
  const circumference = normalizedRadius * 2 * Math.PI
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
      <circle
        className="stroke-slate-100"
        strokeWidth={stroke}
        fill="transparent"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        className={`${colorClass} transition-all duration-300`}
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset }}
        strokeLinecap="round"
        fill="transparent"
        r={normalizedRadius}
        cx={radius}
        cy={radius}
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
  const [servings, setServings] = useState<{ [key: string]: number }>({})

  // SEARCH & STATION FILTER STATES
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStationFilters, setActiveStationFilters] = useState<string[]>([])

  // Daily targets state settings (now tracking all 4 macro targets)
  const [goalCalories, setGoalCalories] = useState(2000)
  const [goalProtein, setGoalProtein] = useState(120)
  const [goalCarbs, setGoalCarbs] = useState(250)
  const [goalFat, setGoalFat] = useState(70)
  const [isEditingGoals, setIsEditingGoals] = useState(false)

  // Calendar View State
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMacro, setCalendarMacro] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories')
  const [historicalLogs, setHistoricalLogs] = useState<MealLog[]>([])
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())

  // Daily logs and totals tracking state
  const [loggedMeals, setLoggedMeals] = useState<MealLog[]>([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })

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

  useEffect(() => {
    fetchTodayMenu()
    fetchTodayTotals()
  }, [selectedHall, selectedMeal])

  // Fetch all history whenever the calendar view gets activated
  useEffect(() => {
    if (showCalendar) {
      fetchHistoricalLogs()
    }
  }, [showCalendar])

  // Process manual configurations save
  const handleSaveGoals = (cals: number, prot: number, carbs: number, fat: number) => {
    setGoalCalories(cals)
    setGoalProtein(prot)
    setGoalCarbs(carbs)
    setGoalFat(fat)
    localStorage.setItem('ucsc_goal_calories', String(cals))
    localStorage.setItem('ucsc_goal_protein', String(prot))
    localStorage.setItem('ucsc_goal_carbs', String(carbs))
    localStorage.setItem('ucsc_goal_fat', String(fat))
    setIsEditingGoals(false)
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

  // Helper utility to strip leading and trailing hyphens from database stations (e.g. "-- Grill --" -> "Grill")
  const cleanStationName = (rawName: string) => {
    if (!rawName) return 'General'
    return rawName.replace(/--/g, '').trim()
  }

  // 2. Extract unique stations dynamically from raw menu data
  const availableStations = useMemo(() => {
    const stations = menu.map((entry) => entry.station).filter(Boolean)
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
        activeStationFilters.includes(entry.station)

      return matchesSearch && matchesStation
    })
  }, [menu, searchQuery, activeStationFilters])

  // 4. Group filtered results into station headers (UCSC Style)
  const groupedMenu = useMemo(() => {
    const groups: { [station: string]: MenuEntry[] } = {}
    
    filteredMenu.forEach((entry) => {
      const stationKey = entry.station || '-- General --'
      if (!groups[stationKey]) {
        groups[stationKey] = []
      }
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
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER & LIVE CALORIE METRICS BANNER */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50/50 p-4 rounded-xl text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Calories</p>
            <p className="text-2xl font-black mt-1 text-blue-950">{Math.round(totals.calories)} kcal</p>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl text-center">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Protein</p>
            <p className="text-2xl font-black mt-1 text-emerald-950">{Math.round(totals.protein)}g</p>
          </div>
          <div className="bg-amber-50/50 p-4 rounded-xl text-center">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Carbs</p>
            <p className="text-2xl font-black mt-1 text-amber-950">{Math.round(totals.carbs)}g</p>
          </div>
          <div className="bg-rose-50/50 p-4 rounded-xl text-center">
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Fat</p>
            <p className="text-2xl font-black mt-1 text-rose-950">{Math.round(totals.fat)}g</p>
          </div>
        </div>

        {/* TAB SWITCHER ROUTER RENDER CONTENT */}
        {activeTab === 'log' ? (
          <div className="space-y-6">
            {/* MENU CONTROLS / SELECTION */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Select Dining Location</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <select 
                  value={selectedHall} 
                  onChange={(e) => setSelectedHall(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 p-3 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {DINING_HALLS.map(hall => <option key={hall} value={hall}>{hall}</option>)}
                </select>

                <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
                  {['Breakfast', 'Lunch', 'Dinner'].map(meal => (
                    <button
                      key={meal}
                      onClick={() => setSelectedMeal(meal)}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${selectedMeal === meal ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>

              {/* DYNAMIC UCSC STATION FILTERING PANEL */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search & Station Filters</p>
                <div className="flex flex-col gap-3">
                  {/* Search Input Bar */}
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Search today's items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 bg-white text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400"
                    />
                  </div>

                  {/* UCSC Station Toggle Pills */}
                  {availableStations.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {availableStations.map((station) => {
                        const isActive = activeStationFilters.includes(station)
                        return (
                          <button
                            key={station}
                            type="button"
                            onClick={() => handleToggleStationFilter(station)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
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
            </div>

            {/* DINING HALL ITEMS RENDER CONTAINER */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-6 tracking-tight">Today's Menu ({selectedMeal})</h2>

              {loading ? (
                <div className="py-12 text-center text-slate-400 font-medium">Loading items...</div>
              ) : Object.keys(groupedMenu).length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium">
                  {menu.length === 0 
                    ? "No items found for this meal period today." 
                    : "No menu items match your search or station filters."}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Render grouped items by Station Headers */}
                  {Object.entries(groupedMenu).map(([stationRaw, entries]) => (
                    <div key={stationRaw} className="space-y-3">
                      
                      {/* Station Header Pill (Matching UCSC Layout) */}
                      <div className="flex items-center">
                        <span className="text-xs font-black tracking-wider text-blue-600 uppercase bg-blue-50/70 border border-blue-100/50 px-3 py-1 rounded-lg">
                          {cleanStationName(stationRaw)}
                        </span>
                        <div className="flex-1 h-[1px] bg-slate-100 ml-4"></div>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white">
                        {entries.map((entry) => {
                          const food = entry.food_items
                          if (!food) return null
                          return (
                            <div key={food.recipe_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-slate-900">{food.name}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Serving Size: {food.portion || '1 serving'}
                                </p>
                                <div className="flex gap-3 mt-1.5 text-xs font-semibold text-slate-500">
                                  <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Cals: {food.calories}</span>
                                  <span>P: {food.protein}g</span>
                                  <span>C: {food.carbs}g</span>
                                  <span>F: {food.fat}g</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200/50">
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
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                          isSelected 
                                            ? 'bg-white text-blue-600 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    )
                                  })}
                                </div>
                                <button
                                  onClick={() => handleLogFood(food.recipe_id)}
                                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-95"
                                >
                                  Log
                                </button>
                              </div>

                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PROGRESS & HISTORY VIEW TAB SECTION */
          <div className="space-y-6">
            
            {/* PROGRESS BREAKDOWN CONTAINER */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    {showCalendar ? 'Past Rings Calendar' : "Today's Progress Breakdown"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {showCalendar ? 'Toggle metrics to analyze historical streaks' : 'Review live goals achieved today'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Calendar Toggle Button */}
                  <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition border ${
                      showCalendar 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    {showCalendar ? 'View Today\'s Rings' : 'History Calendar'}
                  </button>

                  <button
                    onClick={() => setIsEditingGoals(!isEditingGoals)}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
                  >
                    {isEditingGoals ? 'Cancel' : 'Set Targets'}
                  </button>
                </div>
              </div>

              {/* Editable Setup Input Widget Panel */}
              {isEditingGoals && (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleSaveGoals(
                      Number(formData.get('calories') || goalCalories),
                      Number(formData.get('protein') || goalProtein),
                      Number(formData.get('carbs') || goalCarbs),
                      Number(formData.get('fat') || goalFat)
                    );
                  }}
                  className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 items-end animate-fadeIn"
                >
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Calories (kcal)</label>
                    <input 
                      type="number" 
                      name="calories" 
                      defaultValue={goalCalories}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Protein (g)</label>
                    <input 
                      type="number" 
                      name="protein" 
                      defaultValue={goalProtein}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Carbs (g)</label>
                    <input 
                      type="number" 
                      name="carbs" 
                      defaultValue={goalCarbs}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fat (g)</label>
                    <input 
                      type="number" 
                      name="fat" 
                      defaultValue={goalFat}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none" 
                    />
                  </div>
                  <button 
                    type="submit"
                    className="col-span-2 sm:col-span-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition"
                  >
                    Save Target Goals
                  </button>
                </form>
              )}

              {/* DYNAMIC VIEW SWAPPER */}
              {!showCalendar ? (
                /* VIEW A: Standard Daily Rings */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ProgressRing
                    value={totals.calories}
                    goal={goalCalories}
                    colorClass="stroke-blue-600"
                    trailColorClass="stroke-slate-100"
                    textColorClass="text-blue-600"
                    label="Calories"
                    unit="kcal"
                  />

                  <ProgressRing
                    value={totals.protein}
                    goal={goalProtein}
                    colorClass="stroke-emerald-600"
                    trailColorClass="stroke-slate-100"
                    textColorClass="text-emerald-600"
                    label="Protein"
                    unit="g"
                  />

                  <ProgressRing
                    value={totals.carbs}
                    goal={goalCarbs}
                    colorClass="stroke-amber-500"
                    trailColorClass="stroke-slate-100"
                    textColorClass="text-amber-500"
                    label="Carbs"
                    unit="g"
                  />

                  <ProgressRing
                    value={totals.fat}
                    goal={goalFat}
                    colorClass="stroke-rose-500"
                    trailColorClass="stroke-slate-100"
                    textColorClass="text-rose-500"
                    label="Fat"
                    unit="g"
                  />
                </div>
              ) : (
                /* VIEW B: Interactive Calendar View with custom filters */
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Expanded Macro Selector (All 4 categories) */}
                  <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1 overflow-x-auto">
                    {[
                      { key: 'calories', label: 'Calories', activeClass: 'bg-blue-600 text-white shadow-sm' },
                      { key: 'protein', label: 'Protein', activeClass: 'bg-emerald-600 text-white shadow-sm' },
                      { key: 'carbs', label: 'Carbs', activeClass: 'bg-amber-500 text-white shadow-sm' },
                      { key: 'fat', label: 'Fat', activeClass: 'bg-rose-500 text-white shadow-sm' }
                    ].map((macro) => (
                      <button
                        key={macro.key}
                        type="button"
                        onClick={() => setCalendarMacro(macro.key as any)}
                        className={`flex-1 py-1.5 px-3 text-xs font-black rounded-lg transition-all whitespace-nowrap ${
                          calendarMacro === macro.key 
                            ? macro.activeClass 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {macro.label}
                      </button>
                    ))}
                  </div>

                  {/* Monthly Calendar Grid Display */}
                  <div>
                    {/* Month label + Previous/Next navigation */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={goToPreviousMonth}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                        aria-label="Previous month"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>

                      <p className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        {calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>

                      <button
                        type="button"
                        onClick={goToNextMonth}
                        disabled={isCurrentMonth}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        aria-label="Next month"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>

                    {/* Day labels header */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-extrabold text-slate-400">
                      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>

                    {/* Dates Cells with Mini-Rings inside */}
                    <div className="grid grid-cols-7 gap-2">
                      {getCalendarDays().map((cell, index) => {
                        if (!cell.dayNum || !cell.dateString) {
                          return <div key={`empty-${index}`} className="aspect-square bg-slate-100/50 rounded-xl"></div>
                        }

                        // Calculate sums for this date cell dynamically
                        const dayStats = getHistoricalSumForDate(cell.dateString)
                        
                        // Select target/actual details dynamically depending on macro toggle
                        let actualVal = 0
                        let targetedGoal = 1
                        let dynamicColor = 'stroke-blue-600'
                        let unit = 'kcal'

                        if (calendarMacro === 'calories') {
                          actualVal = dayStats.calories
                          targetedGoal = goalCalories
                          dynamicColor = 'stroke-blue-600'
                          unit = 'kcal'
                        } else if (calendarMacro === 'protein') {
                          actualVal = dayStats.protein
                          targetedGoal = goalProtein
                          dynamicColor = 'stroke-emerald-600'
                          unit = 'g'
                        } else if (calendarMacro === 'carbs') {
                          actualVal = dayStats.carbs
                          targetedGoal = goalCarbs
                          dynamicColor = 'stroke-amber-500'
                          unit = 'g'
                        } else if (calendarMacro === 'fat') {
                          actualVal = dayStats.fat
                          targetedGoal = goalFat
                          dynamicColor = 'stroke-rose-500'
                          unit = 'g'
                        }

                        return (
                          <div 
                            key={cell.dateString} 
                            className="aspect-square bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-between p-1.5 hover:bg-slate-100/50 transition relative group"
                          >
                            <span className="text-xs font-black text-slate-500">{cell.dayNum}</span>
                            
                            {/* SVG Mini Ring */}
                            <MiniProgressRing 
                              value={actualVal} 
                              goal={targetedGoal} 
                              colorClass={dynamicColor} 
                            />

                            {/* Tooltip on hovering cell */}
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-md">
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

            {/* MEAL HISTORY LOGS ARCHIVE LIST */}
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
              <h2 className="text-xl font-bold tracking-tight mb-4">Everything Logged Today</h2>

              {loggedMeals.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium">
                  You haven't logged any foods today yet. Go back to the Log tab to add meals!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {loggedMeals.map((log) => (
                    <div key={log.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-slate-900">{log.food_items?.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {log.dining_hall} • <span className="capitalize">{log.meal_type}</span> • {log.servings}x serving(s)
                        </p>
                        <div className="flex gap-2 mt-1 text-xs text-slate-500">
                          <span>Cals: {Math.round((log.food_items?.calories || 0) * log.servings)}</span>
                          <span>P: {Math.round((log.food_items?.protein || 0) * log.servings)}g</span>
                          <span>C: {Math.round((log.food_items?.carbs || 0) * log.servings)}g</span>
                          <span>F: {Math.round((log.food_items?.fat || 0) * log.servings)}g</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-xs font-semibold text-rose-500 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* STICKY BOTTOM FIXED DASHBOARD PLATFORM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200/80 shadow-lg py-3 px-6 z-50">
        <div className="max-w-md mx-auto flex justify-around">
          
          <button
            onClick={() => setActiveTab('log')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
              activeTab === 'log' 
                ? 'text-blue-600 scale-105 font-bold' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-xs">Log Menu</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all ${
              activeTab === 'progress' 
                ? 'text-blue-600 scale-105 font-bold' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span className="text-xs">Progress</span>
          </button>

        </div>
      </div>
    </div>
  )
}
