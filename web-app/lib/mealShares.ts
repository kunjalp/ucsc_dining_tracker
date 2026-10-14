// lib/mealShares.ts
//
// Sizes "Close my rings" suggestions for one meal period instead of the
// whole rest of the day. Each meal gets a share of the day; the selected
// meal gets its share of what's left among itself and the later meals the
// hall actually serves. Edit the numbers here to rebalance.

import type { Macros } from './mealSuggestions'

// Fraction of the day's targets each meal period is meant to cover
export const MEAL_SHARES = {
  Breakfast: 0.25,
  Lunch: 0.35,
  Dinner: 0.35,
  'Late Night': 0.05,
} as const

type SharedMeal = keyof typeof MEAL_SHARES
const MEAL_ORDER: SharedMeal[] = ['Breakfast', 'Lunch', 'Dinner', 'Late Night']

// Items per suggested combo, by meal
export interface ComboSize {
  min: number
  max: number
}
export const MEAL_COMBO_SIZES: Record<SharedMeal, ComboSize> = {
  Breakfast: { min: 2, max: 3 },
  Lunch: { min: 3, max: 4 },
  Dinner: { min: 3, max: 4 },
  'Late Night': { min: 1, max: 2 },
}
// "Rest of day" (the original behavior) and anything without a share
export const DAY_COMBO_SIZE: ComboSize = { min: 2, max: 4 }
// Brunch covers both of its meals' item counts
const BRUNCH_COMBO_SIZE: ComboSize = { min: 2, max: 4 }

// A suggested meal should be at least this big, unless less is left
export const MIN_MEAL_CALORIES = 100

// The share-table meals a meal label stands for. Brunch is Breakfast +
// Lunch; anything else (a cafe's "Menu"/"ALL") has no share.
export function mealParts(meal: string): SharedMeal[] {
  if (meal === 'Brunch') return ['Breakfast', 'Lunch']
  return (MEAL_ORDER as string[]).includes(meal) ? [meal as SharedMeal] : []
}

export function comboSizeFor(meal: string): ComboSize {
  if (meal === 'Brunch') return BRUNCH_COMBO_SIZE
  const parts = mealParts(meal)
  return parts.length === 1 ? MEAL_COMBO_SIZES[parts[0]] : DAY_COMBO_SIZE
}

export interface MealTarget {
  target: Macros
  // Fraction of what was left before this meal that it gets (1 = all of it)
  fraction: number
}

/**
 * This meal's target, or null when the meal has no share (cafes).
 * `remaining` is the day's targets minus everything logged today, including
 * `loggedThisMeal`. The meal's share is taken of what was left *before*
 * this meal's logs, and then those logs are subtracted -- so eating part of
 * lunch shrinks lunch's target rather than every later meal's.
 */
export function mealTarget(
  remaining: Macros,
  meal: string,
  availableMeals: string[],
  loggedThisMeal: Macros
): MealTarget | null {
  const parts = mealParts(meal)
  if (parts.length === 0) return null
  const lastPart = Math.max(...parts.map((m) => MEAL_ORDER.indexOf(m)))
  const served = new Set(availableMeals.flatMap(mealParts))
  const later = MEAL_ORDER.filter((m, i) => i > lastPart && served.has(m))
  const share = parts.reduce((sum, m) => sum + MEAL_SHARES[m], 0)
  const laterShare = later.reduce((sum, m) => sum + MEAL_SHARES[m], 0)
  // Last meal the hall serves: it gets everything that's left
  const fraction = later.length === 0 ? 1 : share / (share + laterShare)
  const forMeal = (k: keyof Macros) => Math.max(0, (remaining[k] + loggedThisMeal[k]) * fraction - loggedThisMeal[k])
  return {
    target: { calories: forMeal('calories'), protein: forMeal('protein'), carbs: forMeal('carbs'), fat: forMeal('fat') },
    fraction,
  }
}
