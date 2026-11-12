import os
import time
from playwright.sync_api import sync_playwright

def main():
    os.makedirs('projects/idol-table/screenshots', exist_ok=True)
    file_url = f"file://{os.path.abspath('projects/idol-table/index.html')}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 390, 'height': 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True
        )
        page = context.new_page()

        # 1. Home screen
        page.goto(file_url)
        page.wait_for_selector('.daily-card')
        time.sleep(1)
        page.screenshot(path='projects/idol-table/screenshots/01-quiz-home.png', full_page=False)
        print("Captured 01-quiz-home.png")

        # 2. Start Quiz (click BTS)
        page.click('[data-group="bts"]')
        page.wait_for_selector('.choice-btn')
        time.sleep(0.5)
        page.screenshot(path='projects/idol-table/screenshots/02-quiz-play.png', full_page=False)
        print("Captured 02-quiz-play.png")

        # 3. Answer a question
        choices = page.query_selector_all('.choice-btn')
        if choices:
            choices[0].click()
            time.sleep(0.5)
            page.screenshot(path='projects/idol-table/screenshots/03-quiz-feedback.png', full_page=False)
            print("Captured 03-quiz-feedback.png")

        # 4. Finish all questions to get result
        for _ in range(15):
            next_btn = page.query_selector('#btnNextQ')
            if next_btn and next_btn.is_visible():
                next_btn.click()
                time.sleep(0.3)
            choices = page.query_selector_all('.choice-btn')
            if choices and choices[0].is_visible():
                choices[0].click()
                time.sleep(0.3)
            res_view = page.query_selector('#view-result')
            if res_view and not res_view.is_hidden():
                break

        time.sleep(0.5)
        page.screenshot(path='projects/idol-table/screenshots/04-quiz-result.png', full_page=False)
        print("Captured 04-quiz-result.png")

        browser.close()

if __name__ == '__main__':
    main()
