// web-app/lib/recipes.ts
// Saved recipes: a named group of dining hall items with serving sizes (a
// student's usual sandwich, say). Stored in the saved_recipes table (see
// web-app/supabase/saved_recipes.sql), one private row set per student.
// Each item keeps a snapshot of its macros so a recipe still logs correctly
// if the dish later disappears from the menus.

import { createClient } from '@/lib/supabase'

export interface RecipeItem {
  recipe_id: string // the food_items id logged for this ingredient
  name: string
  portion: string
  servings: number
  calories: number
  protein: number
  carbs: number
  fat: number
  sugar: number
}

export interface Recipe {
  id: string
  name: string
  items: RecipeItem[]
  created_at: string
}

export const MAX_RECIPES = 50
export const MAX_RECIPE_ITEMS = 30
export const MAX_RECIPE_NAME = 60
export const RECIPE_SERVING_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4]

export function recipeTotals(items: RecipeItem[]) {
  return items.reduce(
    (t, i) => ({
      calories: t.calories + (i.calories || 0) * i.servings,
      protein: t.protein + (i.protein || 0) * i.servings,
      carbs: t.carbs + (i.carbs || 0) * i.servings,
      fat: t.fat + (i.fat || 0) * i.servings,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

// The table hasn't been created in Supabase yet
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    (/saved_recipes/i.test(error.message ?? '') && /not find|does not exist/i.test(error.message ?? ''))
  )
}

export async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await createClient()
    .from('saved_recipes')
    .select('id, name, items, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Recipe[]
}

export async function saveRecipe(id: string | null, name: string, items: RecipeItem[]): Promise<void> {
  const supabase = createClient()
  const cleanName = name.trim().slice(0, MAX_RECIPE_NAME)
  if (id) {
    const { error } = await supabase
      .from('saved_recipes')
      .update({ name: cleanName, items, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('saved_recipes').insert({ name: cleanName, items })
    if (error) throw error
  }
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await createClient().from('saved_recipes').delete().eq('id', id)
  if (error) throw error
}
