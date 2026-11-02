// web-app/lib/favoriteAlerts.ts
// Everything served at the five dining halls today (dish, hall, meal), so the
// Menu tab can say "Your favorite Chili is at Crown & Merrill for lunch".
// Fetched once per day and kept in memory.

import { createClient } from '@/lib/supabase'
import { favoriteKey } from '@/lib/favorites'

export interface TodayDish {
  name: string
  hall: string
  meal: string
}

export const MEAL_ORDER = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night']

let cache: { day: string; dishes: TodayDish[] } | null = null

export async function fetchTodayDishes(halls: string[], today: string): Promise<TodayDish[]> {
  if (cache && cache.day === today) return cache.dishes
  const supabase = createClient()
  const found = new Map<string, TodayDish>()

  // Pages of 1000, the API's per-request cap
  for (let from = 0; from < 6000; from += 1000) {
    const { data, error } = await supabase
      .from('daily_menus')
      .select('dining_hall, meal_type, food_items:food_item_id (name)')
      .eq('date', today)
      .in('dining_hall', halls)
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    const rows = (data ?? []) as unknown as {
      dining_hall: string
      meal_type: string
      food_items: { name: string } | { name: string }[] | null
    }[]
    for (const row of rows) {
      const food = Array.isArray(row.food_items) ? row.food_items[0] : row.food_items
      if (!food?.name) continue
      found.set(`${favoriteKey(food.name)}|${row.dining_hall}|${row.meal_type}`, {
        name: food.name,
        hall: row.dining_hall,
        meal: row.meal_type,
      })
    }
    if (rows.length < 1000) break
  }

  const dishes = Array.from(found.values())
  cache = { day: today, dishes }
  return dishes
}
