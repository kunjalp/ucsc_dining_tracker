// Run from web-app/: node --test lib/weeklySummary.test.mts
// Node strips the TypeScript itself. A tiny resolve hook maps the app's
// "@/..." alias and extensionless imports to the .ts files, so no test
// library or build step is needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const root = ${JSON.stringify(new URL('../', import.meta.url).href)};
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) spec = root + spec.slice(2);
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\\.[cm]?[jt]s$/.test(spec)) spec += '.ts';
        return next(spec, ctx);
      }
    `)
)

const ws = await import('./weeklySummary')
const { computeWeeklySummary, largestRemainder, macroSplit } = ws as typeof import('./weeklySummary')

const TODAY = '2026-11-18'
const goals = { calories: 2000, protein: 100 }
const log = (log_date: string, calories: number, protein: number, carbs?: number, fat?: number, servings = 1) => ({
  log_date,
  servings,
  food_items: { calories, protein, carbs, fat },
})

test('uses the 7 completed days before today, oldest first', () => {
  const s = computeWeeklySummary([], goals, TODAY)
  assert.equal(s.days.length, 7)
  assert.equal(s.days[0].date, '2026-11-11')
  assert.equal(s.days[6].date, '2026-11-17')
  assert.equal(s.loggedDays, 0)
  assert.equal(s.bestDay, null)
})

test('existing logic: averages over logged days, hits and best day', () => {
  const s = computeWeeklySummary(
    [
      log('2026-11-17', 2000, 100), // hit, perfect
      log('2026-11-16', 1500, 50), // miss
      log('2026-11-15', 2150, 95), // hit (107.5%, 95%)
      log(TODAY, 5000, 300), // today: ignored
      log('2026-11-01', 5000, 300), // too old: ignored
    ],
    goals,
    TODAY
  )
  assert.equal(s.loggedDays, 3)
  assert.equal(s.hitDays, 2)
  assert.equal(Math.round(s.avgCalories), Math.round((2000 + 1500 + 2150) / 3))
  assert.equal(Math.round(s.avgProtein), Math.round((100 + 50 + 95) / 3))
  assert.equal(s.bestDay?.date, '2026-11-17')
})

test('new fields: per-day carbs and fat, scaled by servings', () => {
  const s = computeWeeklySummary(
    [log('2026-11-17', 500, 20, 60, 15, 2), log('2026-11-17', 300, 10, 30, 10)],
    goals,
    TODAY
  )
  const d = s.days[6]
  assert.equal(d.calories, 1300)
  assert.equal(d.protein, 50)
  assert.equal(d.carbs, 150)
  assert.equal(d.fat, 40)
})

test('missing carbs/fat count as 0', () => {
  const s = computeWeeklySummary([log('2026-11-17', 500, 20)], goals, TODAY)
  assert.equal(s.days[6].carbs, 0)
  assert.equal(s.days[6].fat, 0)
})

test('largestRemainder always adds up to 100', () => {
  assert.deepEqual(largestRemainder([1, 1, 1]), [34, 33, 33])
  assert.deepEqual(largestRemainder([0, 0, 0]), [0, 0, 0])
  assert.deepEqual(largestRemainder([5, 0, 0]), [100, 0, 0])
  for (let i = 0; i < 500; i++) {
    const v = [Math.random() * 900, Math.random() * 900, Math.random() * 900]
    assert.equal(largestRemainder(v).reduce((a, b) => a + b, 0), 100)
  }
})

test('macroSplit: 4/4/9 kcal per gram, protein-carbs-fat order, percents sum to 100', () => {
  // 81g P = 324, 160g C = 640, 55g F = 495 -> 1459 kcal
  const parts = macroSplit({ protein: 81, carbs: 160, fat: 55 })
  assert.deepEqual(parts.map((p) => p.key), ['protein', 'carbs', 'fat'])
  assert.deepEqual(parts.map((p) => p.grams), [81, 160, 55])
  assert.deepEqual(parts.map((p) => p.pct), [22, 44, 34])
  assert.equal(parts.reduce((a, p) => a + p.pct, 0), 100)
  assert.ok(Math.abs(parts.reduce((a, p) => a + p.share, 0) - 1) < 1e-9)
})

test('macroSplit: no macros gives zero shares', () => {
  const parts = macroSplit({ protein: 0, carbs: 0, fat: 0 })
  assert.deepEqual(parts.map((p) => p.pct), [0, 0, 0])
  assert.deepEqual(parts.map((p) => p.share), [0, 0, 0])
})
