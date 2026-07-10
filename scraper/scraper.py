"""
UCSC Dining - Multi-Hall Production Scraper
"""

import os
import re
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from supabase import create_client
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config & Client Initialization
# ---------------------------------------------------------------------------
# ... inside scraper.py ...
# ---------------------------------------------------------------------------
# Config & Client Initialization
# ---------------------------------------------------------------------------
load_dotenv()

BASE_URL = "https://nutrition.sa.ucsc.edu/"
DINING_HALL_NAME = "John R. Lewis & College Nine"

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip('/')
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()

# Initialize the client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------------------------------------------------------
# Core Scraping Logic
# ---------------------------------------------------------------------------
def fetch_report_html(page) -> str:
    print("🌐 Connecting to UCSC Dining Home Page...")
    page.goto(BASE_URL, wait_until="networkidle")
    
    print(f"🏢 Navigating to: '{DINING_HALL_NAME}'...")
    dining_hall_locator = page.locator(f'a:has-text("{DINING_HALL_NAME}")').first
    dining_hall_locator.wait_for(state="visible", timeout=10000)
    dining_hall_locator.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Click the "Nutrition Calculator" link to reveal the quantity page
    print("🍽️ Clicking 'Nutrition Calculator' link to access item forms...")
    calculator_link = page.locator('a:has-text("Nutrition Calculator")').first
    calculator_link.wait_for(state="visible", timeout=10000)
    calculator_link.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # NEW: Check every item checkbox first — this triggers fillQty() on UCSC's site
    print("☑️ Checking all item checkboxes...")
    page.evaluate(
        """
        () => {
            document.querySelectorAll('input[type="checkbox"][name="recipe"]').forEach(cb => {
                if (!cb.checked) {
                    cb.click();
                }
            });
        }
        """
    )
    page.wait_for_timeout(1000)

    # Fill every quantity box with "1" via JavaScript injection
    print("✍️ Setting quantities for all items (Qty = 1)...")
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
    page.wait_for_timeout(1000)

    # Click the Show Nutrition Report button
    print("🖨️ Generating all-in-one nutrition sheet...")
    report_btn = page.locator('input[value="Show Nutrition Report"]').first
    report_btn.scroll_into_view_if_needed()

    # NEW: Handle the possibility that this click opens a new tab/page
    try:
        with page.context.expect_page(timeout=5000) as new_page_info:
            report_btn.click()
        new_page = new_page_info.value
        new_page.wait_for_load_state("networkidle")
        new_page.wait_for_timeout(1000)
        return new_page.content()
    except Exception:
        # No new page opened — report rendered in the same page
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        return page.content()


def to_float(s: str):
    if not s or s.strip() == "":
        return 0.0
    m = re.search(r"[-+]?\d*\.?\d+", s)
    return float(m.group()) if m else 0.0


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

        # nutrptvalues appear in fixed order: Cals, Prot, Carb, Sugar, Fat
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
            "fat": fat
        })

    return results

# ---------------------------------------------------------------------------
# Runner Execution
# ---------------------------------------------------------------------------

def main():
    print("🚀 Running UCSC Dining database update pipeline...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            report_html = fetch_report_html(page)

            # --- TEMPORARY DEBUG: dump raw HTML to inspect structure ---
            with open("debug_report.html", "w", encoding="utf-8") as f:
                f.write(report_html)
            print("🐛 Debug HTML saved to debug_report.html")
            # --- END DEBUG ---

            results = parse_report(report_html)
            print(f"🎉 Successfully parsed {len(results)} distinct food items.")

            if results:
                # Deduplicate by recipe_id — keep the last occurrence of each
                deduped = {item["recipe_id"]: item for item in results}
                deduped_results = list(deduped.values())

                if len(deduped_results) < len(results):
                    print(f"⚠️ Removed {len(results) - len(deduped_results)} duplicate recipe_id(s) before upload.")

                print("📦 Shipping data to your cloud Supabase database table...")

                response = (
                    supabase.table("food_items")
                    .upsert(deduped_results, on_conflict="recipe_id")
                    .execute()
                )

                print(f"💪 Database Sync Complete. Rows written: {len(response.data)}")
            else:
                print("🚫 No items could be structured from the report.")
        except Exception as e:
            print(f"💥 Runtime Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
