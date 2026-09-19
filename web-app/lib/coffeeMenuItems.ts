// lib/coffeeMenuItems.ts
//
// Stevenson Coffee House and Perk Coffee Bar are retail coffee-bar locations
// whose menus don't rotate day-to-day the way dining-hall entrees do (a
// fixed drink/pastry/sandwich lineup), so instead of relying on the daily
// Playwright scrape (which targets nutrition.sa.ucsc.edu's dropdown menus),
// we hardcode their published items and nutrition facts here and serve them
// directly, bypassing the `daily_menus` Supabase query entirely for these
// two halls.
//
// Source: https://nutrition.sa.ucsc.edu/ (UCSC's official FoodPro nutrition
// calculator), pulled directly on 2026-09-19.
//
// IMPORTANT CAVEATS:
//   - Perk Coffee Bar's menu is fully published and reflected below (88
//     unique items after de-duplicating a couple of add-ons the site lists
//     under two sections with identical values).
//   - Stevenson Coffee House does not open until 9/24/2026, and as of this
//     writing only has 15 "All Day" add-on items published on the official
//     site (no base drinks/sandwiches/pastries yet -- the full menu likely
//     gets added by UCSC Dining closer to or at opening). Re-pull this list
//     from nutrition.sa.ucsc.edu after 9/24 once Stevenson's full menu is
//     live (open the location -> Nutrition Calculator -> check every item,
//     qty=1 -> Show Nutrition Report).
//   - Because these are manually captured snapshots, not live-scraped data,
//     they will silently go stale if the coffee bars change their menu.
//     There's no price field here (the app doesn't track price) -- only
//     what's needed for macro tracking.

export interface HardcodedMenuItem {
  recipe_id: string
  name: string
  portion: string
  station: string
  calories: number
  protein: number
  carbs: number
  sugar: number
  fat: number
}

export const COFFEE_SHOP_NAMES = ['Stevenson Coffee House', 'Perk Coffee Bar'] as const

const PERK_ITEMS: HardcodedMenuItem[] = [
  { recipe_id: 'perk-breakfast-burrito', name: 'Breakfast Burrito', portion: '1 ea', station: 'Grab & Go', calories: 564.4, protein: 24.1, carbs: 59.8, sugar: 2.3, fat: 25.2 },
  { recipe_id: 'perk-calabrian-italian-club', name: 'Calabrian Italian Club', portion: '1 ea', station: 'Grab & Go', calories: 888.1, protein: 36.4, carbs: 53.5, sugar: 1.4, fat: 59.8 },
  { recipe_id: 'perk-chicken-penne-alfredo', name: 'Chicken Penne Alfredo', portion: '1 ea', station: 'Grab & Go', calories: 769.2, protein: 39.6, carbs: 94.1, sugar: 7.6, fat: 27.4 },
  { recipe_id: 'perk-chicken-salad-sandwich', name: 'Chicken Salad Sandwich', portion: '1 ea', station: 'Grab & Go', calories: 483.6, protein: 30.9, carbs: 45.0, sugar: 6.5, fat: 18.9 },
  { recipe_id: 'perk-chipotle-chicken-wrap', name: 'Chipotle Chicken Wrap', portion: '1 ea', station: 'Grab & Go', calories: 772.4, protein: 50.0, carbs: 53.1, sugar: 2.8, fat: 39.5 },
  { recipe_id: 'perk-pesto-chicken-salad-pita-sandwich', name: 'Pesto Chicken Salad Pita Sandwich', portion: '1 ea', station: 'Grab & Go', calories: 476.9, protein: 31.5, carbs: 34.7, sugar: 0.4, fat: 23.1 },
  { recipe_id: 'perk-pesto-pasta-salad', name: 'Pesto Pasta Salad', portion: '1 ea', station: 'Grab & Go', calories: 645.8, protein: 24.2, carbs: 113.8, sugar: 5.5, fat: 11.8 },
  { recipe_id: 'perk-roma-sandwich', name: 'Roma Sandwich', portion: '1 ea', station: 'Grab & Go', calories: 846.2, protein: 39.2, carbs: 55.6, sugar: 0.9, fat: 51.3 },
  { recipe_id: 'perk-rotisserie-chicken-caesar-salad', name: 'Rotisserie Chicken Caesar Salad', portion: '1 ea', station: 'Grab & Go', calories: 625.0, protein: 45.3, carbs: 14.5, sugar: 2.6, fat: 42.9 },
  { recipe_id: 'perk-the-gobbler', name: 'The Gobbler', portion: '1 ea', station: 'Grab & Go', calories: 631.8, protein: 36.9, carbs: 54.5, sugar: 7.2, fat: 25.2 },
  { recipe_id: 'perk-turkey-bacon-provolone-sandwich', name: 'Turkey Bacon Provolone Sandwich', portion: '1 ea', station: 'Grab & Go', calories: 618.2, protein: 38.9, carbs: 33.6, sugar: 5.1, fat: 36.4 },
  { recipe_id: 'perk-turkey-cheddar-croissant-sandwich', name: 'Turkey Cheddar Croissant Sandwich', portion: '1 ea', station: 'Grab & Go', calories: 404.5, protein: 24.8, carbs: 29.1, sugar: 4.5, fat: 20.7 },
  { recipe_id: 'perk-apple-blueberry-muffin', name: 'Apple Blueberry Muffin', portion: '3 ea', station: 'Campus Bakery', calories: 2009.5, protein: 12.4, carbs: 276.7, sugar: 163.5, fat: 95.4 },
  { recipe_id: 'perk-bacon-breakfast-burrito', name: 'Bacon Breakfast Burrito', portion: '3 ea', station: 'Campus Bakery', calories: 2231.3, protein: 95.2, carbs: 214.1, sugar: 4.1, fat: 104.4 },
  { recipe_id: 'perk-cheddar-garlic-croizel', name: 'Cheddar Garlic Croizel', portion: '1 ea', station: 'Campus Bakery', calories: 455.4, protein: 12.2, carbs: 36.5, sugar: 5.8, fat: 29.3 },
  { recipe_id: 'perk-chocolate-croissant', name: 'Chocolate Croissant', portion: '4 each', station: 'Campus Bakery', calories: 1440.0, protein: 28.0, carbs: 172.0, sugar: 64.0, fat: 76.0 },
  { recipe_id: 'perk-croissant', name: 'Croissant', portion: '3 each', station: 'Campus Bakery', calories: 1053.0, protein: 24.1, carbs: 114.3, sugar: 18.1, fat: 54.2 },
  { recipe_id: 'perk-maple-pecan-muffin', name: 'Maple Pecan Muffin', portion: '3 ea', station: 'Campus Bakery', calories: 2642.3, protein: 30.9, carbs: 183.0, sugar: 67.8, fat: 231.2 },
  { recipe_id: 'perk-vegan-chocolate-chip-cookies', name: 'Vegan Chocolate Chip Cookies', portion: '3 ea', station: 'Campus Bakery', calories: 865.6, protein: 9.1, carbs: 173.1, sugar: 118.4, fat: 45.6 },
  { recipe_id: 'perk-16-oz-cold-brew-coffee', name: '16 oz Cold Brew Coffee', portion: '16 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-americano-12oz', name: 'Americano 12oz', portion: '12 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-americano-16oz', name: 'Americano 16oz', portion: '16 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-americano-20-oz', name: 'Americano 20 oz', portion: '20 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-cappuccino-single', name: 'Cappuccino, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 108.1, protein: 5.6, carbs: 8.5, sugar: 8.5, fat: 5.8 },
  { recipe_id: 'perk-cappucino-double', name: 'Cappucino, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 96.1, protein: 5.0, carbs: 7.6, sugar: 7.6, fat: 5.1 },
  { recipe_id: 'perk-caramel-latte-double', name: 'Caramel Latte, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 495.1, protein: 11.2, carbs: 70.7, sugar: 60.8, fat: 18.5 },
  { recipe_id: 'perk-caramel-latte-single', name: 'Caramel Latte, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 479.2, protein: 16.4, carbs: 63.9, sugar: 55.9, fat: 17.4 },
  { recipe_id: 'perk-caramel-latte-triple', name: 'Caramel Latte, Triple', portion: '20 oz', station: 'Coffee & Tea', calories: 635.8, protein: 14.9, carbs: 89.6, sugar: 77.2, fat: 24.1 },
  { recipe_id: 'perk-chai-latte', name: 'Chai Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 237.1, protein: 5.6, carbs: 39.2, sugar: 39.2, fat: 5.8 },
  { recipe_id: 'perk-coconut-caramel-latte-16-oz', name: 'Coconut Caramel Latte, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 458.2, protein: 11.2, carbs: 65.5, sugar: 57.7, fat: 16.7 },
  { recipe_id: 'perk-coffee-12-oz', name: 'Coffee, 12 oz', portion: '12 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-coffee-16-oz', name: 'Coffee, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-coffee-20-oz', name: 'Coffee, 20 oz', portion: '20 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-cookie-butter-mocha-16-oz', name: 'Cookie Butter Mocha, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 385.6, protein: 9.5, carbs: 53.3, sugar: 46.9, fat: 14.9 },
  { recipe_id: 'perk-dirty-hazelnut-chai-latte', name: 'Dirty Hazelnut Chai Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 275.9, protein: 5.6, carbs: 48.4, sugar: 48.4, fat: 5.8 },
  { recipe_id: 'perk-espresso-double-shot', name: 'Espresso, Double Shot', portion: '4 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-espresso-single-shot', name: 'Espresso, Single Shot', portion: '2 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-espresso-triple-shot', name: 'Espresso, Triple Shot', portion: '6 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-hazelnut-brittle-latte-16-oz', name: 'Hazelnut Brittle Latte, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 464.4, protein: 11.2, carbs: 66.6, sugar: 59.2, fat: 16.7 },
  { recipe_id: 'perk-hazelnut-latte-double', name: 'Hazelnut Latte, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-hazelnut-latte-single', name: 'Hazelnut Latte, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 214.9, protein: 7.5, carbs: 28.1, sugar: 28.1, fat: 7.7 },
  { recipe_id: 'perk-hazelnut-latte-triple', name: 'Hazelnut Latte, Triple', portion: '20 oz', station: 'Coffee & Tea', calories: 386.1, protein: 14.9, carbs: 45.8, sugar: 45.8, fat: 15.4 },
  { recipe_id: 'perk-hazelnut-milk-chocolate-mocha-16-oz', name: 'Hazelnut Milk Chocolate Mocha, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 374.4, protein: 10.5, carbs: 54.9, sugar: 51.0, fat: 12.9 },
  { recipe_id: 'perk-honey-lavender-latte-16-oz', name: 'Honey Lavender Latte, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 282.8, protein: 11.3, carbs: 34.6, sugar: 33.8, fat: 11.6 },
  { recipe_id: 'perk-horchata-latte', name: 'Horchata Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 404.2, protein: 13.2, carbs: 47.6, sugar: 43.7, fat: 18.5 },
  { recipe_id: 'perk-hot-chocolate', name: 'Hot Chocolate', portion: '16 oz', station: 'Coffee & Tea', calories: 547.9, protein: 16.0, carbs: 73.3, sugar: 68.0, fat: 22.1 },
  { recipe_id: 'perk-hot-tea', name: 'Hot Tea', portion: '12 oz', station: 'Coffee & Tea', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-latte-double', name: 'Latte, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 216.9, protein: 11.2, carbs: 17.1, sugar: 17.1, fat: 11.6 },
  { recipe_id: 'perk-latte-single', name: 'Latte, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 180.7, protein: 9.3, carbs: 14.2, sugar: 14.2, fat: 9.6 },
  { recipe_id: 'perk-latte-triple', name: 'Latte, Triple', portion: '20 oz', station: 'Coffee & Tea', calories: 253.0, protein: 13.1, carbs: 19.9, sugar: 19.9, fat: 13.5 },
  { recipe_id: 'perk-london-fog-tea-latte', name: 'London Fog Tea Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 224.4, protein: 9.3, carbs: 25.3, sugar: 24.2, fat: 9.7 },
  { recipe_id: 'perk-matcha-green-tea-latte', name: 'Matcha Green Tea Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 405.2, protein: 14.0, carbs: 47.7, sugar: 44.1, fat: 18.0 },
  { recipe_id: 'perk-mexican-mocha-16-oz', name: 'Mexican Mocha, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 522.5, protein: 12.4, carbs: 79.8, sugar: 72.4, fat: 18.2 },
  { recipe_id: 'perk-mocha-double', name: 'Mocha, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 475.6, protein: 12.3, carbs: 67.6, sugar: 62.3, fat: 18.2 },
  { recipe_id: 'perk-mocha-single', name: 'Mocha, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 383.9, protein: 9.9, carbs: 52.1, sugar: 47.9, fat: 15.8 },
  { recipe_id: 'perk-mocha-triple', name: 'Mocha, Triple', portion: '20 oz', station: 'Coffee & Tea', calories: 565.5, protein: 14.6, carbs: 82.7, sugar: 76.4, fat: 20.6 },
  { recipe_id: 'perk-peppermint-matcha-latte', name: 'Peppermint Matcha Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 444.0, protein: 14.0, carbs: 57.4, sugar: 53.3, fat: 18.0 },
  { recipe_id: 'perk-peppermint-mocha-16-oz', name: 'Peppermint Mocha, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 553.2, protein: 12.3, carbs: 87.0, sugar: 80.7, fat: 18.2 },
  { recipe_id: 'perk-pumpkin-chai-latte', name: 'Pumpkin Chai Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 428.0, protein: 5.6, carbs: 85.0, sugar: 83.1, fat: 5.8 },
  { recipe_id: 'perk-pumpkin-latte-16-oz', name: 'Pumpkin Latte, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 407.8, protein: 11.2, carbs: 62.9, sugar: 61.0, fat: 11.6 },
  { recipe_id: 'perk-raspberry-white-mocha-16-oz', name: 'Raspberry White Mocha, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 565.5, protein: 10.9, carbs: 78.6, sugar: 71.4, fat: 23.3 },
  { recipe_id: 'perk-salted-caramel-mocha-16-oz', name: 'Salted Caramel Mocha, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 469.2, protein: 12.2, carbs: 69.6, sugar: 62.5, fat: 16.1 },
  { recipe_id: 'perk-spanish-latte-16-oz', name: 'Spanish Latte, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 321.3, protein: 13.7, carbs: 36.5, sugar: 33.0, fat: 14.1 },
  { recipe_id: 'perk-strawberry-matcha-latte', name: 'Strawberry Matcha Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 447.3, protein: 14.0, carbs: 58.2, sugar: 53.6, fat: 18.0 },
  { recipe_id: 'perk-tea-latte', name: 'Tea Latte', portion: '16 oz', station: 'Coffee & Tea', calories: 184.4, protein: 9.3, carbs: 15.3, sugar: 14.2, fat: 9.7 },
  { recipe_id: 'perk-vanilla-latte-double', name: 'Vanilla Latte, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 294.4, protein: 11.2, carbs: 36.5, sugar: 36.5, fat: 11.6 },
  { recipe_id: 'perk-vanilla-latte-single', name: 'Vanilla Latte, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 214.9, protein: 7.5, carbs: 29.0, sugar: 28.9, fat: 7.7 },
  { recipe_id: 'perk-vanilla-latte-triple', name: 'Vanilla Latte, Triple', portion: '20 oz', station: 'Coffee & Tea', calories: 386.1, protein: 14.9, carbs: 47.0, sugar: 47.0, fat: 15.4 },
  { recipe_id: 'perk-vietnamese-coffee-16-oz', name: 'Vietnamese Coffee, 16 oz', portion: '16 oz', station: 'Coffee & Tea', calories: 46.6, protein: 1.1, carbs: 7.9, sugar: 7.9, fat: 1.3 },
  { recipe_id: 'perk-whipped-cream', name: 'Whipped Cream', portion: '1 oz', station: 'Coffee & Tea', calories: 76.0, protein: 0.9, carbs: 3.7, sugar: 2.4, fat: 6.6 },
  { recipe_id: 'perk-white-mocha-double', name: 'White Mocha, Double', portion: '16 oz', station: 'Coffee & Tea', calories: 463.4, protein: 10.7, carbs: 56.5, sugar: 50.5, fat: 21.8 },
  { recipe_id: 'perk-white-mocha-single', name: 'White Mocha, Single', portion: '12 oz', station: 'Coffee & Tea', calories: 375.9, protein: 8.8, carbs: 44.0, sugar: 39.2, fat: 18.5 },
  { recipe_id: 'perk-white-mocha-triple', name: 'White Mocha, Triple', portion: '20 oz', station: 'Coffee & Tea', calories: 561.9, protein: 12.7, carbs: 71.0, sugar: 63.6, fat: 25.4 },
  { recipe_id: 'perk-dirty-vanilla-tonic', name: 'Dirty Vanilla Tonic', portion: '16 oz', station: 'Beverages', calories: 101.8, protein: 0.0, carbs: 25.5, sugar: 25.5, fat: 0.0 },
  { recipe_id: 'perk-iced-horchata', name: 'Iced Horchata', portion: '16 oz', station: 'Beverages', calories: 285.1, protein: 8.9, carbs: 34.3, sugar: 31.3, fat: 12.9 },
  { recipe_id: 'perk-italian-soda', name: 'Italian Soda', portion: '16 oz', station: 'Beverages', calories: 77.6, protein: 0.0, carbs: 19.4, sugar: 18.4, fat: 0.0 },
  { recipe_id: 'perk-peach-mango-refresher', name: 'Peach Mango Refresher', portion: '16 oz', station: 'Beverages', calories: 131.5, protein: 0.0, carbs: 32.9, sugar: 32.9, fat: 0.0 },
  { recipe_id: 'perk-add-caramel-sauce', name: 'Add Caramel Sauce', portion: '1 oz', station: 'All Day', calories: 141.3, protein: 0.0, carbs: 27.3, sugar: 22.2, fat: 3.5 },
  { recipe_id: 'perk-add-chai', name: 'Add Chai', portion: '3 oz', station: 'All Day', calories: 64.2, protein: 0.0, carbs: 15.3, sugar: 15.3, fat: 0.0 },
  { recipe_id: 'perk-add-chocolate-sauce', name: 'Add Chocolate Sauce', portion: '1 oz', station: 'All Day', calories: 111.0, protein: 1.0, carbs: 25.2, sugar: 23.2, fat: 1.0 },
  { recipe_id: 'perk-add-espresso-shot', name: 'Add Espresso Shot', portion: '1 oz', station: 'All Day', calories: 0.0, protein: 0.0, carbs: 0.0, sugar: 0.0, fat: 0.0 },
  { recipe_id: 'perk-add-horchata', name: 'Add Horchata', portion: '0.5 oz', station: 'All Day', calories: 74.9, protein: 0.8, carbs: 12.2, sugar: 10.7, fat: 2.8 },
  { recipe_id: 'perk-add-matcha', name: 'Add Matcha', portion: '1 tbsp', station: 'All Day', calories: 81.2, protein: 0.5, carbs: 14.8, sugar: 12.9, fat: 2.4 },
  { recipe_id: 'perk-add-pumpkin-sauce', name: 'Add Pumpkin Sauce', portion: '1 oz', station: 'All Day', calories: 97.0, protein: 0.0, carbs: 23.3, sugar: 22.3, fat: 0.0 },
  { recipe_id: 'perk-coffee-bar-syrup-add-on', name: 'Coffee Bar Syrup Add On', portion: '1 oz', station: 'All Day', calories: 70.3, protein: 0.0, carbs: 17.6, sugar: 17.6, fat: 0.0 },
  { recipe_id: 'perk-gluten-free-oat-milk', name: 'Gluten-Free Oat Milk', portion: '16 oz', station: 'All Day', calories: 283.8, protein: 3.8, carbs: 34.0, sugar: 13.2, fat: 17.0 },
  { recipe_id: 'perk-half-half', name: 'Half & Half', portion: '16 oz', station: 'All Day', calories: 557.9, protein: 14.2, carbs: 21.5, sugar: 18.7, fat: 47.1 },
  { recipe_id: 'perk-soy-milk', name: 'Soy Milk', portion: '16 oz', station: 'All Day', calories: 168.7, protein: 7.5, carbs: 11.2, sugar: 13.1, fat: 6.6 },
]

const STEVENSON_ITEMS: HardcodedMenuItem[] = [
  { recipe_id: 'stevenson-add-avocado', name: 'Add Avocado', portion: '1/4 ea', station: 'All Day', calories: 108.2, protein: 1.3, carbs: 5.6, sugar: 0.2, fat: 10.0 },
  { recipe_id: 'stevenson-add-bacon', name: 'Add Bacon', portion: '2 ea', station: 'All Day', calories: 90.0, protein: 5.0, carbs: 0.0, sugar: 0.0, fat: 6.0 },
  { recipe_id: 'stevenson-add-cheddar-cheese', name: 'Add Cheddar Cheese', portion: '1 ea', station: 'All Day', calories: 86.1, protein: 4.9, carbs: 0.7, sugar: 0.1, fat: 7.1 },
  { recipe_id: 'stevenson-add-pepper-jack-cheese', name: 'Add Pepper Jack Cheese', portion: '1 ea', station: 'All Day', calories: 78.2, protein: 4.3, carbs: 0.0, sugar: 0.0, fat: 6.4 },
  { recipe_id: 'stevenson-add-sliced-red-onion', name: 'Add Sliced Red Onion', portion: '1 oz', station: 'All Day', calories: 11.3, protein: 0.3, carbs: 2.6, sugar: 1.2, fat: 0.0 },
  { recipe_id: 'stevenson-add-sliced-tomato', name: 'Add Sliced Tomato', portion: '1 oz', station: 'All Day', calories: 5.1, protein: 0.2, carbs: 1.1, sugar: 0.7, fat: 0.1 },
  { recipe_id: 'stevenson-chipotle-aioli', name: 'Chipotle Aioli', portion: '1 oz', station: 'All Day', calories: 154.6, protein: 0.0, carbs: 0.2, sugar: 0.1, fat: 17.3 },
  { recipe_id: 'stevenson-coffee-bar-syrup-add-on', name: 'Coffee Bar Syrup Add On', portion: '1 oz', station: 'All Day', calories: 70.3, protein: 0.0, carbs: 17.6, sugar: 17.6, fat: 0.0 },
  { recipe_id: 'stevenson-gluten-free-oat-milk', name: 'Gluten-Free Oat Milk', portion: '16 oz', station: 'All Day', calories: 283.8, protein: 3.8, carbs: 34.0, sugar: 13.2, fat: 17.0 },
  { recipe_id: 'stevenson-half-half', name: 'Half & Half', portion: '16 oz', station: 'All Day', calories: 557.9, protein: 14.2, carbs: 21.5, sugar: 18.7, fat: 47.1 },
  { recipe_id: 'stevenson-italian-dry-salami', name: 'Italian Dry Salami', portion: '3 oz', station: 'All Day', calories: 340.2, protein: 19.8, carbs: 2.8, sugar: 2.8, fat: 28.4 },
  { recipe_id: 'stevenson-oven-roasted-turkey-breast', name: 'Oven Roasted Turkey Breast', portion: '2 oz', station: 'All Day', calories: 60.8, protein: 10.1, carbs: 0.0, sugar: 0.0, fat: 2.0 },
  { recipe_id: 'stevenson-sliced-smoked-provolone-cheese', name: 'Sliced Smoked Provolone Cheese', portion: '1 oz', station: 'All Day', calories: 94.5, protein: 6.8, carbs: 0.0, sugar: 0.0, fat: 8.1 },
  { recipe_id: 'stevenson-soy-milk', name: 'Soy Milk', portion: '16 oz', station: 'All Day', calories: 168.7, protein: 7.5, carbs: 11.2, sugar: 13.1, fat: 6.6 },
  { recipe_id: 'stevenson-whipped-cream', name: 'Whipped Cream', portion: '1 oz', station: 'All Day', calories: 76.0, protein: 0.9, carbs: 3.7, sugar: 2.4, fat: 6.6 },
]

const COFFEE_MENU: Record<string, { mealType: string; items: HardcodedMenuItem[] }> = {
  'Perk Coffee Bar': { mealType: 'ALL', items: PERK_ITEMS },
  'Stevenson Coffee House': { mealType: 'Menu', items: STEVENSON_ITEMS },
}

/**
 * Returns the hardcoded meal_type value(s) to show for a coffee shop's
 * single pseudo-meal-period tab (these locations don't have
 * Breakfast/Lunch/Dinner), or null if `hallName` isn't a hardcoded coffee
 * shop.
 */
export function getCoffeeShopMealTypes(hallName: string): string[] | null {
  const entry = COFFEE_MENU[hallName]
  return entry ? [entry.mealType] : null
}

/**
 * Returns the hardcoded item list for a coffee shop, shaped to match the
 * scraped food_items/daily_menus fields the rest of the app expects, or
 * null if `hallName` isn't a hardcoded coffee shop.
 */
export function getCoffeeShopMenu(hallName: string): HardcodedMenuItem[] | null {
  const entry = COFFEE_MENU[hallName]
  return entry ? entry.items : null
}

export function isHardcodedCoffeeShop(hallName: string): boolean {
  return hallName in COFFEE_MENU
}