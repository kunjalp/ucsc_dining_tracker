// lib/stationClassifier.ts
//
// UCSC's Nutrition Calculator page structure varies between the menu
// listing page and the report page, and station headers for some sections
// (Cereal, Beverages, Bread & Bagels, Condiments, All Day) haven't reliably
// scraped correctly. Since these particular sections are largely fixed,
// recurring staple items (not daily-rotating entrees), we classify them by
// exact name instead of relying on scraping — used only as a FALLBACK when
// the scraper's station value comes back null/empty, so stations that
// already scrape correctly (Entrees, Grill, Hot Bars, Pizza, Soups, Sweet
// Treats, Campus Bakery, Clean Plate) are untouched.

const KNOWN_ITEM_STATIONS: Record<string, string> = {}

function register(station: string, items: string[]) {
  for (const item of items) {
    KNOWN_ITEM_STATIONS[item.toLowerCase()] = station
  }
}
register('Barista Station', [
  '2% Lactose Free Milk',
  'Califia Original Almond Milk',
  'Chai Tea Concentrate',
  'French Vanilla Coffee Creamer',
  'Gluten-Free Oatmilk',
  'Half & Half',
  'Hazelnut Coffee Creamer',
  'Nonfat Milk',
  'Organic French Roast Coffee',
  'Organic Vegan Sugar',
  'Plain Soy Milk',
  'Pure Clover Honey',
  'Splenda',
  'Vanilla Soy Milk',
  'Whipped Cream',
  'Whole Milk',
])

register('Beverages', [
  'Apple Juice',
  'Cranberry Juice',
  'Dr. Pepper',
  'Hot Chocolate',
  'Lemonade',
  'Lime Bubly',
  'Lipton Unsweetened Black Iced Tea',
  'Mountain Dew',
  'Orange Crush',
  'Orange Juice',
  'Passion Orange Guava Juice',
  'Pepsi',
  'Pepsi Zero',
  'Pink Lemonade',
  'Raspberry Bubly Water',
  'Root Beer',
  'Starry',
])

register('Bread & Bagels', [
  'Buttermilk Bread',
  'Cinnamon Raisin Bread',
  'Gluten Free Everything Bagel',
  'Gluten Free Plain Bagel',
  'Hamburger Bun',
  'Hot Dog Bun',
  'Large Sliced Sourdough',
  "Milton's Multigrain Bread",
  'Mountain White Gluten Free Bread',
  "Nature's Harvest Vegan Whole Wheat Bread",
  'Rye Bread',
  'Salted Brown Rice Cakes',
  'Sara Lee Blueberry Bagel',
  'Sara Lee Cinnamon Raisin Bagel',
  'Sara Lee Everything Bagel',
  'Sara Lee Onion Bagel',
  'Sara Lee Plain Bagel',
  'Sliced White Bread',
  'Sourdough English Muffin',
  "Udi's Gluten Free Cinnamon Raisin Bread",
  "Udi's Gluten Free Multigrain Bread",
  "Udi's Whole Grain Gluten Free Bread",
  'Wild Rice Cake',
])

register('Cereal', [
  'Cinnamon Puffins Cereal',
  'Cinnamon Toasters',
  'Crunchy Maple Sunrise Cereal',
  "Honey'd Corn Flakes",
  "Kellogg's Rice Krispies",
  "Leapin' Lemurs Organic Peanut Butter Chocolate Cereal",
  'Marshmallow Mateys',
  'Organic Mesa Sunrise',
  'Raisin Bran',
  'Sunrise Crunchy Cinnamon Cereal',
  'Toasty Os',
  'Tootie Frooties',
])

register('Condiments - Dressings, Oils & Vinegars', [
  "Annie's Balsamic Vinaigrette",
  "Annie's Organic French Dressing",
  "Annie's Sesame Ginger Dressing",
  "Annie's Vegan Lemon Tahini Dressing",
  "Annie's Vegan Shiitake Sesame Dressing",
  'Balsamic Vinaigrette',
  'Balsamic Vinegar',
  'Chunky Blue Cheese Dressing',
  'Creamy Caesar Dressing',
  'Extra Virgin Olive Oil',
  'Follow Your Heart Vegan Caesar Dressing',
  'Follow Your Heart Vegan Ranch Dressing',
  "Ken's Honey Mustard Dressing",
  "Ken's Ranch Dressing",
  'Low-Fat Italian Dressing',
  'Thousand Island Dressing',
])

register('Condiments - Hot Sauces & Seasonings', [
  'Cholula',
  'Cholula Chipotle Hot Sauce',
  'Crushed Red Pepper Flakes',
  "Melinda's Mango Hot Sauce",
  'Nutritional Yeast',
  'Pepper Plant Hot Sauce',
  'Pico de Gallo Salsa',
  'Salsa Picante',
  'Salsa Verde',
  'Sriracha Hot Chili Sauce',
  'Tabasco Green Pepper Sauce',
  'Tabasco Pepper Sauce',
  'Tajin Seasoning',
  'Tapatio Salsa Picante',
])

register('Condiments - Sauces & Syrups', [
  'A1 Steak Sauce',
  'Gluten Free Tamari Soy Sauce',
  'Heinz BBQ Sauce',
  'Heinz Honey Mustard',
  'Heinz Ketchup',
  'Heinz Mustard',
  'Imitation Maple Syrup',
  'Organic Agave Syrup',
  'Strawberry Pancake Topping',
  'Vegan Mayonnaise',
])

register('Condiments - Spreads & Butters', [
  'Almond Butter',
  'Blackberry Jam',
  'Creamy Peanut Butter',
  'Grape Jelly',
  'Grated Parmesan Cheese',
  'Guacamole',
  'Individual Cream Cheese',
  'Individual Grape Jelly Cup',
  'Individual Peanut Butter Cup',
  'Individual Salted Butter Pat',
  'Individual Strawberry Jelly Cup',
  'Nutella',
  'Orange Marmalade',
  'Plain Cream Cheese',
  'Salted Butter',
  'Sour Cream',
  'Strawberry Preserves',
  'Unsalted Butter',
  'Vegan Butter Spread',
  'Vegan Cream Cheese',
  'Vegan Cream Cheese With Chives',
])

register('Dairy & Yogurt', [
  'Cottage Cheese',
  'Plain Soy Milk Yogurt',
  'Plain Unsweetened Coconut Milk Yogurt',
  'Plain Yogurt',
  'Sweetened Shredded Coconut',
  'Unsweetened Vanilla Coconut Milk Vegan Yogurt',
  'Vanilla Cashew Milk Yogurt',
  'Whole Milk Greek Yogurt',
])

register('Deli Bar', [
  'American Cheese',
  'Diced Chicken',
  'Fresh Lettuce',
  'Fresh Sliced Tomatoes',
  'Fritos',
  'Greek Pepperoncini Peppers',
  'Hickory Tofurkey Slices',
  'Italian Dry Salami',
  'Kosher Dill Pickles',
  'Nut-Free Basil Pesto',
  'Oven Roasted Turkey Breast',
  'Oyster Crackers',
  'Peppered Tofurkey Slices',
  'Pickled Jalapeno Peppers',
  'Plain Hummus',
  'Potato Chips',
  'Sliced Beef Pastrami',
  'Sliced Corned Beef',
  'Sliced Ham',
  'Sliced Mild Cheddar Cheese',
  'Sliced Monterey Jack Cheese',
  'Sliced Pepperjack Cheese',
  'Sliced Red Onions',
  'Sliced Roast Beef',
  'Sliced Smoked Provolone Cheese',
  'Sliced Swiss Cheese',
  'Sweet Pickle Relish',
  'Vegan Cheddar Slices',
  'White Corn Tortilla Chips',
  'Wild Caught Tuna',
])

register('Fruit', [
  'Applesauce',
  'Banana',
  'Blueberries',
  'Cantaloupe Melon',
  'Dried Apricot',
  'Dried Cranberries',
  'Fresh Pear',
  'Fresh Pineapple',
  'Fuji Apples',
  'Green Grapes',
  'Honeydew Melon',
  'Mandarins',
  'Mango',
  'Oranges',
  'Organic Gala Apples',
  'Pineapple Chunks',
  'Raisins',
  'Red Apples',
  'Red Grapes',
  'Ruby Red Grapefruit',
  'Sliced Peaches',
  'Sliced Pears',
  'Strawberries',
  'Tropical Fruit Salad',
  'Watermelon',
  'White Peach',
  'Yellow Peach',
])

register('Nuts & Seeds', [
  'Dry Roasted Peanuts',
  'Sliced Almonds',
  'Sunflower Seeds',
])

register('Salad Bar', [
  'Artichoke Hearts',
  'Bell Pepper',
  'Black Beans',
  'Blanched Peas',
  'Broccoli',
  'Cauliflower',
  'Cherry Tomatoes',
  'Corn',
  'Cucumber',
  'Edamame (Soybeans)',
  'Garbanzo Beans',
  'Golden Beets',
  'Gorgonzola Cheese',
  'Hard Boiled Egg',
  'Jicama',
  'Kalamata Olives',
  'Lemon',
  'Mandarin Oranges',
  'Navy Beans',
  'Olives',
  'Organic Baby Arugula',
  'Organic Baby Spinach',
  'Organic Spring Mix',
  'Organic Tofu',
  'Pimento-Stuffed Green Olives',
  'Red Beets',
  'Red Kidney Beans',
  'Roasted Asparagus',
  'Roasted Brussels Sprouts',
  'Roasted Eggplant',
  'Roasted Green Beans',
  'Romaine Lettuce',
  'Seasoned Homestyle Croutons',
  'Shredded Carrot',
  'Shredded Cheddar and Jack Cheese',
  'Shredded Mild Cheddar Cheese',
  'Sliced Mushrooms',
  'Sliced Red Radish',
  'Steamed Broccolini',
  'Sunflower Sprouts',
])

/**
 * Classifies an item by exact name lookup. Returns null if the item isn't
 * in our known list — caller should fall back to the scraped station (if
 * any) or a generic "General" bucket.
 */
export function classifyByName(name: string): string | null {
  return KNOWN_ITEM_STATIONS[name.trim().toLowerCase()] || null
}