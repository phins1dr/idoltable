#!/usr/bin/env python3
"""Render the sample route page and save phone-width screenshots.

Run:  python3 tools/screenshot_sample.py

Opens site/sample-seventeen-seongsu.html in headless Chromium at 390x844
(iPhone 14/15 width), checks console errors and horizontal overflow at
320px and 390px, then writes to site/screenshots/:

    seventeen-seongsu-390-top.png    first screen (above the fold)
    seventeen-seongsu-390-full.png   whole page
    seventeen-seongsu-390-quiz.png   quiz answered + score panel

Exits 0 when no console errors and no horizontal overflow. No network fetches
beyond the local file are made by the page.
"""
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent          # .../site
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)

CHROMELIBS = "/workspace/.local/chromelibs/usr/lib/x86_64-linux-gnu"
if pathlib.Path(CHROMELIBS).exists():
    os.environ["LD_LIBRARY_PATH"] = CHROMELIBS + (
        ":" + os.environ["LD_LIBRARY_PATH"] if os.environ.get("LD_LIBRARY_PATH") else "")

PAGE = (ROOT / "sample-seventeen-seongsu.html").as_uri()


def overflow(page):
    return page.evaluate("""() => {
      const d = document.documentElement;
      const worst = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1) {
          worst.push((el.className && el.className.toString()) || el.tagName);
        }
      });
      return {scrollW: d.scrollWidth, inner: window.innerWidth, worst: worst.slice(0, 5)};
    }""")


def main():
    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                  device_scale_factor=2, is_mobile=True,
                                  has_touch=True)
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(PAGE, wait_until="load")
        page.wait_for_timeout(300)

        page.screenshot(path=str(OUT / "seventeen-seongsu-390-top.png"))

        full = OUT / "seventeen-seongsu-390-full.png"
        page.screenshot(path=str(full), full_page=True)

        # quiz: answer all three, then capture the quiz block + score panel
        for fs in page.query_selector_all(".q"):
            fs.query_selector("button.choice[data-ok='1']").click()
            page.wait_for_timeout(120)
        page.wait_for_timeout(250)
        page.query_selector(".quiz-sec").scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "seventeen-seongsu-390-quiz.png"))

        o390 = overflow(page)
        print("390px overflow:", o390)

        page.set_viewport_size({"width": 320, "height": 640})
        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(250)
        o320 = overflow(page)
        print("320px overflow:", o320)
        page.set_viewport_size({"width": 390, "height": 844})

        score_shown = page.eval_on_selector("#score", "el => !el.hidden")
        print("score panel visible after 3 answers:", score_shown)
        print("console errors:", errors or "none")

        if o390["scrollW"] > o390["inner"]:
            problems.append("overflow at 390px: " + str(o390["worst"]))
        if o320["scrollW"] > o320["inner"]:
            problems.append("overflow at 320px: " + str(o320["worst"]))
        if errors:
            problems.append("console errors: " + str(errors))
        if not score_shown:
            problems.append("score panel did not appear")

        browser.close()

    for f in ("seventeen-seongsu-390-top.png", "seventeen-seongsu-390-full.png",
              "seventeen-seongsu-390-quiz.png"):
        p_ = OUT / f
        print(f"{f}: {'ok' if p_.exists() else 'MISSING'} ({p_.stat().st_size if p_.exists() else 0} bytes)")
    print("RESULT:", "PASS" if not problems else "FAIL " + " | ".join(problems))
    return 0 if not problems else 1


if __name__ == "__main__":
    sys.exit(main())
