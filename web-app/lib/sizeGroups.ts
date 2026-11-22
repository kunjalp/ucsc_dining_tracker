// web-app/lib/sizeGroups.ts
// One row per food, with its serving sizes behind a picker.
//
// The dining site stores each serving size as its own food_items record. The
// recipe_id is "<recipe>*<size>": Whole Milk is 888804*6 (6 ozl, 108 cal) and
// 888804*8 (8 ozl, 145 cal). Records are grouped when they have the same name
// (trimmed, any case), the same context (the caller's hall + meal) and the
// same recipe part of the id. Two extra rules:
// - Exact copies (same name, portion and macros under different recipe ids,
//   e.g. Fresh Pineapple 888817*2 and 889999*2) count as one size and join
//   their recipes into one group.
// - A size whose nutrition per unit is more than 10% off the smallest size's
//   (same unit only) is not a size change, so it gets its own row.
// Different recipes with the same name (two Apple Juice brands, 110 vs 113
// cal at 8 oz) stay separate rows.

export interface SizedFood {
  recipe_id: string
  name: string
  portion?: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** "888804*8" -> "888804". Ids without a size part are their own recipe. */
export function recipeBase(id: string): string {
  const at = id.indexOf('*')
  return at === -1 ? id : id.slice(0, at)
}

/** "6 ozl" -> { amount: 6, unit: "ozl" }, "1/2 cup" -> { amount: 0.5, unit: "cup" } */
export function parsePortion(portion: string | null | undefined): { amount: number; unit: string } | null {
  const m = /^\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*([a-z]*)/i.exec(portion ?? '')
  if (!m) return null
  const amount = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  return { amount, unit: m[3].toLowerCase() }
}

const nameKey = (name: string) => name.trim().toLowerCase()
const portionKey = (portion: string | null | undefined) => (portion ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const r1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10
const signature = (f: SizedFood) =>
  [portionKey(f.portion), r1(f.calories), r1(f.protein), r1(f.carbs), r1(f.fat)].join('|')

const PER_UNIT_TOLERANCE = 0.1

function bySize(a: SizedFood, b: SizedFood): number {
  const pa = parsePortion(a.portion)
  const pb = parsePortion(b.portion)
  if (pa && pb && pa.unit === pb.unit && pa.amount !== pb.amount) return pa.amount - pb.amount
  return (Number(a.calories) || 0) - (Number(b.calories) || 0) || a.recipe_id.localeCompare(b.recipe_id)
}

// Does `food` look like `base` at a different size? Only checked when both
// portions parse to the same unit; otherwise the shared recipe id decides.
function isSizeOf(food: SizedFood, base: SizedFood): boolean {
  const pf = parsePortion(food.portion)
  const pb = parsePortion(base.portion)
  if (!pf || !pb || pf.unit !== pb.unit) return true
  if (pf.amount === pb.amount) return false // a second record at the same size is a different food
  const scale = pf.amount / pb.amount
  const total = (f: SizedFood) => (Number(f.calories) || 0) + (Number(f.protein) || 0) + (Number(f.carbs) || 0) + (Number(f.fat) || 0)
  const expected = (Number(base.calories) || 0) * scale
  const actual = Number(food.calories) || 0
  if (expected === 0 && actual === 0) {
    const e = total(base) * scale
    return e === 0 ? total(food) === 0 : Math.abs(total(food) - e) / e <= PER_UNIT_TOLERANCE
  }
  if (expected === 0) return false
  return Math.abs(actual - expected) / expected <= PER_UNIT_TOLERANCE
}

// Sorted smallest first; whatever fails the per-unit check is grouped again
function splitFamily<T>(items: T[], foodOf: (item: T) => SizedFood): T[][] {
  const sorted = [...items].sort((a, b) => bySize(foodOf(a), foodOf(b)))
  const kept: T[] = [sorted[0]]
  const rest: T[] = []
  for (const item of sorted.slice(1)) {
    const food = foodOf(item)
    const fits = isSizeOf(food, foodOf(sorted[0])) && kept.every((k) => isSizeOf(food, foodOf(k)))
    if (fits) kept.push(item)
    else rest.push(item)
  }
  return rest.length > 0 ? [kept, ...splitFamily(rest, foodOf)] : [kept]
}

export interface GroupOptions<T> {
  /** Items only group within the same context, e.g. `${hall}|${meal}` */
  contextOf?: (item: T) => string
  /** Other recipe ids this item already stands for (exact copies merged upstream) */
  aliasesOf?: (item: T) => readonly string[] | undefined
}

/**
 * Groups serving-size variants. Each group is sorted smallest size first, so
 * group[0] is the default size. Groups come back in the order their first
 * item appeared in `items`. Exact copies inside a group are dropped.
 */
export function groupSizes<T>(items: readonly T[], foodOf: (item: T) => SizedFood, options: GroupOptions<T> = {}): T[][] {
  const contextOf = options.contextOf ?? (() => '')
  const aliasesOf = options.aliasesOf ?? (() => undefined)

  // Union-find over "context|name|recipe" keys
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let root = k
    while (parent.get(root) !== root) root = parent.get(root)!
    parent.set(k, root)
    return root
  }
  const add = (k: string) => {
    if (!parent.has(k)) parent.set(k, k)
  }
  const join = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  const keyOf = new Map<T, string>()
  const firstBySignature = new Map<string, string>()
  for (const item of items) {
    const food = foodOf(item)
    const scope = `${contextOf(item)}|${nameKey(food.name)}`
    const key = `${scope}|${recipeBase(food.recipe_id)}`
    add(key)
    keyOf.set(item, key)
    for (const alias of aliasesOf(item) ?? []) {
      const aliasKey = `${scope}|${recipeBase(alias)}`
      add(aliasKey)
      join(key, aliasKey)
    }
    const sig = `${scope}|${signature(food)}`
    const seen = firstBySignature.get(sig)
    if (seen) join(seen, key)
    else firstBySignature.set(sig, key)
  }

  // Families in first-seen order, exact copies dropped
  const families = new Map<string, { items: T[]; sigs: Set<string> }>()
  for (const item of items) {
    const root = find(keyOf.get(item)!)
    let fam = families.get(root)
    if (!fam) {
      fam = { items: [], sigs: new Set() }
      families.set(root, fam)
    }
    const sig = signature(foodOf(item))
    if (fam.sigs.has(sig)) continue
    fam.sigs.add(sig)
    fam.items.push(item)
  }

  const position = new Map<T, number>()
  items.forEach((item, i) => {
    if (!position.has(item)) position.set(item, i)
  })
  const out: { group: T[]; order: number }[] = []
  for (const fam of families.values()) {
    for (const group of splitFamily(fam.items, foodOf)) {
      out.push({ group, order: Math.min(...group.map((g) => position.get(g) ?? 0)) })
    }
  }
  return out.sort((a, b) => a.order - b.order).map((o) => o.group)
}

