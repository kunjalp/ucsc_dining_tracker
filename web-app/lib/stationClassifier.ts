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

register('Cereal', [
  'Cinnamon Puffins Cereal', 'Cinnamon Toasters', 'Crunchy Maple Sunrise Cereal',
  "Honey'd Corn Flakes", "Kellogg's Rice Krispies",
  'Leapin\' Lemurs Organic Peanut Butter Chocolate Cereal', 'Marshmallow Mateys',
  'Organic Mesa Sunrise', 'Raisin Bran', 'Sunrise Crunchy Cinnamon Cereal',
  'Toasty Os', 'Tootie Frooties',
])

register('Bread & Bagels', [
  'Buttermilk Bread', 'Cinnamon Raisin Bread', 'Gluten Free Everything Bagel',
  'Gluten Free Plain Bagel', 'Hamburger Bun', 'Hot Dog Bun', 'Large Sliced Sourdough',
  "Milton's Multigrain Bread", 'Mountain White Gluten Free Bread',
  "Nature's Harvest Vegan Whole Wheat Bread", 'Rye Bread', 'Salted Brown Rice Cakes',
  'Sara Lee Blueberry Bagel', 'Sara Lee Cinnamon Raisin Bagel', 'Sara Lee Everything Bagel',
  'Sara Lee Onion Bagel', 'Sara Lee Plain Bagel', 'Sliced White Bread',
  'Sourdough English Muffin', "Udi's Gluten Free Cinnamon Raisin Bread",
  "Udi's Gluten Free Multigrain Bread", "Udi's Whole Grain Gluten Free Bread", 'Wild Rice Cake',
])

register('Beverages', [
  '2% Lactose Free Milk', 'Apple Juice', 'Califia Original Almond Milk',
  'Chai Tea Concentrate', 'Cranberry Juice', 'Dr. Pepper', 'Gluten-Free Oatmilk',
  'Hot Chocolate', 'Lemonade', 'Lime Bubly', 'Lipton Unsweetened Black Iced Tea',
  'Mountain Dew', 'Nonfat Milk', 'Orange Crush', 'Orange Juice',
  'Organic French Roast Coffee', 'Passion Orange Guava Juice', 'Pepsi', 'Pepsi Zero',
  'Pink Lemonade', 'Plain Soy Milk', 'Raspberry Bubly Water', 'Root Beer', 'Starry',
  'Vanilla Soy Milk', 'Whole Milk',
])

register('Condiments', [
  'A1 Steak Sauce', 'Almond Butter', "Annie's Balsamic Vinaigrette",
  "Annie's Organic French Dressing", "Annie's Sesame Ginger Dressing",
  "Annie's Vegan Lemon Tahini Dressing", "Annie's Vegan Shiitake Sesame Dressing",
  'Balsamic Vinaigrette', 'Balsamic Vinegar', 'Blackberry Jam', 'Cholula Chipotle Hot Sauce',
  'Cholula', 'Chunky Blue Cheese Dressing', 'Creamy Caesar Dressing', 'Creamy Peanut Butter',
  'Crushed Red Pepper Flakes', 'Extra Virgin Olive Oil', 'Follow Your Heart Vegan Caesar Dressing',
  'Follow Your Heart Vegan Ranch Dressing', 'Gluten Free Tamari Soy Sauce', 'Grape Jelly',
  'Grated Parmesan Cheese', 'Guacamole', 'Heinz BBQ Sauce', 'Heinz Honey Mustard',
  'Heinz Ketchup', 'Heinz Mustard', 'Imitation Maple Syrup', 'Individual Cream Cheese',
  'Individual Grape Jelly Cup', 'Individual Peanut Butter Cup', 'Individual Salted Butter Pat',
  'Individual Strawberry Jelly Cup', "Ken's Honey Mustard Dressing", "Ken's Ranch Dressing",
  'Low-Fat Italian Dressing', "Melinda's Mango Hot Sauce", 'Nutella', 'Nutritional Yeast',
  'Orange Marmalade', 'Organic Agave Syrup', 'Pepper Plant Hot Sauce', 'Pico de Gallo Salsa',
  'Plain Cream Cheese', 'Salsa Picante', 'Salsa Verde', 'Salted Butter', 'Sour Cream',
  'Sriracha Hot Chili Sauce', 'Strawberry Pancake Topping', 'Strawberry Preserves',
  'Tabasco Green Pepper Sauce', 'Tabasco Pepper Sauce', 'Tajin Seasoning',
  'Tapatio Salsa Picante', 'Thousand Island Dressing', 'Unsalted Butter',
  'Vegan Butter Spread', 'Vegan Cream Cheese', 'Vegan Cream Cheese With Chives',
  'Vegan Mayonnaise',
])

register('Salad Bar', [
  'Artichoke Hearts', 'Bell Pepper', 'Black Beans', 'Blanched Peas', 'Broccoli',
  'Cauliflower', 'Cherry Tomatoes', 'Corn', 'Cucumber', 'Edamame (Soybeans)',
  'Garbanzo Beans', 'Golden Beets', 'Gorgonzola Cheese', 'Hard Boiled Egg', 'Jicama',
  'Kalamata Olives', 'Lemon', 'Mandarin Oranges', 'Navy Beans', 'Olives',
  'Organic Baby Arugula', 'Organic Baby Spinach', 'Organic Spring Mix', 'Organic Tofu',
  'Pimento-Stuffed Green Olives', 'Red Beets', 'Red Kidney Beans', 'Roasted Asparagus',
  'Roasted Brussels Sprouts', 'Roasted Eggplant', 'Roasted Green Beans', 'Romaine Lettuce',
  'Seasoned Homestyle Croutons', 'Shredded Carrot', 'Shredded Cheddar and Jack Cheese',
  'Shredded Mild Cheddar Cheese', 'Sliced Mushrooms', 'Sliced Red Radish',
  'Steamed Broccolini', 'Sunflower Sprouts',
])

register('Deli Bar', [
  'American Cheese', 'Diced Chicken', 'Fresh Lettuce', 'Fresh Sliced Tomatoes', 'Fritos',
  'Greek Pepperoncini Peppers', 'Hickory Tofurkey Slices', 'Italian Dry Salami',
  'Kosher Dill Pickles', 'Nut-Free Basil Pesto', 'Oven Roasted Turkey Breast',
  'Oyster Crackers', 'Peppered Tofurkey Slices', 'Pickled Jalapeno Peppers', 'Plain Hummus',
  'Potato Chips', 'Sliced Beef Pastrami', 'Sliced Corned Beef', 'Sliced Ham',
  'Sliced Mild Cheddar Cheese', 'Sliced Monterey Jack Cheese', 'Sliced Pepperjack Cheese',
  'Sliced Red Onions', 'Sliced Roast Beef', 'Sliced Smoked Provolone Cheese',
  'Sliced Swiss Cheese', 'Sweet Pickle Relish', 'Vegan Cheddar Slices',
  'White Corn Tortilla Chips', 'Wild Caught Tuna',
])

// "All Day" items get split further into sub-categories rather than one
// flat bucket, since it's genuinely a mix of fruit/dairy/nuts/sweets.
register('Fruit', [
  'Applesauce', 'Banana', 'Blueberries', 'Cantaloupe Melon', 'Fresh Pear',
  'Fresh Pineapple', 'Fuji Apples', 'Green Grapes', 'Honeydew Melon', 'Mandarins',
  'Mango', 'Oranges', 'Organic Gala Apples', 'Pineapple Chunks', 'Red Apples',
  'Red Grapes', 'Ruby Red Grapefruit', 'Sliced Peaches', 'Sliced Pears', 'Strawberries',
  'Tropical Fruit Salad', 'Watermelon', 'White Peach', 'Yellow Peach', 'Dried Apricot',
  'Dried Cranberries', 'Raisins',
])

register('Dairy & Yogurt', [
  'Cottage Cheese', 'Half & Half', 'Plain Soy Milk Yogurt',
  'Plain Unsweetened Coconut Milk Yogurt', 'Plain Yogurt',
  'Unsweetened Vanilla Coconut Milk Vegan Yogurt', 'Vanilla Cashew Milk Yogurt',
  'Whole Milk Greek Yogurt',
])

register('Nuts & Seeds', [
  'Dry Roasted Peanuts', 'Sliced Almonds', 'Sunflower Seeds',
])

register('Sweets & Extras', [
  'French Vanilla Coffee Creamer', 'Hazelnut Coffee Creamer', 'Organic Vegan Sugar',
  'Pure Clover Honey', 'Splenda', 'Sweetened Shredded Coconut', 'Whipped Cream',
])

/**
 * Classifies an item by exact name lookup. Returns null if the item isn't
 * in our known list — caller should fall back to the scraped station (if
 * any) or a generic "General" bucket.
 */
export function classifyByName(name: string): string | null {
  return KNOWN_ITEM_STATIONS[name.trim().toLowerCase()] || null
}