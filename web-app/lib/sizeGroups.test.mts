// Run from web-app/: node --test lib/sizeGroups.test.mts
// Same setup as weeklySummary.test.mts: a tiny resolve hook maps "@/..." and
// extensionless imports to the .ts files, so no test library is needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      const root = ${JSON.stringify(new URL('../', import.meta.url).href)};
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) spec = root + spec.slice(2);
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\.[cm]?[jt]s$/.test(spec)) spec += '.ts';
        return next(spec, ctx);
      }
    `)
)

const mod = await import('./sizeGroups')
const { groupSizes, parsePortion, recipeBase } = mod as typeof import('./sizeGroups')

interface Row {
  hall: string
  meal: string
  food: { recipe_id: string; name: string; portion: string; calories: number; protein: number; carbs: number; fat: number }
}
const row = (hall: string, meal: string, recipe_id: string, name: string, portion: string, calories: number, protein = 0, carbs = 0, fat = 0): Row => ({
  hall,
  meal,
  food: { recipe_id, name, portion, calories, protein, carbs, fat },
})
const ids = (groups: Row[][]) => groups.map((g) => g.map((r) => r.food.recipe_id))
const byHallMeal = { contextOf: (r: Row) => `${r.hall}|${r.meal}` }

const milk8 = row('Cowell', 'Lunch', '888804*8', 'Whole Milk', '8 ozl', 144.57, 7.466, 11.376, 7.703)
const milk6 = row('Cowell', 'Lunch', '888804*6', 'Whole Milk', '6 ozl', 108.428, 5.6, 8.532, 5.777)

test('same name + hall + meal merges sizes, smallest first', () => {
  const groups = groupSizes([milk8, milk6], (r) => r.food, byHallMeal)
  assert.deepEqual(ids(groups), [['888804*6', '888804*8']])
})

test('name match ignores case and surrounding spaces', () => {
  const shouty = row('Cowell', 'Lunch', '888804*6', '  WHOLE MILK ', '6 ozl', 108.428, 5.6, 8.532, 5.777)
  assert.deepEqual(ids(groupSizes([milk8, shouty], (r) => r.food, byHallMeal)), [['888804*6', '888804*8']])
})

test('a different hall stays separate', () => {
  const crown6 = { ...milk6, hall: 'Crown' }
  assert.deepEqual(ids(groupSizes([milk8, crown6], (r) => r.food, byHallMeal)), [['888804*8'], ['888804*6']])
})

test('a different meal stays separate', () => {
  const dinner6 = { ...milk6, meal: 'Dinner' }
  assert.equal(groupSizes([milk8, dinner6], (r) => r.food, byHallMeal).length, 2)
})

test('a different name stays separate', () => {
  const yogurt = row('Cowell', 'Lunch', '890003*4', 'Whole Milk Greek Yogurt', '4 ozl', 104.9, 10.5, 4.8, 4.8)
  assert.deepEqual(ids(groupSizes([milk6, yogurt], (r) => r.food, byHallMeal)), [['888804*6'], ['890003*4']])
})

test('same name but a different recipe (brand) stays separate', () => {
  const a = row('Cowell', 'Lunch', '888849*8', 'Apple Juice', '8 ozl', 110.444, 0, 26.105, 0)
  const b = row('Cowell', 'Lunch', '888879*8', 'Apple Juice', '8 ozl', 113.421, 0, 27.41, 0)
  const b6 = row('Cowell', 'Lunch', '888879*6', 'Apple Juice', '6 ozl', 85.066, 0, 20.558, 0)
  assert.deepEqual(ids(groupSizes([a, b, b6], (r) => r.food, byHallMeal)), [['888849*8'], ['888879*6', '888879*8']])
})

test('exact copies under another recipe id join the group once', () => {
  const p2 = row('JRL', 'Lunch', '888817*2', 'Fresh Pineapple', '2 oz', 28.35, 0.306, 7.439, 0.068)
  const copy2 = row('JRL', 'Lunch', '889999*2', 'Fresh Pineapple', '2 oz', 28.35, 0.306, 7.439, 0.068)
  const p4 = row('JRL', 'Lunch', '888817*4', 'Fresh Pineapple', '4 oz', 56.7, 0.612, 14.878, 0.136)
  assert.deepEqual(ids(groupSizes([copy2, p4, p2], (r) => r.food, byHallMeal)), [['889999*2', '888817*4']])
})

test('nutrition that is not a size change is split off', () => {
  const small = row('Cowell', 'Lunch', '500*4', 'Chili', '4 oz', 100)
  const odd = row('Cowell', 'Lunch', '500*8', 'Chili', '8 oz', 320) // 2x size, 3.2x calories
  assert.deepEqual(ids(groupSizes([small, odd], (r) => r.food, byHallMeal)), [['500*4'], ['500*8']])
})

test('no context means one catalogue-wide group (Browse)', () => {
  const crown6 = { ...milk6, hall: 'Crown' }
  assert.deepEqual(ids(groupSizes([milk8, crown6], (r) => r.food)), [['888804*6', '888804*8']])
})

test('helpers', () => {
  assert.equal(recipeBase('888804*8'), '888804')
  assert.equal(recipeBase('plain'), 'plain')
  assert.deepEqual(parsePortion('6 ozl'), { amount: 6, unit: 'ozl' })
  assert.deepEqual(parsePortion('1/2 cup'), { amount: 0.5, unit: 'cup' })
  assert.equal(parsePortion('serving'), null)
})
