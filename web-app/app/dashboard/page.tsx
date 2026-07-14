'use client'

import { useEffect, useState } from 'react'
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

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [menu, setMenu] = useState<MenuEntry[]>([])
  const [selectedHall, setSelectedHall] = useState(DINING_HALLS[0])
  const [selectedMeal, setSelectedMeal] = useState('Breakfast')
  const [servings, setServings] = useState<{ [key: string]: number }>({})

  // Daily totals tracking state
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })

  useEffect(() => {
    fetchTodayMenu()
    fetchTodayTotals()
  }, [selectedHall, selectedMeal])

  // 1. Fetch items scraped for today matching the selected Hall and Meal
  const fetchTodayMenu = async () => {
    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]

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

  // 2. Fetch what the user logged today to sum up live tracker macros
  const fetchTodayTotals = async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    
    // Grab user session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('meal_logs')
      .select(`
        servings,
        food_items:food_item_id (calories, protein, carbs, fat)
      `)
      .eq('user_id', user.id)
      .eq('log_date', todayStr)

    if (!error && data) {
      const runningTotals = data.reduce((acc, log: any) => {
        const item = log.food_items
        const s = Number(log.servings)
        if (item) {
          acc.calories += (item.calories || 0) * s
          acc.protein += (item.protein || 0) * s
          acc.carbs += (item.carbs || 0) * s
          acc.fat += (item.fat || 0) * s
        }
        return acc
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

      setTotals(runningTotals)
    }
  }

  // 3. Log an item to Supabase meal_logs table
  const handleLogFood = async (foodId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return alert('Please sign in first!')

    const count = servings[foodId] || 1

    const { error } = await supabase
      .from('meal_logs')
      .insert({
        user_id: user.id,
        food_item_id: foodId,
        dining_hall: selectedHall,
        meal_type: selectedMeal,
        servings: count
      })

    if (error) {
      alert(`Logging failed: ${error.message}`)
    } else {
      alert('Food logged successfully!')
      fetchTodayTotals() // Refresh daily banner totals cleanly
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
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
        </div>

        {/* DINING HALL ITEMS RENDER CONTAINER */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 tracking-tight">Today's Menu ({selectedMeal})</h2>

          {loading ? (
            <div className="py-12 text-center text-slate-400 font-medium">Loading items...</div>
          ) : menu.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium">No items found for this meal period today. Make sure your scraper script ran today!</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {menu.map((entry) => {
                const food = entry.food_items
                if (!food) return null
                return (
                  <div key={food.recipe_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{food.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Serving Size: {food.portion || '1 serving'} | Station: <span className="font-medium text-slate-500">{entry.station || 'General'}</span></p>
                      <div className="flex gap-3 mt-1.5 text-xs font-semibold text-slate-500">
                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Cals: {food.calories}</span>
                        <span>P: {food.protein}g</span>
                        <span>C: {food.carbs}g</span>
                        <span>F: {food.fat}g</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <span className="px-2.5 text-xs text-slate-400 font-bold uppercase">Qty</span>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={servings[food.recipe_id] || 1}
                          onChange={(e) => setServings({ ...servings, [food.recipe_id]: parseFloat(e.target.value) || 1 })}
                          className="w-12 border-l border-slate-200 p-1.5 text-center text-sm font-semibold bg-white focus:outline-none"
                        />
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
          )}
        </div>

      </div>
    </div>
  )
}