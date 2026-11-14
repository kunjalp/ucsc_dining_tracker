'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Haptics } from '@capacitor/haptics'
import { createClient } from '@/lib/supabase'
import { classifyByName } from '@/lib/stationClassifier'
import Sammy from '../components/Sammy'
import { revealBelowStickyBar } from '@/lib/stickyClear'
import BottomSheet, { SheetCloseButton } from '../components/BottomSheet'
import FoodRow, { SERVING_OPTIONS } from '../components/FoodRow'
import FiltersSheet, { FiltersButton } from '../components/FiltersSheet'
import { favoriteKey, useFavorites } from '@/lib/favorites'

// Everything the Browse tab needs to show, filter and log an item. Matches
// the FoodItem shape on the dashboard page (the page passes its own through).
export interface BrowseFood {
  recipe_id: string
  name: string
  portion: string
  calories: number
  protein: number
  carbs: number
  sugar: number
  fat: number
  ingredients?: string | null
  allergens?: string | null
  dietary_tags?: string[] | null
}

export interface BrowseItem {
  food: BrowseFood
  halls: string[] // dining halls (in the app's usual order) that have served it
  stations: string[] // stations it has been served at, e.g. "Grill"
  onToday: boolean
  todayHalls: string[]
}

export interface BrowseLogContext {
  hall: string
  meal: string
}

interface BrowseTabProps {
  /** The five real dining halls only -- never cafes or markets */
  diningHalls: string[]
  dietaryPreferences: string[]
  foodMatchesDietaryPreference: (food: BrowseFood, pref: string) => boolean
  dietChipLabel: string
  /** Meal period the student is likely eating right now */
  defaultMeal: string
  justLogged: Record<string, boolean>
  onLog: (food: BrowseFood, servings: number, ctx: BrowseLogContext) => Promise<boolean> | void
  onOpenDetail: (food: BrowseFood, servings: number, ctx: BrowseLogContext) => void
  onServingPreview: (food: BrowseFood, servings: number) => void
}

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Late Night']
const PAGE_SIZE = 40
const DB_PAGE = 1000
const ID_CHUNK = 100

type SortKey = 'az' | 'protein' | 'calories' | 'today'
const SORT_LABELS: Record<SortKey, string> = {
  az: 'A to Z',
  protein: 'Most protein',
  calories: 'Fewest calories',
  today: 'On today’s menu',
}

const shortHall = (hall: string) => hall.replace(/ Dining Hall$/, '')
// Same cleanup the Menu tab applies to scraped station names ("-- Grill --")
const cleanStation = (raw: string) => raw.replace(/--/g, '').trim()

// --- Loading the catalogue -------------------------------------------------
// Fast path: the browse_items() Postgres function (web-app/supabase/
// browse_items.sql) returns every dish, already merged, in ONE request.
// Fallback: if that function hasn't been created yet, page through
// daily_menus like before (slow, but it works).
// The result is kept in memory and in localStorage, so reopening Browse is
// instant and refreshes quietly in the background.

const CACHE_KEY = 'ucsc_browse_catalogue_v1'
const FRESH_MS = 30 * 60 * 1000

let catalogueCache: BrowseItem[] | null = null
let catalogueDay = ''
let catalogueSavedAt = 0
let catalogueRequest: Promise<BrowseItem[]> | null = null

interface RawItem {
  food: BrowseFood
  halls: string[]
  todayHalls: string[]
  stations: string[]
}

function todayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

function readStored() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { day?: string; savedAt?: number; items?: BrowseItem[] }
    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      catalogueCache = parsed.items
      catalogueDay = parsed.day ?? ''
      catalogueSavedAt = parsed.savedAt ?? 0
    }
  } catch {
    // Corrupt or blocked storage: just load fresh
  }
}

function writeStored() {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ day: catalogueDay, savedAt: catalogueSavedAt, items: catalogueCache })
    )
  } catch {
    // Storage full or blocked: the in-memory copy still works
  }
}

/** What's already available without a network request (memory, then this device). */
export function peekCatalogue(): BrowseItem[] | null {
  if (!catalogueCache) readStored()
  return catalogueCache
}

export function clearCatalogue() {
  catalogueCache = null
  catalogueDay = ''
  catalogueSavedAt = 0
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}

async function fetchRaw(diningHalls: string[]): Promise<RawItem[]> {
  const supabase = createClient()

  // Fast path
  const rpc = await supabase.rpc('browse_items')
  if (!rpc.error && Array.isArray(rpc.data)) {
    type RpcRow = BrowseFood & { halls: string[] | null; today_halls: string[] | null; stations: string[] | null }
    return (rpc.data as RpcRow[]).map((row) => {
      const { halls, today_halls, stations, ...food } = row
      return {
        food: food as BrowseFood,
        halls: (halls ?? []).filter((h) => diningHalls.includes(h)),
        todayHalls: (today_halls ?? []).filter((h) => diningHalls.includes(h)),
        stations: stations ?? [],
      }
    })
  }

  // Fallback: page through daily_menus (function not created yet)
  const today = todayLA()
  const base = () =>
    supabase
      .from('daily_menus')
      .select('food_item_id, dining_hall, date, station', { count: 'exact' })
      .in('dining_hall', diningHalls)
      .order('date', { ascending: false })
      .order('id', { ascending: true })

  const first = await base().range(0, DB_PAGE - 1)
  if (first.error) throw first.error
  type MenuRow = { food_item_id: string | null; dining_hall: string; date: string; station: string | null }
  const rows: MenuRow[] = [...((first.data ?? []) as MenuRow[])]
  const total = first.count ?? rows.length
  const starts: number[] = []
  for (let st = DB_PAGE; st < total; st += DB_PAGE) starts.push(st)
  for (let i = 0; i < starts.length; i += 6) {
    const batch = await Promise.all(starts.slice(i, i + 6).map((st) => base().range(st, st + DB_PAGE - 1)))
    for (const res of batch) {
      if (res.error) throw res.error
      rows.push(...((res.data ?? []) as MenuRow[]))
    }
  }

  const servedBy = new Map<string, { halls: Set<string>; todayHalls: Set<string>; stations: Set<string> }>()
  for (const r of rows) {
    if (!r.food_item_id) continue
    let entry = servedBy.get(r.food_item_id)
    if (!entry) {
      entry = { halls: new Set(), todayHalls: new Set(), stations: new Set() }
      servedBy.set(r.food_item_id, entry)
    }
    entry.halls.add(r.dining_hall)
    entry.stations.add(cleanStation(r.station ?? ''))
    if (r.date === today) entry.todayHalls.add(r.dining_hall)
  }

  const ids = Array.from(servedBy.keys())
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
  const out: RawItem[] = []
  for (let i = 0; i < chunks.length; i += 5) {
    const batch = await Promise.all(
      chunks.slice(i, i + 5).map((chunk) =>
        supabase
          .from('food_items')
          .select('recipe_id, name, portion, calories, protein, carbs, sugar, fat, allergens, dietary_tags')
          .in('recipe_id', chunk)
      )
    )
    for (const res of batch) {
      if (res.error) throw res.error
      for (const food of (res.data ?? []) as BrowseFood[]) {
        const served = servedBy.get(food.recipe_id)
        if (!served) continue
        out.push({
          food,
          halls: Array.from(served.halls),
          todayHalls: Array.from(served.todayHalls),
          stations: Array.from(served.stations),
        })
      }
    }
  }
  return out
}

// One row per dish. The same dish often has a different recipe_id in each
// hall, so merge entries with the same name and nutrition.
function mergeRaw(raw: RawItem[], diningHalls: string[]): BrowseItem[] {
  const hallOrder = (h: string) => diningHalls.indexOf(h)
  const byOrder = (list: string[]) => Array.from(new Set(list)).sort((a, b) => hallOrder(a) - hallOrder(b))
  const merged = new Map<string, BrowseItem>()
  for (const { food, halls, todayHalls, stations: rawStations } of raw) {
    const hasNutrition =
      (food.calories ?? 0) !== 0 || (food.protein ?? 0) !== 0 || (food.carbs ?? 0) !== 0 || (food.fat ?? 0) !== 0
    if (!hasNutrition || halls.length === 0) continue
    // Blank stations fall back to the same name-based guess the Menu tab uses
    const stations = rawStations.map((st) => cleanStation(st) || classifyByName(food.name) || 'General')
    const key = [food.name.trim().toLowerCase(), food.calories, food.protein, food.carbs, food.fat].join('|')
    const existing = merged.get(key)
    if (existing) {
      existing.halls = byOrder([...existing.halls, ...halls])
      existing.todayHalls = byOrder([...existing.todayHalls, ...todayHalls])
      existing.onToday = existing.todayHalls.length > 0
      existing.stations = Array.from(new Set([...existing.stations, ...stations]))
    } else {
      merged.set(key, {
        food,
        halls: byOrder(halls),
        stations: Array.from(new Set(stations)),
        todayHalls: byOrder(todayHalls),
        onToday: todayHalls.length > 0,
      })
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.food.name.localeCompare(b.food.name))
}

/**
 * Returns the catalogue. Cached copies from today that are under 30 minutes
 * old are returned immediately; otherwise it loads fresh (callers can show
 * peekCatalogue() in the meantime).
 */
export async function getCatalogue(diningHalls: string[]): Promise<BrowseItem[]> {
  if (!catalogueCache) readStored()
  const fresh = catalogueCache && catalogueDay === todayLA() && Date.now() - catalogueSavedAt < FRESH_MS
  if (catalogueCache && fresh) return catalogueCache
  if (catalogueRequest) return catalogueRequest

  catalogueRequest = (async () => {
    const items = mergeRaw(await fetchRaw(diningHalls), diningHalls)
    catalogueCache = items
    catalogueDay = todayLA()
    catalogueSavedAt = Date.now()
    writeStored()
    return items
  })()

  try {
    return await catalogueRequest
  } finally {
    catalogueRequest = null
  }
}

/** Starts loading in the background so the tab is ready when it's tapped. */
export function prefetchCatalogue(diningHalls: string[]) {
  getCatalogue(diningHalls).catch(() => {})
}

export default function BrowseTab({
  diningHalls,
  dietaryPreferences,
  foodMatchesDietaryPreference,
  dietChipLabel,
  defaultMeal,
  justLogged,
  onLog,
  onOpenDetail,
  onServingPreview,
}: BrowseTabProps) {
  const [items, setItems] = useState<BrowseItem[] | null>(() => peekCatalogue())
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [hallFilter, setHallFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('az')
  const [meal, setMeal] = useState(MEALS.includes(defaultMeal) ? defaultMeal : 'Lunch')
  const [dietFilterOff, setDietFilterOff] = useState(false)
  const [activeStations, setActiveStations] = useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favorites = useFavorites()
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [isMealSheetOpen, setIsMealSheetOpen] = useState(false)
  const [openStepperId, setOpenStepperId] = useState<string | null>(null)
  const [servings, setServings] = useState<Record<string, number>>({})
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [debounced, setDebounced] = useState('')

  // Shows the saved copy straight away (see useState above) and refreshes it
  // in the background when it's stale.
  useEffect(() => {
    let cancelled = false
    getCatalogue(diningHalls)
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((e: { message?: string }) => {
        if (!cancelled && !peekCatalogue()) setError(e?.message || 'Could not load items.')
      })
    return () => {
      cancelled = true
    }
  }, [diningHalls, attempt])

  // Search runs ~150ms after typing stops so a 1,600-item list stays smooth
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 150)
    return () => clearTimeout(t)
  }, [query])

  // Stations offered in the picker: those of the items in the chosen hall(s)
  const availableStations = useMemo(() => {
    if (!items) return [] as string[]
    const found = new Set<string>()
    for (const it of items) {
      if (hallFilter && !it.halls.includes(hallFilter)) continue
      it.stations.forEach((st) => found.add(st))
    }
    return Array.from(found).sort((a, b) => a.localeCompare(b))
  }, [items, hallFilter])

  // Picking a hall can remove stations that hall doesn't have
  useEffect(() => {
    setActiveStations((prev) => {
      const next = prev.filter((st) => availableStations.includes(st))
      return next.length === prev.length ? prev : next
    })
  }, [availableStations])

  const toggleStation = (station: string) => {
    Haptics.selectionChanged().catch(() => {})
    setActiveStations((prev) => (prev.includes(station) ? prev.filter((st) => st !== station) : [...prev, station]))
  }

  const { list, dietHidden } = useMemo(() => {
    if (!items) return { list: [] as BrowseItem[], dietHidden: 0 }
    let hidden = 0
    const out = items.filter((it) => {
      if (hallFilter && !it.halls.includes(hallFilter)) return false
      if (debounced && !it.food.name.toLowerCase().includes(debounced)) return false
      if (favoritesOnly && !favorites.has(favoriteKey(it.food.name))) return false
      if (activeStations.length > 0 && !it.stations.some((st) => activeStations.includes(st))) return false
      const matchesDiet = dietaryPreferences.every((pref) => foodMatchesDietaryPreference(it.food, pref))
      if (!matchesDiet) {
        hidden++
        return dietFilterOff
      }
      return true
    })
    const sorted = [...out]
    if (sort === 'protein') sorted.sort((a, b) => b.food.protein - a.food.protein || a.food.name.localeCompare(b.food.name))
    else if (sort === 'calories') sorted.sort((a, b) => a.food.calories - b.food.calories || a.food.name.localeCompare(b.food.name))
    else if (sort === 'today') sorted.sort((a, b) => Number(b.onToday) - Number(a.onToday) || a.food.name.localeCompare(b.food.name))
    return { list: sorted, dietHidden: hidden }
  }, [items, hallFilter, debounced, sort, activeStations, favoritesOnly, favorites, dietaryPreferences, foodMatchesDietaryPreference, dietFilterOff])

  // Back to the top of the list whenever the filters change
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [hallFilter, debounced, sort, activeStations, favoritesOnly, dietFilterOff, dietaryPreferences])

  // Log under the hall the student picked, else the hall serving it today,
  // else the first hall that has ever served it.
  const ctxFor = (it: BrowseItem): BrowseLogContext => ({
    hall: hallFilter ?? it.todayHalls[0] ?? it.halls[0] ?? diningHalls[0],
    meal,
  })

  const activeFilterCount =
    activeStations.length +
    (favoritesOnly ? 1 : 0) +
    (dietHidden > 0 && !dietFilterOff ? 1 : 0) +
    (hallFilter ? 1 : 0) +
    (sort !== 'az' ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Search, with the shared Filters button beside it. Dietary, favorites,
          stations, hall and sort all live in the sheet it opens. */}
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search all dining hall items"
            placeholder="Search all items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={(e) => revealBelowStickyBar(e.currentTarget)}
            className="scroll-mt-[calc(env(safe-area-inset-top)+7rem)] w-full rounded-lg bg-surface-2 pl-10 pr-9 py-2.5 text-fg font-medium text-input focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg press active:scale-90"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <FiltersButton activeCount={activeFilterCount} onClick={() => setIsFiltersOpen(true)} />
      </div>

      {/* Results */}
      <div className="border-t border-line px-2">
        {!items && !error ? (
          <div className="space-y-1 pt-3" role="status" aria-label="Loading items">
            <div className="flex justify-center pt-2 pb-1">
              <Sammy mood="loading" size={2} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="py-4 flex items-center justify-between gap-4 animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 120}ms` }}>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 max-w-[180px] rounded bg-white/10" />
                  <div className="h-3 w-1/3 max-w-[90px] rounded bg-white/5" />
                </div>
                <div className="h-8 w-20 rounded-lg bg-white/5 shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="py-10 flex flex-col items-center gap-3 text-center text-fg-subtle font-medium">
            <Sammy mood="oops" size={3} />
            <p>Couldn&apos;t load the item list. {error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                clearCatalogue()
                setItems(null)
                setAttempt((n) => n + 1)
              }}
              className="min-h-btn px-4 rounded-lg bg-gold text-on-gold text-sm font-bold press active:scale-95 motion-reduce:active:scale-100"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* The count, and where every log goes */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-fg-muted tabular-nums" aria-live="polite">
                {list.length} item{list.length !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsMealSheetOpen(true)
                  Haptics.selectionChanged().catch(() => {})
                }}
                aria-haspopup="dialog"
                aria-label={`Log to ${meal}. Change meal`}
                className="min-h-tap pl-3 flex items-center gap-0.5 text-sm font-semibold text-fg press active:opacity-70"
              >
                Log to {meal}
                <ChevronDown size={16} className="text-fg-muted" aria-hidden="true" />
              </button>
            </div>

            {list.length === 0 ? (
              <p className="py-12 text-center text-fg-subtle font-medium">
                {favoritesOnly
                  ? 'No favorites match. Tap the heart on an item to add one.'
                  : dietHidden > 0 && !dietFilterOff
                    ? 'No items match your search or dietary filters.'
                    : 'No items match your search.'}
              </p>
            ) : (
              <div className="divide-y divide-line">
                {list.slice(0, visible).map((it, index) => {
                  const food = it.food
                  const rowServings = servings[food.recipe_id] ?? 1
                  return (
                    <FoodRow
                      key={food.recipe_id}
                      food={food}
                      servings={rowServings}
                      stepperOpen={openStepperId === food.recipe_id}
                      logged={!!justLogged[food.recipe_id]}
                      index={index % PAGE_SIZE}
                      logSuffix={` to ${meal}`}
                      note={
                        <span className="block text-11 font-medium text-fg-muted mt-0.5">
                          {it.onToday ? 'On today’s menu' : 'Not on today’s menu'} · {it.halls.map(shortHall).join(', ')}
                        </span>
                      }
                      onOpen={() => {
                        onOpenDetail(food, rowServings, ctxFor(it))
                        Haptics.selectionChanged().catch(() => {})
                      }}
                      onToggleStepper={() => {
                        setOpenStepperId((id) => (id === food.recipe_id ? null : food.recipe_id))
                        Haptics.selectionChanged().catch(() => {})
                      }}
                      onStep={(dir) => {
                        const at = SERVING_OPTIONS.indexOf(rowServings)
                        const next = SERVING_OPTIONS[Math.min(SERVING_OPTIONS.length - 1, Math.max(0, (at === -1 ? SERVING_OPTIONS.indexOf(1) : at) + dir))]
                        if (next === rowServings) return
                        setServings((prev) => ({ ...prev, [food.recipe_id]: next }))
                        onServingPreview(food, next)
                        Haptics.selectionChanged().catch(() => {})
                      }}
                      onLog={() => onLog(food, rowServings, ctxFor(it))}
                    />
                  )
                })}
              </div>
            )}
            {visible < list.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="mt-2 w-full min-h-btn text-sm font-semibold text-fg-muted hover:text-fg press active:opacity-70"
              >
                Show more ({list.length - visible} left)
              </button>
            )}
          </>
        )}
      </div>

      {/* Filters: the same sheet as Menu, plus hall and sort */}
      {isFiltersOpen && (
        <FiltersSheet
          onClose={() => setIsFiltersOpen(false)}
          diet={dietaryPreferences.length > 0 ? {
            label: dietChipLabel,
            hiddenCount: dietHidden,
            showing: dietFilterOff,
            onToggle: () => setDietFilterOff((off) => !off),
          } : undefined}
          favoritesOnly={favoritesOnly}
          onToggleFavorites={() => setFavoritesOnly((on) => !on)}
          stations={availableStations}
          activeStations={activeStations}
          onToggleStation={toggleStation}
          onClearStations={() => setActiveStations([])}
          stationLabel={cleanStation}
          halls={{
            title: 'Dining hall',
            options: [{ value: '', label: 'All halls' }, ...diningHalls.map((h) => ({ value: h, label: shortHall(h) }))],
            value: hallFilter ?? '',
            onChange: (v) => setHallFilter(v || null),
          }}
          sort={{
            title: 'Sort',
            options: (Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] })),
            value: sort,
            onChange: (v) => setSort(v as SortKey),
          }}
        />
      )}

      {/* Meal choice: where every log from this tab goes */}
      {isMealSheetOpen && (
        <BottomSheet onClose={() => setIsMealSheetOpen(false)} labelledBy="browse-meal-sheet-title">
          <h2 id="browse-meal-sheet-title" className="text-lg font-bold tracking-tight text-fg mb-1">
            Log to
          </h2>
          <div role="radiogroup" aria-label="Meal to log to" className="divide-y divide-line">
            {MEALS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={meal === m}
                onClick={() => {
                  setMeal(m)
                  Haptics.selectionChanged().catch(() => {})
                }}
                className={`w-full min-h-tap flex items-center justify-between gap-3 text-left text-sm press active:opacity-70 ${meal === m ? 'font-semibold text-fg' : 'font-medium text-fg-muted'}`}
              >
                {m}
                {meal === m && <Check size={16} strokeWidth={3} className="text-gold" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <SheetCloseButton className="mt-4 w-full min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100">
            Done
          </SheetCloseButton>
        </BottomSheet>
      )}
    </div>
  )
}
