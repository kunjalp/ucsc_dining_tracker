'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import { Haptics } from '@capacitor/haptics'
import { createClient } from '@/lib/supabase'
import { classifyByName } from '@/lib/stationClassifier'
import Sammy from '../components/Sammy'
import BottomSheet, { SheetCloseButton } from '../components/BottomSheet'
import FavoriteButton from '../components/FavoriteButton'
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

interface BrowseItem {
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

const SERVING_OPTIONS = [0.25, 0.5, 1, 1.5, 2]
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

// Loaded once per app session; switching tabs back and forth is instant.
let catalogueCache: BrowseItem[] | null = null
let catalogueRequest: Promise<BrowseItem[]> | null = null

function todayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

async function loadCatalogue(diningHalls: string[]): Promise<BrowseItem[]> {
  if (catalogueCache) return catalogueCache
  if (catalogueRequest) return catalogueRequest

  catalogueRequest = (async () => {
    const supabase = createClient()
    const today = todayLA()

    // 1. Which items each dining hall has ever served. Only the three small
    //    columns are fetched, in pages of 1000 (the API's per-request cap).
    const menuCols = 'food_item_id, dining_hall, date, station'
    const base = () =>
      supabase
        .from('daily_menus')
        .select(menuCols, { count: 'exact' })
        .in('dining_hall', diningHalls)
        .order('date', { ascending: false })
        .order('id', { ascending: true })

    const first = await base().range(0, DB_PAGE - 1)
    if (first.error) throw first.error
    type MenuRow = { food_item_id: string | null; dining_hall: string; date: string; station: string | null }
    const rows: MenuRow[] = [...((first.data ?? []) as MenuRow[])]
    const total = first.count ?? rows.length

    const starts: number[] = []
    for (let s = DB_PAGE; s < total; s += DB_PAGE) starts.push(s)
    for (let i = 0; i < starts.length; i += 6) {
      const batch = await Promise.all(
        starts.slice(i, i + 6).map((s) => base().range(s, s + DB_PAGE - 1))
      )
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

    // 2. The nutrition rows for those items, in chunks so the request URL
    //    stays short.
    const ids = Array.from(servedBy.keys())
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
    const foods: BrowseFood[] = []
    for (let i = 0; i < chunks.length; i += 5) {
      const batch = await Promise.all(
        chunks.slice(i, i + 5).map((chunk) =>
          supabase
            .from('food_items')
            .select('recipe_id, name, portion, calories, protein, carbs, sugar, fat, ingredients, allergens, dietary_tags')
            .in('recipe_id', chunk)
        )
      )
      for (const res of batch) {
        if (res.error) throw res.error
        foods.push(...((res.data ?? []) as BrowseFood[]))
      }
    }

    // 3. One row per dish. The same dish often has a different recipe_id in
    //    each hall, so merge entries with the same name and nutrition.
    const hallOrder = (h: string) => diningHalls.indexOf(h)
    const merged = new Map<string, BrowseItem>()
    for (const food of foods) {
      const hasNutrition =
        (food.calories ?? 0) !== 0 || (food.protein ?? 0) !== 0 || (food.carbs ?? 0) !== 0 || (food.fat ?? 0) !== 0
      if (!hasNutrition) continue
      const served = servedBy.get(food.recipe_id)
      if (!served) continue
      // Blank stations fall back to the same name-based guess the Menu tab uses
      const stations = Array.from(served.stations).map((st) => st || classifyByName(food.name) || 'General')
      const key = [food.name.trim().toLowerCase(), food.calories, food.protein, food.carbs, food.fat].join('|')
      const existing = merged.get(key)
      if (existing) {
        const halls = new Set([...existing.halls, ...served.halls])
        const todayHalls = new Set([...existing.todayHalls, ...served.todayHalls])
        existing.halls = Array.from(halls).sort((a, b) => hallOrder(a) - hallOrder(b))
        existing.todayHalls = Array.from(todayHalls).sort((a, b) => hallOrder(a) - hallOrder(b))
        existing.onToday = existing.todayHalls.length > 0
        existing.stations = Array.from(new Set([...existing.stations, ...stations]))
      } else {
        const halls = Array.from(served.halls).sort((a, b) => hallOrder(a) - hallOrder(b))
        const todayHalls = Array.from(served.todayHalls).sort((a, b) => hallOrder(a) - hallOrder(b))
        merged.set(key, { food, halls, stations: Array.from(new Set(stations)), todayHalls, onToday: todayHalls.length > 0 })
      }
    }

    catalogueCache = Array.from(merged.values()).sort((a, b) => a.food.name.localeCompare(b.food.name))
    return catalogueCache
  })()

  try {
    return await catalogueRequest
  } finally {
    catalogueRequest = null
  }
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
  const [items, setItems] = useState<BrowseItem[] | null>(catalogueCache)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hallFilter, setHallFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('az')
  const [meal, setMeal] = useState(MEALS.includes(defaultMeal) ? defaultMeal : 'Lunch')
  const [dietFilterOff, setDietFilterOff] = useState(false)
  const [activeStations, setActiveStations] = useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favorites = useFavorites()
  const [isStationSheetOpen, setIsStationSheetOpen] = useState(false)
  const [servings, setServings] = useState<Record<string, number>>({})
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    if (items) return
    let cancelled = false
    loadCatalogue(diningHalls)
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((e: { message?: string }) => {
        if (!cancelled) setError(e?.message || 'Could not load items.')
      })
    return () => {
      cancelled = true
    }
  }, [items, diningHalls])

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 space-y-4 bg-surface border border-white/10">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Browse all dining hall items</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            Find something that isn&apos;t on a menu today and log it.
          </p>
        </div>

        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search all dining hall items"
            placeholder="Search all items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-surface-2 pl-10 pr-9 py-2.5 text-fg font-medium text-input focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
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

        {/* Dietary chip, Stations button and the selected stations, same as the Menu tab */}
        {(
          <div className="flex flex-wrap items-center gap-2">
            {dietaryPreferences.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-sky/30 bg-sky/10 pl-3 pr-1 py-1 max-w-full">
              <span className="text-xs font-semibold text-sky truncate">{dietChipLabel}</span>
              <span className="text-xs text-fg-muted tabular-nums whitespace-nowrap">
                , {dietHidden} {dietFilterOff ? 'shown' : 'hidden'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDietFilterOff((off) => !off)
                  Haptics.selectionChanged().catch(() => {})
                }}
                aria-label={dietFilterOff ? 'Hide items that do not match your dietary preferences' : `Show ${dietHidden} hidden items`}
                className="relative after:absolute after:-inset-2 after:content-[''] rounded-full px-2 py-0.5 text-xs font-bold text-gold hover:bg-gold/10 active:scale-95 press"
              >
                {dietFilterOff ? 'Hide' : 'Show'}
              </button>
            </div>
            )}
            <button
              type="button"
              onClick={() => {
                setFavoritesOnly((on) => !on)
                Haptics.selectionChanged().catch(() => {})
              }}
              aria-pressed={favoritesOnly}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold press active:scale-95 motion-reduce:active:scale-100 ${favoritesOnly
                ? 'bg-macro-fat/15 text-macro-fat border-macro-fat/40'
                : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                }`}
            >
              <Heart size={14} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
              Favorites
            </button>
            {availableStations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsStationSheetOpen(true)
                  Haptics.selectionChanged().catch(() => {})
                }}
                aria-haspopup="dialog"
                aria-label={`Filter by station, ${activeStations.length || 'all'} selected`}
                className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold press active:scale-95 motion-reduce:active:scale-100 ${activeStations.length > 0
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                  }`}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                Stations · {activeStations.length || 'All'}
              </button>
            )}
            {activeStations.map((station) => {
              const name = station.includes(' - ') ? station.split(' - ')[1] : station
              return (
                <button
                  key={station}
                  type="button"
                  onClick={() => toggleStation(station)}
                  aria-label={`Remove ${name} filter`}
                  className="shrink-0 whitespace-nowrap flex items-center gap-1 px-2.5 py-1 rounded-full border bg-gold/15 text-gold border-gold/40 text-xs font-bold press active:scale-95 motion-reduce:active:scale-100"
                >
                  {name}
                  <X size={12} strokeWidth={2.75} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        {/* Dining hall chips */}
        <div role="radiogroup" aria-label="Filter by dining hall" className="flex flex-wrap gap-2">
          {[null, ...diningHalls].map((hall) => {
            const selected = hallFilter === hall
            return (
              <button
                key={hall ?? 'all'}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setHallFilter(hall)
                  Haptics.selectionChanged().catch(() => {})
                }}
                className={`relative after:absolute after:inset-x-0 after:content-[''] after:-inset-y-1 px-3 py-1.5 rounded-full border text-xs font-bold press active:scale-95 motion-reduce:active:scale-100 ${selected
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                  }`}
              >
                {hall ? shortHall(hall) : 'All halls'}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 min-w-0 text-xs font-semibold text-fg-muted">
            Sort
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey)
                Haptics.selectionChanged().catch(() => {})
              }}
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-2 p-2.5 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORT_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-fg-muted">Log to</p>
            <div role="radiogroup" aria-label="Meal to log to" className="mt-1 flex bg-surface-2 p-1 rounded-xl gap-1">
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
                  className={`relative flex-1 px-1 py-1.5 text-11 font-bold rounded-lg press active:scale-95 whitespace-nowrap after:absolute after:inset-x-0 after:content-[''] after:-inset-y-2 ${meal === m
                    ? 'bg-gold/15 text-gold border border-gold/40'
                    : 'text-fg-muted hover:text-fg border border-transparent'
                    }`}
                >
                  {m === 'Late Night' ? 'Late' : m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="pt-4 border-t border-white/10">
          {!items && !error ? (
            <div className="space-y-1" role="status" aria-label="Loading items">
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
                  catalogueCache = null
                  setItems(null)
                }}
                className="px-4 py-2 rounded-xl bg-gold text-on-gold text-sm font-bold press active:scale-95"
              >
                Try again
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center text-fg-subtle font-medium">
              <Sammy mood="idle" size={3} />
              <p>
                {favoritesOnly
                  ? 'No favorites match. Tap the heart on an item to add one.'
                  : dietHidden > 0 && !dietFilterOff
                    ? 'No items match your search or dietary filters.'
                    : 'No items match your search.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-fg-muted mb-2 tabular-nums" aria-live="polite">
                {list.length} item{list.length !== 1 ? 's' : ''}
              </p>
              <div className="divide-y divide-white/10">
                {list.slice(0, visible).map((it, index) => {
                  const food = it.food
                  const rowServings = servings[food.recipe_id] ?? 1
                  return (
                    <article
                      key={food.recipe_id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl px-3 -mx-3 hover:bg-white/5 transition-colors animate-row-in"
                      style={{ animationDelay: `${Math.min(index % PAGE_SIZE, 8) * 35}ms` }}
                    >
                      <div className="flex items-start gap-1 min-w-0 sm:flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenDetail(food, rowServings, ctxFor(it))
                          Haptics.selectionChanged().catch(() => {})
                        }}
                        aria-label={`${food.name}, details`}
                        className="group min-w-0 flex-1 text-left rounded-lg active:opacity-70"
                      >
                        <span className="flex items-start gap-1 font-semibold text-fg">
                          <span className="min-w-0">{food.name}</span>
                          <ChevronRight size={16} className="shrink-0 mt-[0.2em] text-fg-muted group-hover:text-fg transition-colors" aria-hidden="true" />
                        </span>
                        <span className="block text-xs text-fg-muted mt-0.5">
                          {food.portion || '1 serving'}
                          {rowServings !== 1 && ` × ${rowServings}`}
                        </span>
                        <span className="flex flex-wrap gap-1.5 mt-1.5 text-11 font-semibold tabular-nums">
                          <span className="rounded-md px-1.5 bg-macro-cal/15 text-macro-cal">{Math.round(food.calories * rowServings)} cal</span>
                          <span className="rounded-md px-1.5 bg-macro-protein/15 text-macro-protein">P {Math.round(food.protein * rowServings)}g</span>
                          <span className="rounded-md px-1.5 bg-macro-carbs/15 text-macro-carbs">C {Math.round(food.carbs * rowServings)}g</span>
                          <span className="rounded-md px-1.5 bg-macro-fat/15 text-macro-fat">F {Math.round(food.fat * rowServings)}g</span>
                        </span>
                        <span className="block text-11 text-fg-muted mt-1.5">
                          {it.onToday ? (
                            <span className="font-semibold text-macro-protein">On today&apos;s menu · </span>
                          ) : (
                            <span className="font-semibold">Not on today&apos;s menu · </span>
                          )}
                          {it.halls.map(shortHall).join(', ')}
                        </span>
                      </button>
                      <FavoriteButton name={food.name} className="-mt-1" />
                      </div>

                      <div className="flex items-center justify-between w-full gap-3 sm:w-auto sm:justify-start">
                        <div role="radiogroup" aria-label={`Servings of ${food.name}`} className="flex bg-surface-2 p-1.5 rounded-xl gap-1">
                          {SERVING_OPTIONS.map((value) => {
                            const isSelected = rowServings === value
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => {
                                  setServings((prev) => ({ ...prev, [food.recipe_id]: value }))
                                  onServingPreview(food, value)
                                }}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg press active:scale-90 ${isSelected ? 'bg-gold/15 text-gold' : 'text-fg-muted hover:text-fg'}`}
                              >
                                {value}x
                              </button>
                            )
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => onLog(food, rowServings, ctxFor(it))}
                          disabled={!!justLogged[food.recipe_id]}
                          aria-label={justLogged[food.recipe_id] ? `Logged ${food.name}` : `Log ${rowServings} serving${rowServings !== 1 ? 's' : ''} of ${food.name} to ${meal}`}
                          className={`relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] flex min-h-btn min-w-tap items-center justify-center rounded-lg px-3.5 text-xs font-bold shadow-md transition-colors duration-300 active:scale-95 ${justLogged[food.recipe_id]
                            ? 'bg-macro-protein text-on-gold'
                            : 'bg-gold text-on-gold hover:brightness-105'
                            }`}
                        >
                          {justLogged[food.recipe_id] ? <Check size={14} strokeWidth={3} className="animate-check-pop" /> : 'Log'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
              {visible < list.length && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="mt-4 w-full min-h-btn py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-sm font-bold text-fg press active:scale-[0.98]"
                >
                  Show more ({list.length - visible} left)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Station picker -- same wrapping multi-select chips as the Menu tab */}
      {isStationSheetOpen && (
        <BottomSheet onClose={() => setIsStationSheetOpen(false)} labelledBy="browse-station-sheet-title">
          <h2 id="browse-station-sheet-title" className="text-lg font-bold tracking-tight text-fg mb-3">
            Stations
          </h2>
          <div className="flex flex-wrap gap-2">
            {availableStations.map((station) => {
              const isActive = activeStations.includes(station)
              const [parentLabel, subLabel] = station.includes(' - ') ? station.split(' - ') : [null, station]
              return (
                <button
                  key={station}
                  type="button"
                  onClick={() => toggleStation(station)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 rounded-full border press active:scale-95 motion-reduce:active:scale-100 flex flex-col items-center leading-tight ${isActive
                    ? 'bg-gold/15 text-gold border-gold/40'
                    : 'bg-white/5 text-fg-muted hover:bg-white/10 border-white/15'
                    }`}
                >
                  {parentLabel && (
                    <span className={`text-9 font-semibold uppercase tracking-wide ${isActive ? 'text-gold/70' : 'text-sky'}`}>
                      {parentLabel}
                    </span>
                  )}
                  <span className="text-xs font-bold">{subLabel}</span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={() => {
                setActiveStations([])
                Haptics.selectionChanged().catch(() => {})
              }}
              disabled={activeStations.length === 0}
              className="flex-1 min-h-tap rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-fg hover:bg-white/10 press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
            >
              Clear
            </button>
            <SheetCloseButton
              className="flex-1 min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100"
            >
              Done
            </SheetCloseButton>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
