// web-app/lib/recipeShare.ts
// Sharing a recipe without any server storage: the recipe's name and its
// ingredient ids + servings are packed into a short code, carried in a link
// (…/dashboard?recipe=CODE) or pasted in directly. The receiving app never
// trusts the code for nutrition: it re-reads each ingredient's macros from
// food_items, so a doctored code can't claim fake numbers.

import { createClient } from '@/lib/supabase'
import { MAX_RECIPE_ITEMS, MAX_RECIPE_NAME, RECIPE_SERVING_STEPS, type RecipeItem } from '@/lib/recipes'

export const PENDING_RECIPE_STORAGE_KEY = 'ucsc_pending_recipe'
const MAX_CODE_LENGTH = 4000
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/

interface SharePayload {
  v: 1
  n: string
  i: [string, number][]
}

export interface SharedEntry {
  id: string
  servings: number
}

export interface DecodedRecipe {
  name: string
  entries: SharedEntry[]
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): Uint8Array {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function encodeRecipe(name: string, items: RecipeItem[]): string {
  const payload: SharePayload = {
    v: 1,
    n: name.trim().slice(0, MAX_RECIPE_NAME),
    i: items.slice(0, MAX_RECIPE_ITEMS).map((i) => [i.recipe_id, i.servings]),
  }
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

export function shareUrl(code: string): string {
  return `${window.location.origin}/dashboard?recipe=${code}`
}

/** Accepts a whole link, a "recipe=CODE" fragment or a bare code. */
export function extractCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/[?&]recipe=([A-Za-z0-9_-]+)/)
  if (match) return match[1]
  // Last whitespace-separated word, in case the share text was pasted
  const words = trimmed.split(/\s+/)
  return words[words.length - 1].replace(/[^A-Za-z0-9_-]/g, '')
}

const snapServings = (n: number): number =>
  RECIPE_SERVING_STEPS.reduce((best, step) => (Math.abs(step - n) < Math.abs(best - n) ? step : best), 1)

/** Returns null unless the code is a well-formed recipe. */
export function decodeRecipe(code: string): DecodedRecipe | null {
  if (!code || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(code))) as Partial<SharePayload>
    if (payload.v !== 1 || typeof payload.n !== 'string' || !Array.isArray(payload.i)) return null
    const name = payload.n.trim().slice(0, MAX_RECIPE_NAME)
    if (!name || payload.i.length === 0 || payload.i.length > MAX_RECIPE_ITEMS) return null
    const entries: SharedEntry[] = []
    for (const row of payload.i) {
      if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'number') return null
      if (!ID_PATTERN.test(row[0]) || !Number.isFinite(row[1]) || row[1] <= 0 || row[1] > 20) return null
      entries.push({ id: row[0], servings: snapServings(row[1]) })
    }
    return { name, entries }
  } catch {
    return null
  }
}

/** Looks up each ingredient's real nutrition. Ingredients that no longer exist are skipped. */
export async function loadSharedItems(entries: SharedEntry[]): Promise<{ items: RecipeItem[]; missing: number }> {
  const { data, error } = await createClient()
    .from('food_items')
    .select('recipe_id, name, portion, calories, protein, carbs, sugar, fat')
    .in('recipe_id', entries.map((e) => e.id))
  if (error) throw error
  const byId = new Map((data ?? []).map((f) => [String(f.recipe_id), f]))
  const items: RecipeItem[] = []
  for (const entry of entries) {
    const f = byId.get(entry.id)
    if (!f) continue
    items.push({
      recipe_id: String(f.recipe_id),
      name: String(f.name),
      portion: f.portion ? String(f.portion) : '1 serving',
      servings: entry.servings,
      calories: Number(f.calories) || 0,
      protein: Number(f.protein) || 0,
      carbs: Number(f.carbs) || 0,
      fat: Number(f.fat) || 0,
      sugar: Number(f.sugar) || 0,
    })
  }
  return { items, missing: entries.length - items.length }
}
