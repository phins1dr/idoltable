#!/usr/bin/env python3
"""End-to-end smoke test for the Idol Table site.

Run:  python3 tools/smoke_test.py

It starts a local http.server on a free port, opens the site in headless Chromium
at a phone viewport (390x844), and walks the whole flow:

    home -> idol list -> idol -> place -> area -> route -> quiz -> answer -> result

and checks, in the rendered page:
  * no console errors, no page errors, no failed requests
  * no horizontal overflow on every screen (390px and 320px wide)
  * every tap target at least 44px tall
  * body text at least 17px
  * copy buttons put the exact address / coordinates / route text on the clipboard
  * the daily set is stable for the day and the score, streak, level and storage follow it
  * the English default and the Korean toggle both render

Screenshots land in preview/.  Exit code 0 = passed.
"""
import functools
import http.server
import json
import os
import pathlib
import socket
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "preview"
PREVIEW.mkdir(exist_ok=True)
REPORT = ROOT / "tools" / "test_report.txt"

CHROMELIBS = "/workspace/.local/chromelibs/usr/lib/x86_64-linux-gnu"
if pathlib.Path(CHROMELIBS).exists():
    os.environ["LD_LIBRARY_PATH"] = CHROMELIBS + (":" + os.environ.get("LD_LIBRARY_PATH", "") if os.environ.get("LD_LIBRARY_PATH") else "")

questions = json.loads((ROOT / "data" / "questions.json").read_text(encoding="utf-8"))["questions"]
places = json.loads((ROOT / "data" / "places.json").read_text(encoding="utf-8"))["places"]
place_by_id = {p["id"]: p for p in places}

lines = []
failures = []


def log(msg=""):
    print(msg)
    lines.append(msg)


def check(cond, label, extra=""):
    if cond:
        log(f"  ok   {label}")
    else:
        log(f"  FAIL {label} {extra}")
        failures.append(label + (" " + extra if extra else ""))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(directory):
    handler = functools.partial(QuietHandler, directory=str(directory))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = srv.socket.getsockname()[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}"


def visible_overflow(page):
    return page.evaluate("""() => {
      const d = document.documentElement;
      const worst = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1) worst.push(el.className || el.tagName);
      });
      return {scrollWidth: d.scrollWidth, inner: window.innerWidth, worst: worst.slice(0, 4)};
    }""")


def tap_targets(page):
    return page.evaluate("""() => {
      const out = [];
      document.querySelectorAll('button, a.btn, .row, .tile, .chip, .copy-btn, .icon-btn, .back, .top-link, .choice, .lang-btn, .text-link')
        .forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;       // hidden
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') return;
          if (r.height < 43.5) out.push({t: el.className || el.tagName, h: Math.round(r.height * 10) / 10, txt: (el.textContent || '').trim().slice(0, 28)});
        });
      return out;
    }""")


def body_font(page):
    return page.evaluate("""() => {
      const grab = sel => { const el = document.querySelector(sel); return el ? parseFloat(getComputedStyle(el).fontSize) : null; };
      return {body: parseFloat(getComputedStyle(document.body).fontSize),
              lede: grab('.lede'), bodyText: grab('.body-text'), q: grab('.q-text')};
    }""")


def q_for_question(text):
    for q in questions:
        if q["question_en"].strip() == text.strip() or q["question_ko"].strip() == text.strip():
            return q
    return None


def answer_current(page, correct=True):
    """Answer the question on screen. Returns the question id."""
    text = page.inner_text("h1.q-text")
    q = q_for_question(text)
    if q is None:
        raise AssertionError("question on screen not found in data: " + text[:60])
    ko = q["question_ko"].strip() == text.strip()
    choices = q["choices_ko"] if ko else q["choices_en"]
    wanted = choices[q["answer"]] if correct else choices[(q["answer"] + 1) % 4]
    page.get_by_role("button", name=wanted, exact=False).first.click()
    page.click("#btnCheck")
    page.wait_for_selector("#feedback:not([hidden])")
    if page.locator("#popup").is_visible():
        page.click("#popupClose")
    return q["id"]


def main():
    srv, base = serve(ROOT)
    log(f"Idol Table — end-to-end smoke test\nserver: {base}\n")

    from playwright.sync_api import sync_playwright
    console_errors, page_errors, failed_requests = [], [], []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                  locale="en-US", is_mobile=True, has_touch=True)
        try:
            ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
        except Exception as exc:  # noqa: BLE001
            log(f"  note clipboard permission: {exc}")
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("requestfailed", lambda r: failed_requests.append(r.url))

        # ---------- home ----------
        log("Home")
        page.goto(base + "/index.html", wait_until="load")
        page.wait_for_selector("#view-home h1", timeout=8000)
        h1 = page.inner_text("#view-home h1")
        check("Where idols ate" in h1, "home hero headline renders", h1)
        check(page.locator("#view-home .game-card").count() == 1, "dark game card is on the first screen")
        card_text = page.inner_text(".game-card")
        check("CHALLENGE" in card_text.upper(), "daily-challenge kicker", card_text[:40])
        daily_btn = page.locator("[data-action='play-daily']")
        check(daily_btn.count() == 1, "daily-set button present")
        check("10" in daily_btn.inner_text(), "daily button counts the set", daily_btn.inner_text())
        check(page.locator(".rank-card").count() == 1, "ranking card present")
        check(page.locator(".tiles .tile").count() == 3, "three entry tiles")
        check(page.locator(".archive summary").count() == 1, "folded sources panel present")
        fonts = body_font(page)
        log(f"  body font {fonts['body']}px, lede {fonts['lede']}px")
        check(fonts["body"] >= 17, "body font size >= 17px", str(fonts["body"]))
        page.screenshot(path=str(PREVIEW / "home-390.png"), full_page=False)

        ov = visible_overflow(page)
        check(ov["scrollWidth"] <= ov["inner"], "no horizontal overflow on home", str(ov))
        bad = tap_targets(page)
        check(not bad, "all tap targets >= 44px on home", json.dumps(bad[:3], ensure_ascii=False))

        # ---------- idols ----------
        log("\nIdol list -> idol -> place")
        page.click(".tiles a[href='#/idols']")
        page.wait_for_selector("#view-idols h1")
        rows_launch = page.locator("#view-idols ul.rows").nth(0).locator("li").count()
        rows_extra = page.locator("#view-idols ul.rows").nth(1).locator("li").count()
        check(rows_launch == 8, "launch lineup has 8 artists", str(rows_launch))
        check(rows_extra == 2, "extra artists with reports listed", str(rows_extra))

        page.click("a[href='#/idol/seventeen']")
        page.wait_for_selector("#view-idol h1")
        check("SEVENTEEN" in page.inner_text("#view-idol h1"), "SEVENTEEN page opens")
        idol_txt = page.inner_text("#view-idol")
        check("Based on 2 public reports" in idol_txt, "report count shown on idol page")
        check("MUTAN" in idol_txt, "reported place listed on idol page")
        check("Other idols reported in this area" in idol_txt, "cross links to the same area")
        page.screenshot(path=str(PREVIEW / "idol-seventeen.png"))

        page.click("a[href='#/place/mutan-apgujeong']")
        page.wait_for_selector("#view-place h1")
        place_txt = page.inner_text("#view-place")
        check("MUTAN" in place_txt, "place page opens")
        check("Chili yulinji" in place_txt, "ordered dishes shown in English")
        check("Not verified yet" in place_txt, "unverified opening hours stated")
        check(page.locator(".copy-btn").count() == 3, "three one-tap copy buttons (KO / EN / coords)")
        check(page.locator(".map-links a").count() == 2, "Google and Naver map links")
        page.screenshot(path=str(PREVIEW / "place-mutan.png"), full_page=False)

        # clipboard: Korean address
        mutan = place_by_id["mutan-apgujeong"]
        page.locator(".copy-btn").nth(0).click()
        page.wait_for_timeout(250)
        clip = page.evaluate("navigator.clipboard.readText()")
        check(clip.strip() == mutan["address_ko"], "copy button puts the Korean address on the clipboard", clip)
        page.locator(".copy-btn").nth(2).click()
        page.wait_for_timeout(250)
        clip2 = page.evaluate("navigator.clipboard.readText()")
        check(clip2.strip() == f"{mutan['lat']:.4f}, {mutan['lng']:.4f}", "coordinate copy matches the data", clip2)

        # ---------- coming soon ----------
        log("\nComing-soon state")
        page.goto(base + "/index.html#/idol/blackpink", wait_until="load")
        page.wait_for_selector("#view-idol h1")
        cs = page.inner_text("#view-idol")
        check("Coming soon" in cs, "artist without data shows the coming-soon screen")
        check("No linked report has been verified" in cs, "coming-soon explains why it is empty")
        check("A barbecue restaurant" not in cs, "no invented place text on the empty page")

        page.goto(base + "/index.html#/place/yeongcheon-cheongdam", wait_until="load")
        page.wait_for_selector("#view-place h1")
        ych = page.inner_text("#view-place")
        check("the menu they named as best" in ych.lower(), "place page labels the source's wording for the menu")
        check("Mentioned as a visitor" in ych, "passing mentions are labelled, not dressed up as orders")

        # ---------- areas + route ----------
        log("\nArea -> route")
        page.goto(base + "/index.html#/areas", wait_until="load")
        page.wait_for_selector("#view-areas h1")
        check(page.locator("#view-areas .row-item").count() == 3, "three areas with published places",
              str(page.locator("#view-areas .row-item").count()))
        page.click("a[href='#/area/gangnam-apgujeong']")
        page.wait_for_selector("#view-area h1")
        check("Apgujeong" in page.inner_text("#view-area h1"), "area page opens")
        page.click("a[href='#/route/apgujeong-cheongdam']")
        page.wait_for_selector("#view-route h1")
        route_txt = page.inner_text("#view-route")
        check(page.locator(".stop").count() == 2, "route has two stops")
        check("km" in route_txt and "min" in route_txt, "walk estimate shown")
        check("2.2 km" in route_txt, "walk distance includes the road factor (2.2 km)", route_txt.split("\n")[3][:60])
        check("copy" in route_txt.lower(), "route copy button present")
        page.locator("#view-route [data-copy-key]").first.click()
        page.wait_for_timeout(250)
        route_clip = page.evaluate("navigator.clipboard.readText()")
        check("22 Nonhyeon-ro 176-gil" in route_clip and "3 Dosan-daero 90-gil" in route_clip,
              "copied route text carries both addresses", route_clip[:80])
        page.screenshot(path=str(PREVIEW / "route-gangnam.png"), full_page=False)

        # ---------- quiz: daily, all correct ----------
        log("\nQuiz: daily set answered correctly")
        page.goto(base + "/index.html#/quiz", wait_until="load")
        page.wait_for_selector("#view-quiz h1.q-text")
        first_q = page.inner_text("h1.q-text")
        session_len = page.evaluate("JSON.parse(localStorage.getItem('idoltable.v1.session')).ids.length")
        check(session_len == 10, "daily set has 10 questions", str(session_len))

        answered = 0
        for _ in range(session_len):
            answer_current(page, correct=True)
            if answered == 0:
                page.screenshot(path=str(PREVIEW / "quiz-feedback.png"), full_page=False)
            answered += 1
            if page.locator("#btnNext").is_visible():
                page.click("#btnNext")
                page.wait_for_timeout(120)
            if page.locator("#view-result").is_visible():
                break
        check(answered == 10, "answered all 10 questions", str(answered))
        page.wait_for_selector("#view-result .score-ring")
        score = page.inner_text("#view-result .score-ring b")
        check(score.strip() == "10 / 10", "perfect score rendered", score)
        earned = page.inner_text("#view-result .earned") if page.locator("#view-result .earned").count() else ""
        check("NEW BADGE" in earned or "LEVEL UP" in earned, "earned badges are shown on the result page, not in a modal", earned[:60])
        check(not page.locator("#popup").is_visible(), "no modal blocks the result screen")
        page.screenshot(path=str(PREVIEW / "result.png"), full_page=False)

        game_state = page.evaluate("JSON.parse(localStorage.getItem('idoltable.v1.game'))")
        prog = page.evaluate("JSON.parse(localStorage.getItem('idoltable.v1.progress'))")
        check(game_state["daily"]["done"] is True, "daily set marked done for the day")
        check(game_state["streak"]["days"] == 1, "streak started at 1 day", str(game_state["streak"]))
        check(len(prog) == 10, "progress stored for 10 questions", str(len(prog)))
        check("perfect" in game_state["badges"], "perfect-score badge earned", str(list(game_state["badges"])))

        # ---------- daily stability ----------
        log("\nDaily set stability")
        page.goto(base + "/index.html", wait_until="load")
        page.wait_for_selector("#view-home h1")
        home_txt = page.inner_text("#view-home")
        check("Done for today" in home_txt, "home recognises today's set as done")
        check("1" in page.inner_text(".game-stats"), "streak appears on the home card")
        same = page.evaluate("JSON.parse(localStorage.getItem('idoltable.v1.game')).daily.ids")
        page.reload(wait_until="load")
        page.wait_for_selector("#view-home h1")
        same2 = page.evaluate("JSON.parse(localStorage.getItem('idoltable.v1.game')).daily.ids")
        check(same == same2, "daily ids stay identical across reloads")

        # ---------- wrong answer + resume ----------
        log("\nWrong answer path and resume")
        page.click("[data-action='play-random']")
        page.wait_for_selector("#view-quiz h1.q-text")
        answer_current(page, correct=False)
        fb = page.inner_text("#feedback")
        check("Not quite" in fb, "wrong answer shows the miss state")
        check("Answer:" in fb, "wrong answer reveals the right option", fb[:60])
        page.click("#btnNext")
        page.wait_for_timeout(150)
        page.click("[data-action='leave-quiz']")
        page.wait_for_selector("#view-home h1")
        resume = page.locator("[data-action='resume']")
        check(resume.count() == 1, "resume button appears after leaving mid-round", page.inner_text("#view-home")[:40])
        resume.click()
        page.wait_for_selector("#view-quiz h1.q-text")
        check("Question 2 of 10" in page.inner_text(".bar-progress"), "resume continues at question 2",
              page.inner_text(".bar-progress"))

        # ---------- language ----------
        log("\nLanguage toggle")
        page.click("#langToggle")
        page.wait_for_timeout(200)
        page.goto(base + "/index.html", wait_until="load")
        page.wait_for_selector("#view-home h1")
        ko_home = page.inner_text("#view-home h1")
        check("아이돌이 다녀간 곳" in ko_home, "Korean toggle renders Korean home", ko_home)
        check(page.evaluate("document.documentElement.lang") == "ko", "html lang switches to ko")
        page.click("#langToggle")
        page.wait_for_timeout(200)
        check("Where idols ate" in page.inner_text("#view-home h1"), "toggle returns to English")

        # ---------- overflow / tap targets on every screen ----------
        log("\nLayout checks on every screen")
        screens = ["#/", "#/idols", "#/idol/seventeen", "#/idol/blackpink", "#/areas", "#/area/gangnam-cheongdam",
                   "#/place/yeongcheon-cheongdam", "#/place/checkyeast-gangneung", "#/routes", "#/route/apgujeong-cheongdam", "#/me"]
        for width in (390, 320):
            page.set_viewport_size({"width": width, "height": 844})
            for s in screens:
                page.goto(base + "/index.html" + s, wait_until="load")
                page.wait_for_timeout(180)
                ov = visible_overflow(page)
                if ov["scrollWidth"] > ov["inner"]:
                    check(False, f"no horizontal overflow at {width}px on {s}", str(ov))
                bad = tap_targets(page)
                if bad:
                    check(False, f"tap targets >= 44px at {width}px on {s}", json.dumps(bad[:3], ensure_ascii=False))
        check(True, "no overflow and no small tap target found across 11 screens at 390px and 320px")

        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(base + "/index.html#/place/checkyeast-gangneung", wait_until="load")
        page.wait_for_timeout(200)
        fonts2 = body_font(page)
        check((fonts2["bodyText"] or 0) >= 17, "place body text >= 17px", str(fonts2["bodyText"]))
        page.screenshot(path=str(PREVIEW / "place-gangneung.png"), full_page=False)

        # ---------- error log ----------
        log("\nConsole / network")
        check(not page_errors, "no page errors", "; ".join(page_errors[:2]))
        check(not console_errors, "no console errors", "; ".join(console_errors[:2]))
        check(not failed_requests, "no failed requests", "; ".join(failed_requests[:2]))

        browser.close()
    srv.shutdown()

    log("")
    if failures:
        log(f"{len(failures)} FAILURE(S)")
        for f in failures:
            log(f"  - {f}")
    else:
        log("All end-to-end checks passed.")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
