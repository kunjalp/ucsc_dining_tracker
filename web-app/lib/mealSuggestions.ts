// lib/mealSuggestions.ts
//
// Rule-based "Close my rings" meal suggestions -- no AI, no network. Given
// what's left of today's targets and the items currently on the (already
// filtered) menu, finds combos (2-4 items by default; callers sizing for one
// meal pass their own range) whose combined macros land closest to the
// target, weighting protein most and never going more than ~10% over the
// target calories. Fully deterministic: same menu + same
// remaining macros always gives the same suggestions in the same order.

export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface SuggestionCandidate {
  recipe_id: string
  name: string
  portion: string
  station: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface ComboItem {
  food: SuggestionCandidate
  servings: number
}

export interface Combo {
  key: string
  items: ComboItem[]
  totals: Macros
}

export const SUGGESTION_SERVING_STEP = 0.5
export const SUGGESTION_MIN_SERVINGS = 0.5
export const SUGGESTION_MAX_SERVINGS = 2
const SERVING_CHOICES = [0.5, 1, 1.5, 2]

// Calorie ceiling as a multiple of what's left: tight (10% over) when the
// student is closing the Calories ring, loose (25%) when it's off, so a
// protein-only search still can't suggest an absurdly large meal
const CALORIE_OVERSHOOT = 1.1
const LOOSE_CALORIE_CEILING = 1.25
// Items considered: the best few per station, capped overall, so the search
// stays fast (~130k scored combos worst case) while keeping stations varied
const PER_STATION_POOL = 4
const MAX_POOL = 24
// Error weights -- protein matters most
const WEIGHTS: Macros = { calories: 2, protein: 3, carbs: 1, fat: 1 }
// Floors so a nearly-closed macro doesn't blow up the relative error
const FLOORS: Macros = { calories: 100, protein: 10, carbs: 15, fat: 5 }

export type MacroKey = keyof Macros
export const MACRO_KEYS: MacroKey[] = ['calories', 'protein', 'carbs', 'fat']
export const DEFAULT_FOCUS: MacroKey[] = ['calories', 'protein']

/** The selected macros that still have something left to close. */
export function activeFocus(focus: MacroKey[], remaining: Macros): MacroKey[] {
  return focus.filter((k) => remaining[k] > 0)
}

export function comboTotals(items: ComboItem[]): Macros {
  return items.reduce(
    (acc, { food, servings }) => ({
      calories: acc.calories + food.calories * servings,
      protein: acc.protein + food.protein * servings,
      carbs: acc.carbs + food.carbs * servings,
      fat: acc.fat + food.fat * servings,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

// Usable for suggestions: real, positive calories and finite numbers for
// every macro (items the label scrape left blank are skipped, not guessed)
function hasUsableNutrition(c: SuggestionCandidate): boolean {
  return (
    MACRO_KEYS.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]) && c[k] >= 0) &&
    c.calories > 0
  )
}

// Near-duplicates: at least half of the smaller combo's foods are also in
// the other one (servings ignored)
function isNearDuplicate(a: Combo, b: Combo): boolean {
  const idsA = new Set(a.items.map((i) => i.food.recipe_id))
  const idsB = b.items.map((i) => i.food.recipe_id)
  const shared = idsB.filter((id) => idsA.has(id)).length
  return shared / Math.min(idsA.size, idsB.length) >= 0.5
}

// Toppings and add-ons (dressings, sauces, butters, grated cheese) aren't a
// meal on their own, so they're never suggested
function isCondiment(c: SuggestionCandidate): boolean {
  return /condiment/i.test(c.station)
}

function makeKey(items: ComboItem[]): string {
  return items.map((i) => `${i.food.recipe_id}x${i.servings}`).join('|')
}

export interface SuggestOptions {
  // Items per combo (1-4)
  minItems?: number
  maxItems?: number
  // Combos under this many calories are skipped (only applied when the
  // target itself is at least this big)
  minCalories?: number
}

/**
 * Up to `count` suggested combos (may be fewer, or none, if nothing fits).
 * `remaining` is the target to aim for (a meal's share or the whole rest of
 * the day). `focus` is which rings to close: only those macros (that still
 * have something left) are scored; the others never influence the pick.
 */
export function suggestCombos(
  candidates: SuggestionCandidate[],
  remaining: Macros,
  focus: MacroKey[] = DEFAULT_FOCUS,
  count = 3,
  { minItems = 2, maxItems = 4, minCalories = 0 }: SuggestOptions = {}
): Combo[] {
  const active = activeFocus(focus, remaining)
  if (active.length === 0 || remaining.calories <= 0) return []
  const minItemCount = Math.max(1, Math.min(4, minItems))
  const maxItemCount = Math.max(minItemCount, Math.min(4, maxItems))
  const calFloor = remaining.calories >= minCalories ? minCalories : 0
  const calCap = remaining.calories * (focus.includes('calories') ? CALORIE_OVERSHOOT : LOOSE_CALORIE_CEILING)
  const isActive = { calories: false, protein: false, carbs: false, fat: false }
  active.forEach((k) => { isActive[k] = true })

  // How well one serving moves the active non-calorie rings per calorie
  // spent (protein weighted most) -- decides which items make the pool.
  // Calories-only: items closest to an even split of the target (by the
  // typical combo size) rank first.
  const nonCalorie = active.filter((k) => k !== 'calories')
  const fitness = (c: SuggestionCandidate) =>
    nonCalorie.length > 0
      ? nonCalorie.reduce((sum, k) => sum + (WEIGHTS[k] * c[k]) / Math.max(remaining[k], FLOORS[k]), 0) / c.calories
      : -Math.abs(c.calories - remaining.calories / ((minItemCount + maxItemCount) / 2))

  // De-dupe by recipe and drop unusable items; sort deterministically
  const seen = new Set<string>()
  const usable = candidates
    .filter((c) => {
      if (seen.has(c.recipe_id) || !hasUsableNutrition(c) || isCondiment(c)) return false
      seen.add(c.recipe_id)
      return c.calories * SUGGESTION_MIN_SERVINGS <= calCap
    })
    .sort((a, b) => fitness(b) - fitness(a) || a.name.localeCompare(b.name) || a.recipe_id.localeCompare(b.recipe_id))

  // Best few per station (by fitness), then capped overall
  const perStation = new Map<string, number>()
  const pool = usable.filter((c) => {
    const n = perStation.get(c.station) ?? 0
    if (n >= PER_STATION_POOL) return false
    perStation.set(c.station, n + 1)
    return true
  }).slice(0, MAX_POOL)

  // Plain number arrays + one candidate object per *kept* combo only: the
  // search scores ~130k combos, so it can't allocate per combo and stay fast.
  const n = pool.length
  const cal = pool.map((c) => c.calories)
  const pro = pool.map((c) => c.protein)
  const carb = pool.map((c) => c.carbs)
  const fat = pool.map((c) => c.fat)
  const stationIds = new Map<string, number>()
  const st = pool.map((c) => {
    if (!stationIds.has(c.station)) stationIds.set(c.station, stationIds.size)
    return stationIds.get(c.station)!
  })

  // Only active (selected, still-open) macros add error
  const macroError = (k: MacroKey, total: number) => {
    if (!isActive[k]) return 0
    const diff = (total - remaining[k]) / Math.max(remaining[k], FLOORS[k])
    // The 10% calorie allowance is a hard ceiling, not a target: going over
    // costs 4x as much as falling short by the same amount
    const overshoot = k === 'calories' && diff > 0 ? 4 : 1
    return WEIGHTS[k] * overshoot * diff * diff
  }
  const scoreNums = (c: number, p: number, cb: number, f: number, idx: number[], sv: number[]) => {
    let repeats = 0
    for (let i = 0; i < idx.length; i++) {
      for (let j = 0; j < i; j++) if (st[idx[i]] === st[idx[j]]) { repeats++; break }
    }
    let fractional = 0
    for (const s of sv) if (s !== 1) fractional++
    return macroError('calories', c) + macroError('protein', p) + macroError('carbs', cb) + macroError('fat', f) +
      0.15 * repeats + 0.02 * fractional
  }

  interface Cand { score: number; idx: number[]; sv: number[] }
  // Deterministic order: score, then item indices, then servings
  const compare = (x: Cand, y: Cand) => {
    if (x.score !== y.score) return x.score - y.score
    for (let i = 0; i < Math.min(x.idx.length, y.idx.length); i++) {
      if (x.idx[i] !== y.idx[i]) return x.idx[i] - y.idx[i]
    }
    if (x.idx.length !== y.idx.length) return x.idx.length - y.idx.length
    for (let i = 0; i < x.sv.length; i++) if (x.sv[i] !== y.sv[i]) return x.sv[i] - y.sv[i]
    return 0
  }

  // Keep only the best KEEP candidates (prune whenever the list doubles)
  const KEEP = 300
  let kept: Cand[] = []
  let threshold = Infinity
  // Sizes that can be picked directly; triples are still searched for a
  // 4-item range, as the bases the 4th item is added to
  const wants = (size: number) => size >= minItemCount && size <= maxItemCount
  const offer = (score: number, idx: number[], sv: number[], c: number) => {
    if (score > threshold || c < calFloor) return
    kept.push({ score, idx: [...idx], sv: [...sv] })
    if (kept.length >= KEEP * 2) {
      kept.sort(compare)
      kept = kept.slice(0, KEEP)
      threshold = kept[kept.length - 1].score
    }
  }

  const idx1 = [0]
  const sv1 = [0]
  const idx2 = [0, 0]
  const sv2 = [0, 0]
  const idx3 = [0, 0, 0]
  const sv3 = [0, 0, 0]
  const searchTriples = maxItemCount >= 3
  // Every single, pair and triple of pool items (in the sizes wanted),
  // every serving choice
  for (let a = 0; a < n; a++) {
    if (wants(1)) {
      for (const sa of SERVING_CHOICES) {
        const c = cal[a] * sa
        if (c > calCap) continue
        idx1[0] = a; sv1[0] = sa
        offer(scoreNums(c, pro[a] * sa, carb[a] * sa, fat[a] * sa, idx1, sv1), idx1, sv1, c)
      }
    }
    for (let b = a + 1; b < n; b++) {
      if (wants(2)) {
        for (const sa of SERVING_CHOICES) {
          for (const sb of SERVING_CHOICES) {
            const c = cal[a] * sa + cal[b] * sb
            if (c > calCap) continue
            idx2[0] = a; idx2[1] = b; sv2[0] = sa; sv2[1] = sb
            offer(scoreNums(c, pro[a] * sa + pro[b] * sb, carb[a] * sa + carb[b] * sb, fat[a] * sa + fat[b] * sb, idx2, sv2), idx2, sv2, c)
          }
        }
      }
      if (!searchTriples) continue
      for (let c3 = b + 1; c3 < n; c3++) {
        for (const sa of SERVING_CHOICES) {
          for (const sb of SERVING_CHOICES) {
            const cab = cal[a] * sa + cal[b] * sb
            if (cab > calCap) continue
            for (const sc of SERVING_CHOICES) {
              const c = cab + cal[c3] * sc
              if (c > calCap) continue
              idx3[0] = a; idx3[1] = b; idx3[2] = c3; sv3[0] = sa; sv3[1] = sb; sv3[2] = sc
              offer(
                scoreNums(
                  c,
                  pro[a] * sa + pro[b] * sb + pro[c3] * sc,
                  carb[a] * sa + carb[b] * sb + carb[c3] * sc,
                  fat[a] * sa + fat[b] * sb + fat[c3] * sc,
                  idx3, sv3
                ),
                idx3, sv3, c
              )
            }
          }
        }
      }
    }
  }
  kept.sort(compare)

  // Try growing the best triples into 4-item combos when a 4th item helps
  // (or, when only 4 items are wanted, whichever 4th item helps most)
  const extended: Cand[] = []
  const triples = wants(4) ? kept.filter((k) => k.idx.length === 3).slice(0, 40) : []
  for (const base of triples) {
    let c0 = 0, p0 = 0, cb0 = 0, f0 = 0
    base.idx.forEach((i, j) => {
      c0 += cal[i] * base.sv[j]; p0 += pro[i] * base.sv[j]; cb0 += carb[i] * base.sv[j]; f0 += fat[i] * base.sv[j]
    })
    let best: Cand | null = null
    for (let d = 0; d < n; d++) {
      if (base.idx.includes(d)) continue
      for (const sd of SERVING_CHOICES) {
        const c = c0 + cal[d] * sd
        if (c > calCap || c < calFloor) continue
        const idx = [...base.idx, d]
        const sv = [...base.sv, sd]
        const score = scoreNums(c, p0 + pro[d] * sd, cb0 + carb[d] * sd, f0 + fat[d] * sd, idx, sv)
        const cand = { score, idx, sv }
        if ((score < base.score || !wants(3)) && (!best || compare(cand, best) < 0)) best = cand
      }
    }
    if (best) extended.push(best)
  }

  const ranked = [...kept, ...extended].filter((k) => wants(k.idx.length)).sort(compare)
  const picked: Combo[] = []
  for (const cand of ranked) {
    if (picked.length >= count) break
    const items = cand.idx.map((i, j) => ({ food: pool[i], servings: cand.sv[j] }))
    const combo: Combo = { key: makeKey(items), items, totals: comboTotals(items) }
    if (picked.some((p) => isNearDuplicate(p, combo))) continue
    picked.push(combo)
  }
  return picked
}
