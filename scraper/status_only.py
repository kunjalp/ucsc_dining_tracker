from scraper import scrape_hall_statuses, upsert_hall_statuses
from playwright.sync_api import sync_playwright

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            statuses = scrape_hall_statuses(page)
            upsert_hall_statuses(statuses)
            print(f"✅ Updated status for {len(statuses)} hall(s).")
        finally:
            browser.close()

if __name__ == "__main__":
    main()