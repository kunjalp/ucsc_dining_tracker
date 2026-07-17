'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase' // Adjust path if needed
import { useRouter } from 'next/navigation'

interface FoodItem {
  name: string
  station: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  portion: string
  recipe_id: string
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  // --- State Variables ---
  const [loading, setLoading] = useState(true)
  const [diningHall, setDiningHall] = useState('John R. Lewis & College Nine Dining Hall')
  const [mealType, setMealType] = useState('Lunch') // Breakfast, Lunch, Dinner
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStation, setSelectedStation] = useState<string>('All') // 'All' or specific station
  const [menuItems, setMenuItems] = useState<FoodItem[]>([])
  
  // Macros trackers (for the top cards)
  const [trackedMacros, setTrackedMacros] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })

  // --- Check User Auth on Mount ---
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/') // Redirect to login page if unauthenticated
      }
    }
    checkAuth()
  }, [])

  // --- Fetch Menu Data on Settings Change ---
  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true)
      const todayStr = new Date().toISOString().split('T')[0]

      // Fetch from daily_menus joined with food_items matching your scraper schema
      const { data, error } = await supabase
        .from('daily_menus')
        .select(`
          station,
          food_items (
            recipe_id,
            name,
            portion,
            calories,
            protein,
            carbs,
            fat
          )
        `)
        .eq('dining_hall', diningHall)
        .eq('meal_type', mealType)
        .eq('date', todayStr)

      if (error) {
        console.error('Error fetching today\'s menu:', error)
        setMenuItems([])
      } else if (data) {
        // Map the database structure into a flat FoodItem array
        const formattedItems: FoodItem[] = data.map((row: any) => {
          const item = row.food_items
          return {
            recipe_id: item.recipe_id,
            name: item.name,
            portion: item.portion || '1 serving',
            calories: item.calories || 0,
            protein: item.protein || 0,
            carbs: item.carbs || 0,
            fat: item.fat || 0,
            station: row.station,
          }
        })
        setMenuItems(formattedItems)
      }
      setLoading(false)
    }

    fetchMenu()
  }, [diningHall, mealType])

  // --- Helper: Log and track item macros ---
  const handleLogItem = (item: FoodItem, quantity: number) => {
    setTrackedMacros((prev) => ({
      calories: Math.round(prev.calories + (item.calories * quantity)),
      protein: Math.round(prev.protein + (item.protein * quantity)),
      carbs: Math.round(prev.carbs + (item.carbs * quantity)),
      fat: Math.round(prev.fat + (item.fat * quantity)),
    }))
  }

  // --- Extract All Unique Stations for Filters ---
  const availableStations = ['All', ...Array.from(new Set(
    menuItems.map(item => item.station).filter((station): station is string => !!station)
  ))]

  // --- Dynamic Filtering Logic (Search Bar + Station Filters) ---
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStation = selectedStation === 'All' || item.station === selectedStation
    return matchesSearch && matchesStation
  })

  return (
    <div className="min-h-screen bg-gray-100 p-6 text-slate-800">
      <div className="mx-auto max-w-5xl space-y-6">
        
        {/* --- Top Search Bar Section --- */}
        <div className="relative w-full rounded-xl bg-white p-4 shadow-sm">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search food items... (e.g., Brownie, Tofu)"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* --- Tracked Macros Dashboard (Top Cards) --- */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 text-center shadow-sm">
            <span className="text-xs font-bold tracking-wider text-blue-500">CALORIES</span>
            <h3 className="mt-1 text-2xl font-black">{trackedMacros.calories} kcal</h3>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-sm">
            <span className="text-xs font-bold tracking-wider text-emerald-500">PROTEIN</span>
            <h3 className="mt-1 text-2xl font-black">{trackedMacros.protein}g</h3>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-sm">
            <span className="text-xs font-bold tracking-wider text-amber-500">CARBS</span>
            <h3 className="mt-1 text-2xl font-black">{trackedMacros.carbs}g</h3>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-sm">
            <span className="text-xs font-bold tracking-wider text-rose-500">FAT</span>
            <h3 className="mt-1 text-2xl font-black">{trackedMacros.fat}g</h3>
          </div>
        </div>

        {/* --- Select Dining Location & Meal Selectors --- */}
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Select Dining Location</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <select
              className="w-full rounded-lg border border-gray-200 p-3 outline-none focus:border-blue-500 sm:max-w-md"
              value={diningHall}
              onChange={(e) => {
                setDiningHall(e.target.value)
                setSelectedStation('All') // Reset station filter when changing hall
              }}
            >
              <option>John R. Lewis & College Nine Dining Hall</option>
              <option>Cowell & Stevenson Dining Hall</option>
              <option>Crown & Merrill Dining Hall</option>
              <option>Porter & Kresge Dining Hall</option>
              <option>Rachel Carson & Oakes Dining Hall</option>
            </select>

            <div className="flex rounded-lg bg-gray-100 p-1">
              {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
                <button
                  key={meal}
                  onClick={() => {
                    setMealType(meal)
                    setSelectedStation('All') // Reset station filter when changing meal type
                  }}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                    mealType === meal
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {meal}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --- Sub-Filter Section: UCSC Food Stations --- */}
        {availableStations.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-bold text-gray-500 mr-2">Filter by Station:</span>
            {availableStations.map((station) => (
              <button
                key={station}
                onClick={() => setSelectedStation(station)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium border transition ${
                  selectedStation === station
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {station}
              </button>
            ))}
          </div>
        )}

        {/* --- Today's Menu Display List --- */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">Today's Menu ({mealType})</h2>

          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading meals from UCSC Database...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No menu items match your current selection or search term.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredItems.map((item) => (
                <FoodItemRow key={item.recipe_id} item={item} onLog={handleLogItem} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// --- Individual Food Card Component ---
function FoodItemRow({ item, onLog }: { item: FoodItem; onLog: (item: FoodItem, qty: number) => void }) {
  const [quantity, setQuantity] = useState(1)

  return (
    <div className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-1">
        <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
        <p className="text-xs text-gray-400 font-medium">
          Serving Size: <span className="text-gray-600">{item.portion}</span> 
          {item.station && (
            <>
              {' '}| Station: <span className="text-blue-500 font-semibold">{item.station}</span>
            </>
          )}
        </p>
        
        {/* Macros Badges */}
        <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
          <span className="rounded bg-blue-50 text-blue-600 px-2 py-0.5">Cals: {item.calories}</span>
          <span className="text-gray-500">P: {item.protein}g</span>
          <span className="text-gray-500">C: {item.carbs}g</span>
          <span className="text-gray-500">F: {item.fat}g</span>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-3 self-end sm:self-center">
        <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50">
          <span className="text-xs font-bold text-gray-400 px-3">QTY</span>
          <input
            type="number"
            min="1"
            className="w-12 bg-transparent text-center font-bold outline-none py-1.5 border-l border-gray-200 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <button
          onClick={() => onLog(item, quantity)}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Log
        </button>
      </div>
    </div>
  )
}