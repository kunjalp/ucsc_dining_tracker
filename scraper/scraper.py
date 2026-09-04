"""
UCSC Dining - Multi-Hall, Multi-Meal Production Scraper
=========================================================

Fixes vs. the original version:
  1. THE MAIN BUG: the old code used `.locator('a:has-text("Nutrition
     Calculator")').first`. Every meal period (Breakfast, Lunch, Dinner)
     has its OWN "Nutrition Calculator" link on the page. `.first` always
     grabbed Breakfast's link and silently ignored Lunch and Dinner, which
     is why soups/pizza/grill/hot-bar items never showed up.
  2. Only one dining hall was scraped. This version loops every location
     in DINING_HALLS.
  3. Stale data: writing only to a single food_items table upserted by
     recipe_id meant an item that rotated off today's menu just stayed in
     the table forever. This version separates "what a food item is"
     (nutrition facts, food_items) from "what's on the menu today"
     (daily_menus), and deletes+replaces each hall/meal's rows in
     daily_menus on every run so removed items actually disappear.
  4. Station tracking: daily_menus.station (e.g. "Campus Bakery", "Grill",
     "Hot Bars") is captured by scanning the menu listing page (station
     headers aren't present in the Nutrition Calculator report itself)
     and joining to items by name.

Matches this Supabase schema:

    CREATE TABLE public.food_items (
        recipe_id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        portion TEXT,
        calories DOUBLE PRECISION DEFAULT 0.0,
        protein DOUBLE PRECISION DEFAULT 0.0,
        carbs DOUBLE PRECISION DEFAULT 0.0,
        sugar DOUBLE PRECISION DEFAULT 0.0,
        fat DOUBLE PRECISION DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE public.daily_menus (
        id BIGSERIAL PRIMARY KEY,
        date DATE NOT NULL,
        dining_hall VARCHAR(100) NOT NULL,
        meal_type VARCHAR(50) NOT NULL,
        station VARCHAR(100),
        food_item_id VARCHAR(255) REFERENCES public.food_items(recipe_id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, dining_hall, meal_type, station, food_item_id)
    );

To get "what's on the menu right now at hall X for meal Y":

    select fi.name, dm.station, fi.calories, fi.protein, fi.carbs, fi.sugar, fi.fat
    from daily_menus dm
    join food_items fi on fi.recipe_id = dm.food_item_id
    where dm.dining_hall = 'John R. Lewis & College Nine Dining Hall'
      and dm.meal_type = 'Breakfast'
      and dm.date = current_date;
"""

import os
import re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from supabase import create_client

# ---------------------------------------------------------------------------
# Config & Client Initialization
# ---------------------------------------------------------------------------
# Explicitly find and load .env.local from the scraper directory
env_path = Path(__file__).resolve().parent / ".env.local"
load_dotenv(dotenv_path=env_path)

BASE_URL = "https://nutrition.sa.ucsc.edu/"

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip("/")

# Fall back gracefully to SUPABASE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY if SERVICE_ROLE_KEY isn't set
raw_key = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)

if not raw_key:
    raise KeyError("No valid Supabase API key found in scraper/.env.local!")

SUPABASE_KEY = raw_key.strip()
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Exact link text as it appears on https://nutrition.sa.ucsc.edu/
DINING_HALLS = [
    "John R. Lewis & College Nine Dining Hall",
    "Cowell & Stevenson Dining Hall",
    "Crown & Merrill Dining Hall",
    "Porter & Kresge Dining Hall",
    "Rachel Carson & Oakes Dining Hall",
    "Stevenson Coffee House",
    "Perk Coffee Bar",
]

NAV_TIMEOUT_MS = 20000


# ---------------------------------------------------------------------------
# Core Scraping Logic
# ---------------------------------------------------------------------------
def goto_hall_menu(page, hall_name: str) -> bool:
    """Navigate fresh to the homepage and open a given dining hall's menu.
    Returns False if the hall link can't be found (name typo / retired hall)."""
    page.goto(BASE_URL, wait_until="networkidle")
    hall_locator = page.locator(f'a:text-is("{hall_name}")').first
    try:
        hall_locator.wait_for(state="visible", timeout=NAV_TIMEOUT_MS)
    except Exception:
        print(f"   ⚠️ Could not find a link for '{hall_name}' on the homepage — skipping.")
        return False
    hall_locator.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    return True


def get_meal_period_names(page) -> list[str]:
    """Return the meal-period name (Breakfast/Lunch/Dinner/etc.) associated
    with each 'Nutrition Calculator' link on the currently-loaded menu page,
    in document order. Works by taking the nearest preceding non-empty leaf
    text for each calculator link, which is exactly where the meal-period
    header sits in FoodPro's markup."""
    return page.evaluate(
        """
        () => {
            const leaves = Array.from(document.querySelectorAll('body *'))
                .filter(el => el.children.length === 0 && el.textContent.trim() !== '');
            const names = [];
            for (let i = 0; i < leaves.length; i++) {
                const el = leaves[i];
                const isCalcLink = el.tagName === 'A' && el.textContent.trim() === 'Nutrition Calculator';
                if (!isCalcLink) continue;
                let mealName = null;
                for (let j = i - 1; j >= 0; j--) {
                    const t = leaves[j].textContent.trim();
                    if (t && t !== 'Nutrition Calculator') { mealName = t; break; }
                }
                names.push(mealName || ('Meal ' + (names.length + 1)));
            }
            return names;
        }
        """
    )

def fetch_meal_report_html(page, meal_index: int) -> str | None:
    """From a freshly-loaded hall menu page, click the Nth 'Nutrition
    Calculator' link (0-indexed, in document order == meal-period order),
    check every item, set qty=1 for all, and return the rendered report HTML."""
    calc_links = page.locator('a:text-is("Nutrition Calculator")')
    if meal_index >= calc_links.count():
        return None

    link = calc_links.nth(meal_index)
    link.scroll_into_view_if_needed()
    link.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)

    # Check every item checkbox — this triggers fillQty() on UCSC's site
    page.evaluate(
        """
        () => {
            document.querySelectorAll('input[type="checkbox"][name="recipe"]').forEach(cb => {
                if (!cb.checked) cb.click();
            });
        }
        """
    )
    page.wait_for_timeout(800)

    # Fill every quantity box with "1"
    page.evaluate(
        """
        () => {
            document.querySelectorAll('input[type="text"]').forEach(el => {
                el.value = '1';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
        """
    )
    page.wait_for_timeout(800)

    report_btn = page.locator('input[value="Show Nutrition Report"]').first
    if report_btn.count() == 0:
        print("   ⚠️ No items/report button found for this meal period — skipping.")
        return None
    report_btn.scroll_into_view_if_needed()

    try:
        with page.context.expect_page(timeout=5000) as new_page_info:
            report_btn.click()
        new_page = new_page_info.value
        new_page.wait_for_load_state("networkidle")
        new_page.wait_for_timeout(1000)
        html = new_page.content()
        new_page.close()
        return html
    except Exception:
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        return page.content()


def to_float(s: str) -> float:
    if not s or s.strip() == "":
        return 0.0
    m = re.search(r"[-+]?\d*\.?\d+", s)
    return float(m.group()) if m else 0.0

def get_station_map(page, meal_names: list[str]) -> dict:
    return page.evaluate(
        """
        (mealNames) => {
            const leaves = Array.from(document.querySelectorAll('body *'))
                .filter(el => el.children.length === 0 && el.textContent.trim() !== '');
            const map = {};
            let currentMeal = null;
            let currentStation = null;
            for (const el of leaves) {
                const t = el.textContent.trim();
                if (t === 'Nutrition Calculator') continue;
                if (mealNames.includes(t)) {
                    currentMeal = t;
                    currentStation = null;
                    continue;
                }
                if (t.startsWith('--') && t.endsWith('--') && t.length > 4) {
                    currentStation = t.replace(/^-+\\s*/, '').replace(/\\s*-+$/, '').trim();
                    continue;
                }
                if (currentMeal) {
                    const key = currentMeal + '|' + t.toLowerCase();
                    if (!(key in map)) map[key] = currentStation;
                }
            }
            return map;
        }
        """,
        meal_names,
    )

def parse_report(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for row in soup.find_all("tr"):
        name_div = row.find("div", class_="nutrptnames")
        if not name_div:
            continue

        link_el = name_div.find("a", href=True)
        if not link_el or "RecNumAndPort" not in link_el["href"]:
            continue

        name = link_el.get_text(strip=True)
        if not name or "***" in name or "TOTALS" in name:
            continue

        qs = parse_qs(urlparse(link_el["href"]).query)
        vals = qs.get("RecNumAndPort") or qs.get("recnumandport")
        if not vals:
            continue
        item_id = vals[0]

        portion_div = row.find("div", class_="nutrptportions")
        portion = portion_div.get_text(strip=True).replace("\xa0", " ") if portion_div else "1 serving"

        value_divs = row.find_all("div", class_="nutrptvalues")
        values = [to_float(v.get_text(strip=True)) for v in value_divs]

        if len(values) >= 5:
            calories, protein, carbs, sugar, fat = values[0], values[1], values[2], values[3], values[4]
        else:
            calories = protein = carbs = sugar = fat = 0.0

        results.append({
            "recipe_id": item_id,
            "name": name,
            "portion": portion,
            "calories": calories,
            "protein": protein,
            "carbs": carbs,
            "sugar": sugar,
            "fat": fat,
        })

    return results

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def upsert_food_items(items: list[dict]):
    if not items:
        return
    # Only keep columns that actually exist in the food_items table — items
    # also carry a "station" field used for daily_menus, which food_items
    # doesn't have and will reject.
    FOOD_ITEM_COLUMNS = {"recipe_id", "name", "portion", "calories", "protein", "carbs", "sugar", "fat"}
    cleaned = [{k: v for k, v in item.items() if k in FOOD_ITEM_COLUMNS} for item in items]
    deduped = list({item["recipe_id"]: item for item in cleaned}.values())
    supabase.table("food_items").upsert(deduped, on_conflict="recipe_id").execute()

def replace_daily_menus(hall_name: str, meal_type: str, scrape_date: str, rows: list[dict]):
    """Delete whatever was previously recorded for this hall+meal+date and
    insert the freshly scraped set. This is what makes 'today's menu'
    actually reflect today instead of accumulating stale rows forever."""
    supabase.table("daily_menus").delete() \
        .eq("dining_hall", hall_name) \
        .eq("meal_type", meal_type) \
        .eq("date", scrape_date) \
        .execute()

    if not rows:
        return

    # de-dupe in case the same recipe_id appears twice in one meal/hall report
    deduped = list({
        (r["dining_hall"], r["meal_type"], r["station"], r["food_item_id"], r["date"]): r
        for r in rows
    }.values())
    supabase.table("daily_menus").insert(deduped).execute()


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
def scrape_hall(page, hall_name: str, scrape_date: str) -> int:
    print(f"\n🏢 {hall_name}")
    if not goto_hall_menu(page, hall_name):
        return 0

    meal_names = get_meal_period_names(page)
    station_map = get_station_map(page, meal_names)
    if not meal_names:
        print("   ℹ️ No 'Nutrition Calculator' links found — likely a retail/no-nutrition-data location. Skipping.")
        return 0
    print(f"   📋 Found {len(meal_names)} meal period(s): {', '.join(meal_names)}")

    # Station headers live on this listing page, capture them before we
    # start navigating into calculator forms/report tabs.

    total_items = 0
    for i, meal_name in enumerate(meal_names):
        # Re-navigate fresh for each meal period so link indices don't shift
        # after a prior report/tab was opened.
        if not goto_hall_menu(page, hall_name):
            continue
        print(f"   🍽️ Scraping '{meal_name}'...")
        html = fetch_meal_report_html(page, i)
        if not html:
            continue
        items = parse_report(html)
        print(f"      🎉 Parsed {len(items)} item(s).")
        if not items:
            continue

        rows = []
        for item in items:
            rows.append({
                "date": scrape_date,
                "dining_hall": hall_name,
                "meal_type": meal_name,
                "station": station,
                "food_item_id": item["recipe_id"],
            })

        try:
            upsert_food_items(items)
            replace_daily_menus(hall_name, meal_name, scrape_date, rows)
            total_items += len(items)
        except Exception as e:
            print(f"      💥 DB write failed for '{meal_name}': {e}")
            continue

    return total_items

STATUS_URL = "https://dining.ucsc.edu/locations-hours/"

STATUS_HALL_LABELS = {
    "College Nine and John R. Lewis Dining Hall": "John R. Lewis & College Nine Dining Hall",
    "Cowell/Stevenson Dining Hall": "Cowell & Stevenson Dining Hall",
    "Crown/Merrill Dining Hall": "Crown & Merrill Dining Hall",
    "Porter/Kresge Dining Hall": "Porter & Kresge Dining Hall",
    "Rachel Carson/Oakes Dining Hall": "Rachel Carson & Oakes Dining Hall",
}

def scrape_hall_statuses(page) -> list[dict]:
    page.goto(STATUS_URL, wait_until="networkidle")
    # Status text loads async and replaces "Loading…" — wait it out
    page.wait_for_timeout(3000)
    try:
        page.wait_for_function(
            "!document.body.innerText.includes('Loading…')",
            timeout=20000
        )
    except Exception:
        print("   ⚠️ Status page still showed 'Loading…' after timeout — scraping best-effort anyway.")

    page.wait_for_timeout(1500)  # small settle buffer after JS resolves

    rows = page.evaluate(
        """
        () => {
            const links = Array.from(document.querySelectorAll('a'))
                .filter(a => /Dining Hall/i.test(a.textContent) && /\\b(OPEN|CLOSED)\\b/i.test(a.textContent));
            return links.map(a => ({
                text: a.textContent.replace(/\\s+/g, ' ').trim()
            }));
        }
        """
    )
    
    print("   🔍 DEBUG raw status link texts:")
    for r in rows:
        print(f"      '{r['text']}'")

    results = []
    for row in rows:
        text = row["text"]
        matched_label = next((k for k in STATUS_HALL_LABELS if k in text), None)
        if not matched_label:
            continue
        db_name = STATUS_HALL_LABELS[matched_label]
        status_part = text.replace(matched_label, "").strip(" ›").strip()
        is_open = status_part.upper().startswith("OPEN")
        results.append({
            "dining_hall": db_name,
            "is_open": is_open,
            "status_text": status_part or None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return results


def upsert_hall_statuses(statuses: list[dict]):
    if not statuses:
        return
    deduped = list({s["dining_hall"]: s for s in statuses}.values())
    supabase.table("hall_status").upsert(deduped, on_conflict="dining_hall").execute()
    

def main():
    print("🚀 Running UCSC Dining database update pipeline...")
    scrape_date = datetime.now(ZoneInfo("America/Los_Angeles")).date().isoformat()

    grand_total = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("\n📡 Scraping hall open/closed statuses...")
            try:
                statuses = scrape_hall_statuses(page)
                upsert_hall_statuses(statuses)
                print(f"   ✅ Updated status for {len(statuses)} hall(s).")
            except Exception as e:
                print(f"   💥 Status scrape failed: {e}")

            for hall_name in DINING_HALLS:
                try:
                    grand_total += scrape_hall(page, hall_name, scrape_date)
                except Exception as e:
                    print(f"   💥 Error scraping '{hall_name}': {e}")
                    continue
        finally:
            browser.close()

if __name__ == "__main__":
    main()