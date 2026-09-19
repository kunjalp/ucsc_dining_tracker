"""
UCSC Dining - Upcoming Menus Scraper
=====================================

Pulls the next few days of menus (today + DAYS_AHEAD) for the halls we know
the locationNum for (see HALL_LOCATION_NUMS in scraper.py), storing them in
daily_menus under their real calendar date, exactly like the main scraper
does for "today" — this is what lets the app show a "Tomorrow" tab.

Runs as its own, separate, once-a-day GitHub Action (see
.github/workflows/upcoming-menus.yml) rather than piggybacking on the 30-min
status cron: future-day menus don't change nearly as often as live open/closed
status, so there's no reason to re-scrape 3 days of every hall every 30
minutes — that would just waste Action minutes and hammer the nutrition site.

Discovered directly from the site's own date-picker: each date option is a
plain link carrying a "dtdate=M/D/YYYY" query param (see goto_hall_menu in
scraper.py), so no dropdown-clicking or form submission is needed — we just
build that URL ourselves for each hall + day.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

from scraper import DINING_HALLS, HALL_LOCATION_NUMS, scrape_hall

DAYS_AHEAD = 2  # scrape today + this many days into the future (matches DAY_OFFSETS in dashboard/page.tsx: today, tomorrow, +2)


def main():
    print("🚀 Running UCSC Dining upcoming-menus scraper...")
    today = datetime.now(ZoneInfo("America/Los_Angeles")).date()
    grand_total = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            for offset in range(1, DAYS_AHEAD + 1):
                target_date = today + timedelta(days=offset)
                scrape_date = target_date.isoformat()
                print(f"\n📅 Scraping menus for {scrape_date}...")

                for hall_name in DINING_HALLS:
                    if hall_name not in HALL_LOCATION_NUMS:
                        print(f"   ⚠️ Skipping '{hall_name}' — no known locationNum.")
                        continue
                    try:
                        grand_total += scrape_hall(page, hall_name, scrape_date, target_date=target_date)
                    except Exception as e:
                        print(f"   💥 Error scraping '{hall_name}' for {scrape_date}: {e}")
                        continue
        finally:
            browser.close()

    print(f"\n✅ Done. Upserted {grand_total} item-row(s) across {DAYS_AHEAD} upcoming day(s).")


if __name__ == "__main__":
    main()