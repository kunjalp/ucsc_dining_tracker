'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChefHat, ChevronDown, Heart, Link2, Minus, Pencil, Plus, Search, Share2, Trash2, X } from 'lucide-react'
import { Haptics, NotificationType } from '@capacitor/haptics'
import BottomSheet, { SheetCloseButton } from '../components/BottomSheet'
import Sammy from '../components/Sammy'
import FavoriteButton from '../components/FavoriteButton'
import { useFavorites } from '@/lib/favorites'
import { getCatalogue, peekCatalogue, type BrowseFood, type BrowseItem } from './BrowseTab'
import {
  MAX_RECIPES,
  MAX_RECIPE_ITEMS,
  MAX_RECIPE_NAME,
  RECIPE_SERVING_STEPS,
  deleteRecipe,
  fetchRecipes,
  isMissingTableError,
  recipeTotals,
  saveRecipe,
  type Recipe,
  type RecipeItem,
} from '@/lib/recipes'
import { decodeRecipe, encodeRecipe, extractCode, loadSharedItems, shareUrl } from '@/lib/recipeShare'

interface RecipesTabProps {
  diningHalls: string[]
  dietaryPreferences: string[]
  foodMatchesDietaryPreference: (food: BrowseFood, pref: string) => boolean
  /** Meal period the student is likely eating right now */
  defaultMeal: string
  /** Logs every ingredient; resolves with how many were logged */
  onLogRecipe: (recipe: Recipe, meal: string, hall: string) => Promise<number>
  /** Opens the builder with these ingredients (the "save this meal?" offer) */
  prefill?: { key: number; name: string; items: RecipeItem[] } | null
  onPrefillHandled?: () => void
  /** A share code that arrived in a link; opens the import sheet */
  incomingCode?: string | null
  onIncomingHandled?: () => void
  onNotify: (message: string, type: 'success' | 'error') => void
}

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Late Night']
const shortHall = (hall: string) => hall.replace(/ Dining Hall$/, '')
const itemKey = (name: string, cal: number, p: number, c: number, f: number) =>
  [name.trim().toLowerCase(), cal, p, c, f].join('|')

interface Analysis {
  line: string | null
  tone: 'good' | 'warn' | null
  bestHall: string
  flagged: string[]
}

interface BuilderState {
  id: string | null
  name: string
  items: RecipeItem[]
}

function MacroChips({ t }: { t: { calories: number; protein: number; carbs: number; fat: number } }) {
  return (
    <span className="flex flex-wrap gap-1.5 text-11 font-semibold tabular-nums">
      <span className="rounded-md px-1.5 bg-macro-cal/15 text-macro-cal">{Math.round(t.calories)} cal</span>
      <span className="rounded-md px-1.5 bg-macro-protein/15 text-macro-protein">P {Math.round(t.protein)}g</span>
      <span className="rounded-md px-1.5 bg-macro-carbs/15 text-macro-carbs">C {Math.round(t.carbs)}g</span>
      <span className="rounded-md px-1.5 bg-macro-fat/15 text-macro-fat">F {Math.round(t.fat)}g</span>
    </span>
  )
}

export default function RecipesTab({
  diningHalls,
  dietaryPreferences,
  foodMatchesDietaryPreference,
  defaultMeal,
  onLogRecipe,
  prefill,
  onPrefillHandled,
  incomingCode,
  onIncomingHandled,
  onNotify,
}: RecipesTabProps) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [catalogue, setCatalogue] = useState<BrowseItem[] | null>(() => peekCatalogue())
  const [meal, setMeal] = useState(MEALS.includes(defaultMeal) ? defaultMeal : 'Lunch')
  const [builder, setBuilder] = useState<BuilderState | null>(null)
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [loggedId, setLoggedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [importCode, setImportCode] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)

  useEffect(() => {
    if (!prefill) return
    setBuilder({ id: null, name: prefill.name, items: prefill.items.map((i) => ({ ...i })) })
    onPrefillHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key])

  useEffect(() => {
    if (!incomingCode) return
    setImportCode(incomingCode)
    onIncomingHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCode])

  useEffect(() => {
    let cancelled = false
    fetchRecipes()
      .then((list) => {
        if (!cancelled) setRecipes(list)
      })
      .catch((e: { code?: string; message?: string }) => {
        if (cancelled) return
        if (isMissingTableError(e)) setSetupNeeded(true)
        else setLoadError(e?.message || 'Could not load your recipes.')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  // The Browse list doubles as the ingredient picker and the "is it on
  // today?" lookup
  useEffect(() => {
    let cancelled = false
    getCatalogue(diningHalls)
      .then((c) => {
        if (!cancelled) setCatalogue(c)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [diningHalls])

  const lookup = useMemo(() => {
    const byKey = new Map<string, BrowseItem>()
    const byName = new Map<string, BrowseItem>()
    for (const it of catalogue ?? []) {
      const f = it.food
      byKey.set(itemKey(f.name, f.calories, f.protein, f.carbs, f.fat), it)
      if (!byName.has(f.name.trim().toLowerCase())) byName.set(f.name.trim().toLowerCase(), it)
    }
    return (i: RecipeItem): BrowseItem | undefined =>
      byKey.get(itemKey(i.name, i.calories, i.protein, i.carbs, i.fat)) ?? byName.get(i.name.trim().toLowerCase())
  }, [catalogue])

  // Where a recipe can be made today, and which items don't suit the
  // student's dietary preferences
  const analyse = (recipe: Recipe): Analysis => {
    const matched = recipe.items.map((i) => ({ item: i, found: lookup(i) }))
    const flagged = matched
      .filter(({ found }) => found && !dietaryPreferences.every((p) => foodMatchesDietaryPreference(found.food, p)))
      .map(({ item }) => item.name)

    const score = (hall: string, today: boolean) =>
      matched.filter(({ found }) => found && (today ? found.todayHalls : found.halls).includes(hall)).length
    const best = (today: boolean) =>
      diningHalls.reduce((a, h) => (score(h, today) > score(a, today) ? h : a), diningHalls[0])
    const bestToday = best(true)
    const bestHall = score(bestToday, true) > 0 ? bestToday : best(false)

    if (!catalogue || matched.some(({ found }) => !found)) return { line: null, tone: null, bestHall, flagged }

    const allToday = diningHalls.filter((h) => score(h, true) === recipe.items.length)
    if (allToday.length > 0) {
      return { line: `All items today at ${allToday.map(shortHall).join(', ')}`, tone: 'good', bestHall: allToday[0], flagged }
    }
    const missing = matched.filter(({ found }) => found && found.todayHalls.length === 0).map(({ item }) => item.name)
    if (missing.length > 0) {
      return { line: `Not on today's menus: ${missing.join(', ')}`, tone: 'warn', bestHall, flagged }
    }
    return { line: `Items are spread across halls today. Closest: ${shortHall(bestToday)}`, tone: 'warn', bestHall: bestToday, flagged }
  }

  const refresh = async () => {
    try {
      setRecipes(await fetchRecipes())
    } catch (e) {
      setLoadError((e as { message?: string })?.message || 'Could not refresh your recipes.')
    }
  }

  // Native share sheet when there is one, else copy the link
  const handleShare = async (recipe: Recipe) => {
    const url = shareUrl(encodeRecipe(recipe.name, recipe.items))
    const text = `Try my "${recipe.name}" on Sammy's Palate, the UCSC dining hall macro tracker:`
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: recipe.name, text, url })
        return
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      onNotify('Link copied. Paste it to a friend.', 'success')
    } catch {
      onNotify('Could not share this recipe. Try again.', 'error')
    }
  }

  const handleLog = async (recipe: Recipe) => {
    if (loggingId) return
    setLoggingId(recipe.id)
    const logged = await onLogRecipe(recipe, meal, analyse(recipe).bestHall)
    setLoggingId(null)
    if (logged > 0) {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      setLoggedId(recipe.id)
      setTimeout(() => setLoggedId((id) => (id === recipe.id ? null : id)), 1600)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 space-y-4 bg-surface border border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">My recipes</h2>
            <p className="text-xs text-fg-muted mt-0.5">Save a go-to meal once, log it in one tap.</p>
          </div>
          {!setupNeeded && (
            <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPasteOpen(true)
                Haptics.selectionChanged().catch(() => {})
              }}
              aria-label="Add a recipe from a link or code"
              className="flex items-center gap-1.5 min-h-btn px-3 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-fg hover:bg-white/10 press active:scale-95 motion-reduce:active:scale-100"
            >
              <Link2 size={15} aria-hidden="true" />
              Code
            </button>
            <button
              type="button"
              onClick={() => {
                if ((recipes?.length ?? 0) >= MAX_RECIPES) return
                setBuilder({ id: null, name: '', items: [] })
                Haptics.selectionChanged().catch(() => {})
              }}
              className="flex items-center gap-1.5 min-h-btn px-3.5 rounded-xl bg-gold text-on-gold text-sm font-bold shadow-md hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100"
            >
              <Plus size={16} strokeWidth={2.75} aria-hidden="true" />
              New
            </button>
            </div>
          )}
        </div>

        <FavoritesSection catalogue={catalogue} />

        <div>
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

        <div className="pt-4 border-t border-white/10">
          {setupNeeded ? (
            <div role="status" className="py-8 flex flex-col items-center gap-3 text-center text-fg-subtle font-medium">
              <Sammy mood="think" size={3} />
              <p>Recipes aren&apos;t switched on yet. The database table still needs to be created.</p>
            </div>
          ) : loadError ? (
            <div role="alert" className="py-8 flex flex-col items-center gap-3 text-center text-fg-subtle font-medium">
              <Sammy mood="oops" size={3} />
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadError(null)
                  setRecipes(null)
                  setAttempt((n) => n + 1)
                }}
                className="px-4 py-2 rounded-xl bg-gold text-on-gold text-sm font-bold press active:scale-95"
              >
                Try again
              </button>
            </div>
          ) : !recipes ? (
            <div className="flex justify-center py-6" role="status" aria-label="Loading recipes">
              <Sammy mood="loading" size={2} />
            </div>
          ) : recipes.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center text-fg-subtle font-medium">
              <Sammy mood="idle" size={3} />
              <p>No recipes yet. Tap New to save your go-to meal, like a sandwich you always make.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {recipes.map((recipe) => {
                const totals = recipeTotals(recipe.items)
                const a = analyse(recipe)
                const isLogging = loggingId === recipe.id
                const isLogged = loggedId === recipe.id
                return (
                  <li key={recipe.id} className="py-4 space-y-2.5 animate-row-in">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-fg break-words">{recipe.name}</h3>
                        <p className="text-xs text-fg-muted mt-0.5">
                          {recipe.items.map((i) => (i.servings !== 1 ? `${i.servings}× ${i.name}` : i.name)).join(' · ')}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleShare(recipe)}
                          aria-label={`Share ${recipe.name}`}
                          className="relative size-8 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-white/10 press active:scale-90 after:absolute after:-inset-1 after:content-['']"
                        >
                          <Share2 size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBuilder({ id: recipe.id, name: recipe.name, items: recipe.items.map((i) => ({ ...i })) })
                            Haptics.selectionChanged().catch(() => {})
                          }}
                          aria-label={`Edit ${recipe.name}`}
                          className="relative size-8 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-white/10 press active:scale-90 after:absolute after:-inset-1 after:content-['']"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <MacroChips t={totals} />
                    {a.line && (
                      <p className={`text-11 font-semibold ${a.tone === 'good' ? 'text-macro-protein' : 'text-macro-fat'}`}>{a.line}</p>
                    )}
                    {a.flagged.length > 0 && (
                      <p className="text-11 font-semibold text-danger">
                        Doesn&apos;t match your dietary preferences: {a.flagged.join(', ')}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLog(recipe)}
                      disabled={!!loggingId}
                      aria-label={`Log ${recipe.name} to ${meal}`}
                      className={`relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] w-full min-h-btn py-2 flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold shadow-md transition-colors duration-300 active:scale-[0.98] press disabled:opacity-70 ${isLogged ? 'bg-macro-protein text-on-gold' : 'bg-gold text-on-gold hover:brightness-105'}`}
                    >
                      {isLogged ? (
                        <>
                          <Check size={16} strokeWidth={3} className="animate-check-pop" aria-hidden="true" /> Logged
                        </>
                      ) : isLogging ? (
                        'Logging…'
                      ) : (
                        <>
                          <ChefHat size={16} aria-hidden="true" /> Log to {meal}
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {builder && (
        <RecipeBuilder
          state={builder}
          setState={setBuilder}
          catalogue={catalogue}
          dietaryPreferences={dietaryPreferences}
          foodMatchesDietaryPreference={foodMatchesDietaryPreference}
          onSaved={async () => {
            await refresh()
            Haptics.notification({ type: NotificationType.Success }).catch(() => {})
          }}
          onDeleted={refresh}
        />
      )}

      {pasteOpen && (
        <PasteCodeSheet
          onClose={() => setPasteOpen(false)}
          onCode={(code) => {
            setPasteOpen(false)
            setImportCode(code)
          }}
        />
      )}

      {importCode && (
        <ImportRecipeSheet
          code={importCode}
          onClose={() => setImportCode(null)}
          onAdded={async () => {
            await refresh()
            Haptics.notification({ type: NotificationType.Success }).catch(() => {})
            onNotify('Recipe added to your recipes', 'success')
          }}
        />
      )}
    </div>
  )
}

function PasteCodeSheet({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const code = extractCode(value)
    if (!decodeRecipe(code)) {
      setError("That doesn't look like a recipe link or code.")
      return
    }
    onCode(code)
  }

  return (
    <BottomSheet onClose={onClose} labelledBy="paste-code-title" className="bg-surface-2 max-h-[90dvh]">
      <div className="flex items-center justify-between gap-2">
        <h2 id="paste-code-title" className="text-xl font-bold tracking-tight text-fg min-w-0">
          Add from a link or code
        </h2>
        <SheetCloseButton
          aria-label="Close"
          className="shrink-0 size-tap flex items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg press active:scale-90"
        >
          <X size={20} />
        </SheetCloseButton>
      </div>
      <p className="text-sm text-fg-muted mt-1">Paste the link or code a friend sent you.</p>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        rows={3}
        aria-label="Recipe link or code"
        placeholder="Paste here"
        className="mt-3 w-full rounded-xl border border-white/10 bg-surface p-3 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={value.trim().length === 0}
        className="mt-4 w-full min-h-tap rounded-xl bg-gold text-sm font-semibold text-on-gold hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
      >
        Continue
      </button>
    </BottomSheet>
  )
}

function ImportRecipeSheet({
  code,
  onClose,
  onAdded,
}: {
  code: string
  onClose: () => void
  onAdded: () => Promise<void>
}) {
  const decoded = useMemo(() => decodeRecipe(code), [code])
  const [items, setItems] = useState<RecipeItem[] | null>(null)
  const [missing, setMissing] = useState(0)
  const [name, setName] = useState(decoded?.name ?? '')
  const [error, setError] = useState<string | null>(decoded ? null : "That recipe link isn't valid.")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!decoded) return
    let cancelled = false
    loadSharedItems(decoded.entries)
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setMissing(r.missing)
        if (r.items.length === 0) setError('None of this recipe\'s items are available anymore.')
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this recipe. Check your connection and try again.')
      })
    return () => {
      cancelled = true
    }
  }, [decoded])

  const canAdd = !!items && items.length > 0 && name.trim().length > 0 && !saving

  const add = async () => {
    if (!canAdd || !items) return
    setSaving(true)
    setError(null)
    try {
      await saveRecipe(null, name, items)
      await onAdded()
      onClose()
    } catch (e) {
      setError((e as { message?: string })?.message || 'Could not add the recipe.')
      setSaving(false)
    }
  }

  return (
    <BottomSheet onClose={onClose} labelledBy="import-recipe-title" className="bg-surface-2 max-h-[90dvh]">
      <div className="flex items-center justify-between gap-2">
        <h2 id="import-recipe-title" className="text-xl font-bold tracking-tight text-fg min-w-0">
          Add a friend&apos;s recipe
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            className="relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] min-h-btn px-4 rounded-xl bg-gold text-sm font-semibold text-on-gold shadow-md hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
          <SheetCloseButton
            aria-label="Close"
            className="size-tap flex items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg press active:scale-90"
          >
            <X size={20} />
          </SheetCloseButton>
        </div>
      </div>

      {decoded && (
        <label className="block mt-4 text-xs font-semibold text-fg-muted">
          Name
          <input
            type="text"
            value={name}
            maxLength={MAX_RECIPE_NAME}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-surface p-3 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </label>
      )}

      {!items && !error && (
        <p className="text-sm text-fg-muted mt-4" role="status">
          Loading recipe…
        </p>
      )}

      {items && items.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-fg-muted">Ingredients</p>
          <ul className="mt-1 divide-y divide-white/10">
            {items.map((i) => (
              <li key={i.recipe_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 break-words font-semibold text-fg">{i.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-gold">{i.servings}×</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-fg-muted">Total</span>
            <MacroChips t={recipeTotals(items)} />
          </div>
          {missing > 0 && (
            <p className="mt-2 text-11 font-semibold text-macro-fat">
              {missing} ingredient{missing !== 1 ? 's are' : ' is'} no longer available and left out.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </BottomSheet>
  )
}

function RecipeBuilder({
  state,
  setState,
  catalogue,
  dietaryPreferences,
  foodMatchesDietaryPreference,
  onSaved,
  onDeleted,
}: {
  state: BuilderState
  setState: (s: BuilderState | null) => void
  catalogue: BrowseItem[] | null
  dietaryPreferences: string[]
  foodMatchesDietaryPreference: (food: BrowseFood, pref: string) => boolean
  onSaved: () => Promise<void>
  onDeleted: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!catalogue || !q) return []
    return catalogue
      .filter(
        (it) =>
          it.food.name.toLowerCase().includes(q) &&
          dietaryPreferences.every((p) => foodMatchesDietaryPreference(it.food, p))
      )
      .slice(0, 25)
  }, [catalogue, q, dietaryPreferences, foodMatchesDietaryPreference])

  const totals = recipeTotals(state.items)

  const addItem = (food: BrowseFood) => {
    Haptics.selectionChanged().catch(() => {})
    const existing = state.items.find((i) => i.name.trim().toLowerCase() === food.name.trim().toLowerCase())
    if (existing) {
      setState({ ...state, items: state.items.map((i) => (i === existing ? { ...i, servings: stepServings(i.servings, 1) } : i)) })
      return
    }
    if (state.items.length >= MAX_RECIPE_ITEMS) {
      setError(`A recipe can have up to ${MAX_RECIPE_ITEMS} items.`)
      return
    }
    setError(null)
    setState({
      ...state,
      items: [
        ...state.items,
        {
          recipe_id: food.recipe_id,
          name: food.name,
          portion: food.portion || '1 serving',
          servings: 1,
          calories: food.calories || 0,
          protein: food.protein || 0,
          carbs: food.carbs || 0,
          fat: food.fat || 0,
          sugar: food.sugar || 0,
        },
      ],
    })
  }

  const stepServings = (current: number, dir: 1 | -1) => {
    const steps = RECIPE_SERVING_STEPS
    const idx = steps.findIndex((s) => s >= current)
    const at = idx === -1 ? steps.length - 1 : idx
    return steps[Math.max(0, Math.min(steps.length - 1, at + dir))]
  }

  const bump = (item: RecipeItem, dir: 1 | -1) => {
    Haptics.selectionChanged().catch(() => {})
    setState({ ...state, items: state.items.map((i) => (i === item ? { ...i, servings: stepServings(i.servings, dir) } : i)) })
  }

  const remove = (item: RecipeItem) => {
    Haptics.selectionChanged().catch(() => {})
    setState({ ...state, items: state.items.filter((i) => i !== item) })
  }

  const canSave = state.name.trim().length > 0 && state.items.length > 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await saveRecipe(state.id, state.name, state.items)
      await onSaved()
      setState(null)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Could not save the recipe.')
      setSaving(false)
    }
  }

  const remove_ = async () => {
    if (!state.id) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      Haptics.selectionChanged().catch(() => {})
      return
    }
    setSaving(true)
    try {
      await deleteRecipe(state.id)
      await onDeleted()
      setState(null)
    } catch (e) {
      setError((e as { message?: string })?.message || 'Could not delete the recipe.')
      setSaving(false)
    }
  }

  return (
    <BottomSheet onClose={() => setState(null)} labelledBy="recipe-builder-title" className="bg-surface-2 max-h-[90dvh]">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recipe-builder-title" className="text-xl font-bold tracking-tight text-fg min-w-0">
          {state.id ? 'Edit recipe' : 'New recipe'}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] min-h-btn px-4 rounded-xl bg-gold text-sm font-semibold text-on-gold shadow-md hover:brightness-105 press active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <SheetCloseButton
            aria-label="Close"
            className="size-tap flex items-center justify-center rounded-full text-fg-muted hover:bg-white/10 hover:text-fg press active:scale-90"
          >
            <X size={20} />
          </SheetCloseButton>
        </div>
      </div>

      <label className="block mt-4 text-xs font-semibold text-fg-muted">
        Name
        <input
          type="text"
          value={state.name}
          maxLength={MAX_RECIPE_NAME}
          onChange={(e) => setState({ ...state, name: e.target.value })}
          placeholder="e.g. My turkey sandwich"
          className="mt-1 w-full rounded-xl border border-white/10 bg-surface p-3 text-input text-fg font-medium focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted"
        />
      </label>

      <div className="mt-4">
        <p className="text-xs font-semibold text-fg-muted">
          Ingredients ({state.items.length}/{MAX_RECIPE_ITEMS})
        </p>
        {state.items.length === 0 ? (
          <p className="text-sm text-fg-muted mt-1">Search below and tap + to add dining hall items.</p>
        ) : (
          <ul className="mt-1 divide-y divide-white/10">
            {state.items.map((item) => (
              <li key={item.recipe_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg break-words">{item.name}</p>
                  <p className="text-11 text-fg-muted tabular-nums">
                    {Math.round(item.calories * item.servings)} cal · P {Math.round(item.protein * item.servings)}g
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => bump(item, -1)}
                    aria-label={`Fewer servings of ${item.name}`}
                    className="relative size-8 flex items-center justify-center rounded-full bg-white/5 text-fg press active:scale-90 after:absolute after:-inset-1.5 after:content-['']"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span className="w-10 text-center text-sm font-bold tabular-nums text-gold">{item.servings}×</span>
                  <button
                    type="button"
                    onClick={() => bump(item, 1)}
                    aria-label={`More servings of ${item.name}`}
                    className="relative size-8 flex items-center justify-center rounded-full bg-white/5 text-fg press active:scale-90 after:absolute after:-inset-1.5 after:content-['']"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`Remove ${item.name}`}
                    className="relative size-8 ml-1 flex items-center justify-center rounded-full text-fg-muted hover:text-danger press active:scale-90 after:absolute after:-inset-1.5 after:content-['']"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {state.items.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-fg-muted">Total</span>
            <MacroChips t={totals} />
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search dining hall items to add"
            placeholder="Search items to add..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-surface pl-10 pr-3 py-2.5 text-fg font-medium text-input focus:outline-none focus:ring-2 focus:ring-gold/40 placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {!catalogue ? (
          <p className="text-sm text-fg-muted mt-3" role="status">Loading items…</p>
        ) : q && results.length === 0 ? (
          <p className="text-sm text-fg-muted mt-3">No items match.</p>
        ) : (
          <ul className="mt-1 divide-y divide-white/10">
            {results.map((it) => (
              <li key={it.food.recipe_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg break-words">{it.food.name}</p>
                  <p className="text-11 text-fg-muted tabular-nums">
                    {it.food.portion || '1 serving'} · {Math.round(it.food.calories)} cal · P {Math.round(it.food.protein)}g
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addItem(it.food)}
                  aria-label={`Add ${it.food.name}`}
                  className="relative shrink-0 size-8 flex items-center justify-center rounded-full bg-gold text-on-gold shadow-md press active:scale-90 after:absolute after:-inset-1.5 after:content-['']"
                >
                  <Plus size={16} strokeWidth={2.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {state.id && (
        <div className="mt-5">
          <button
            type="button"
            onClick={remove_}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-1.5 min-h-tap px-4 rounded-xl border text-sm font-semibold press active:scale-95 disabled:opacity-40 ${confirmDelete ? 'border-danger bg-danger/15 text-danger' : 'border-white/15 bg-white/5 text-fg hover:bg-white/10'}`}
          >
            <Trash2 size={15} aria-hidden="true" />
            {confirmDelete ? 'Tap again to delete' : 'Delete recipe'}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}

// "Favorites": a collapsed row that opens into the student's whole favorites
// list. The X (or tapping the header) folds it back up.
function FavoritesSection({ catalogue }: { catalogue: BrowseItem[] | null }) {
  const favorites = useFavorites()
  const [open, setOpen] = useState(false)

  const entries = useMemo(() => {
    const byName = new Map<string, BrowseItem>()
    for (const it of catalogue ?? []) {
      const key = it.food.name.trim().toLowerCase()
      if (!byName.has(key)) byName.set(key, it)
    }
    return Array.from(favorites)
      .map((key) => {
        const found = byName.get(key)
        return { key, name: found?.food.name ?? key.replace(/^./, (c) => c.toUpperCase()), item: found }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [favorites, catalogue])

  const toggle = () => {
    setOpen((o) => !o)
    Haptics.selectionChanged().catch(() => {})
  }

  return (
    <section aria-label="Favorites" className="rounded-xl bg-surface-2 border border-white/10">
      <div className="flex items-center">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="favorites-list"
          className="flex-1 min-w-0 flex items-center gap-2 px-3 min-h-tap text-left press active:opacity-70"
        >
          <Heart size={16} className="shrink-0 text-macro-fat" fill="currentColor" aria-hidden="true" />
          <span className="font-semibold text-fg">Favorites</span>
          <span className="rounded-md px-1.5 text-11 font-bold tabular-nums bg-macro-fat/15 text-macro-fat">{entries.length}</span>
          {!open && (
            <ChevronDown size={16} className="ml-auto shrink-0 text-fg-muted" aria-hidden="true" />
          )}
        </button>
        {open && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Close favorites"
            className="relative shrink-0 size-8 mr-1.5 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-white/10 press active:scale-90 after:absolute after:-inset-1.5 after:content-['']"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div id="favorites-list" className="px-3 pb-3 animate-row-in">
          {entries.length === 0 ? (
            <p className="text-sm text-fg-muted py-2">Tap the heart on any item in Menu or Browse to add favorites.</p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto overscroll-contain divide-y divide-white/10">
              {entries.map(({ key, name, item }) => (
                <li key={key} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg break-words">{name}</p>
                    {item && (
                      <p className="text-11 text-fg-muted tabular-nums">
                        {Math.round(item.food.calories)} cal · P {Math.round(item.food.protein)}g ·{' '}
                        <span className={item.onToday ? 'font-semibold text-macro-protein' : ''}>
                          {item.onToday ? "On today's menu" : "Not on today's menu"}
                        </span>
                      </p>
                    )}
                  </div>
                  <FavoriteButton name={name} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
