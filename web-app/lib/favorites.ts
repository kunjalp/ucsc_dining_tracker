// web-app/lib/favorites.ts
// Favorite foods. Saved like the other profile settings: Supabase
// user_metadata.favorites (follows the student across devices) plus
// localStorage (instant on load). A favorite is the dish's lower-cased name,
// not a recipe_id, because the same dish has a different recipe_id in each
// dining hall -- hearting "Roasted Broccoli" at one hall hearts it everywhere.

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase'

export const FAVORITES_STORAGE_KEY = 'ucsc_favorites'
// user_metadata travels in the auth token, so keep it small
const MAX_FAVORITES = 300

export const favoriteKey = (name: string): string => name.trim().toLowerCase()

const listeners = new Set<() => void>()

function readLocal(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

// Replaced (never mutated) on every change so useSyncExternalStore sees a new snapshot
let current: ReadonlySet<string> = new Set()
let hydrated = false

function writeLocal(next: ReadonlySet<string>) {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)))
  } catch {
    // Private mode / storage blocked: still works for this visit
  }
}

function set(next: ReadonlySet<string>) {
  current = next
  writeLocal(next)
  listeners.forEach((notify) => notify())
}

function ensureHydrated() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  current = readLocal()
}

// The account's list wins (it may have been changed on another device)
export function loadFavoritesFromAccount(saved: unknown) {
  hydrated = true
  const list = Array.isArray(saved) ? saved.filter((v): v is string => typeof v === 'string') : []
  set(new Set(list.slice(0, MAX_FAVORITES)))
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  // Wait for a pause in tapping hearts, then save once
  saveTimer = setTimeout(async () => {
    saveTimer = null
    try {
      await createClient().auth.updateUser({ data: { favorites: Array.from(current) } })
    } catch {
      // Offline: it's still saved on this device
    }
  }, 700)
}

/** Returns true if the dish is now a favorite. */
export function toggleFavorite(name: string): boolean {
  ensureHydrated()
  const key = favoriteKey(name)
  const next = new Set(current)
  let nowFavorite: boolean
  if (next.has(key)) {
    next.delete(key)
    nowFavorite = false
  } else {
    if (next.size >= MAX_FAVORITES) return false
    next.add(key)
    nowFavorite = true
  }
  set(next)
  scheduleSave()
  return nowFavorite
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const onStorage = (e: StorageEvent) => {
    if (e.key === FAVORITES_STORAGE_KEY) {
      current = readLocal()
      onChange()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

const EMPTY: ReadonlySet<string> = new Set()

export function useFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureHydrated()
      return current
    },
    () => EMPTY
  )
}
