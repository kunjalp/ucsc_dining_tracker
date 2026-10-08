"""
One-time backfill: fetch ingredients/allergens/dietary_tags for every
food_items row that doesn't have them yet, instead of waiting for each
item to naturally rotate back onto a scraped day's menu.

Confirmed via manual testing that label.aspx's RecNumAndPort lookup
ignores locationNum/dtdate for which data it returns (same recnum from a
different hall/date still returns the correct item's real label) -- so
there's no need to join against daily_menus to find each item's "real"
hall/date. Any valid hall + any date in the site's current week works as
the URL context; this uses John R. Lewis & College Nine (locationNum 40)
and today's date for every row.

Run manually (not on a schedule): `python backfill_labels.py`
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from supabase import create_client

env_path = Path(__file__).resolve().parent / ".env.local"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.environ["SUPABASE_URL"].strip().rstrip("/")
raw_key = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
if not raw_key:
    raise KeyError("No valid Supabase API key found in scraper/.env.local!")
supabase = create_client(SUPABASE_URL, raw_key.strip())

# Reuse the real scraper's label-fetching logic so this stays in sync with
# any future fix to selectors/URL-building instead of drifting from it.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scraper import fetch_item_label, NAV_TIMEOUT_MS  # noqa: E402

ANCHOR_HALL = "John R. Lewis & College Nine Dining Hall"


def main():
    today = datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")

    print("📋 Fetching food_items missing ingredients...")
    rows = (
        supabase.table("food_items")
        .select("recipe_id, name")
        .is_("ingredients", "null")
        .execute()
        .data
    )
    print(f"   {len(rows)} item(s) to backfill.")
    if not rows:
        return

    filled = 0
    failed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_navigation_timeout(NAV_TIMEOUT_MS)

        for i, row in enumerate(rows, 1):
            recipe_id = row["recipe_id"]
            label = fetch_item_label(page, ANCHOR_HALL, today, recipe_id)
            if label and label.get("ingredients") is not None:
                try:
                    supabase.table("food_items").update(label).eq("recipe_id", recipe_id).execute()
                    filled += 1
                except Exception as e:
                    print(f"   💥 DB update failed for {recipe_id} ({row['name']}): {e}")
                    failed += 1
            else:
                failed += 1

            if i % 50 == 0 or i == len(rows):
                print(f"   ...{i}/{len(rows)} processed ({filled} filled, {failed} failed/empty)")

        browser.close()

    print(f"✅ Done. {filled} item(s) backfilled, {failed} failed or had no label data.")


if __name__ == "__main__":
    main()
