#!/usr/bin/env python3
"""Accessibility numbers for the Idol Table site (static checks).

Run:  python3 tools/check_a11y.py
Exit code 0 = all checks passed, 1 = at least one failure.

It reads style.css and index.html and checks, without a browser:
  * base paragraph size (17px or more), button height (50px), minimum touch (44px)
  * horizontal-overflow guard, mobile-first max width
  * prefers-reduced-motion handling
  * viewport meta, lang attribute, no CDN/framework references
  * text/background contrast ratio for every colour pair the design uses (WCAG AA 4.5:1 for
    normal text, 3:1 for large text and interface shapes)
The smoke test (tools/smoke_test.py) measures the rendered sizes in a real browser as well.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = (ROOT / "style.css").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")

failures = []
notes = []


def fail(msg):
    failures.append(msg)


def note(msg):
    notes.append(msg)


# ---------------------------------------------------------------- colours
def parse_vars(css):
    out = {}
    for m in re.finditer(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", css):
        out[m.group(1)] = m.group(2)
    return out


def rgb(hexstr):
    h = hexstr.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(hexstr):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb(hexstr)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


V = parse_vars(CSS)
PAIRS = [
    ("body text on page", V["ink"], V["paper"], 4.5),
    ("secondary text on page", V["ink2"], V["paper"], 4.5),
    ("muted text on page", V["muted"], V["paper"], 4.5),
    ("muted text on card", V["muted"], V["card"], 4.5),
    ("fine print on card2", V["faint"], V["card2"], 4.5),
    ("muted text on card2", V["muted"], V["card2"], 4.5),
    ("links / accent-deep on card", V["accent-deep"], V["card"], 4.5),
    ("eyebrow accent on card", V["accent"], V["card"], 4.5),
    ("accent-deep on accent-soft", V["accent-deep"], V["accent-soft"], 4.5),
    ("white on primary button", "#ffffff", V["accent"], 4.5),
    ("dark on game button", "#08211d", V["accent-bright"], 4.5),
    ("game card text", V["hero-ink"], V["hero2"], 4.5),
    ("game card muted", V["hero-muted"], V["hero2"], 4.5),
    ("game kicker", "#7fd8cd", V["hero2"], 4.5),
    ("correct text", V["ok"], V["ok-bg"], 4.5),
    ("wrong text", V["bad"], V["bad-bg"], 4.5),
    ("warning pill text", V["warn"], V["warn-bg"], 4.5),
    ("choice letter on card3", "#3f4a57", V["card3"], 3.0),
    ("toast text", "#f2f7fb", "#16202b", 4.5),
    ("footer text", V["muted"], V["paper"], 4.5),
]

print("Contrast ratios (WCAG AA: 4.5 for text, 3.0 for large text / UI shapes)")
for label, fg, bg, need in PAIRS:
    r = contrast(fg, bg)
    mark = "ok " if r >= need else "FAIL"
    print(f"  {mark} {r:5.2f}:1  {label}  ({fg} on {bg}, needs {need})")
    if r < need:
        fail(f"contrast {label}: {r:.2f}:1 < {need}")

# ---------------------------------------------------------------- sizes
SIZE_RULES = [
    ("html,body base font-size 17px", r"html,body\{[^}]*font-size:17px", True),
    ("primary paragraph .body-text 17px", r"\.body-text\{[^}]*font-size:17px", True),
    ("lede 17px", r"\.lede\{[^}]*font-size:17px", True),
    ("quiz question 20px", r"\.q-text\{[^}]*font-size:20px", True),
    ("button min-height 50px", r"\.btn\{[^}]*min-height:50px", True),
    ("big button min-height 56px", r"\.btn\.big\{[^}]*min-height:56px", True),
    ("small button min-height 44px", r"\.btn\.sm\{[^}]*min-height:44px", True),
    ("icon button 46px square", r"\.icon-btn\{width:46px;height:46px", True),
    ("copy button min 44px", r"\.copy-btn\{[^}]*min-height:44px", True),
    ("chip min-height 44px", r"\.chip\{[^}]*min-height:44px", True),
    ("choice min-height 56px", r"\.choice\{[^}]*min-height:56px", True),
    ("back link min-height 44px", r"\.back\{[^}]*min-height:44px", True),
    ("top link min-height 44px", r"\.top-link\{[^}]*min-height:44px", True),
    ("horizontal overflow guard", r"html,body\{[^}]*overflow-x:hidden", True),
    ("mobile-first max width", r"#app\{max-width:640px", True),
    ("reduced motion block", r"@media \(prefers-reduced-motion:reduce\)\{[^@]*animation:none", True),
]
print("\nDeclared sizes and guards")
for label, pattern, must in SIZE_RULES:
    ok = re.search(pattern, CSS) is not None
    print(f"  {'ok  ' if ok else 'FAIL'} {label}")
    if must and not ok:
        fail(label)

# ---------------------------------------------------------------- html
print("\nDocument basics")
viewport = 'name="viewport"' in HTML and "width=device-width" in HTML
print(f"  {'ok  ' if viewport else 'FAIL'} viewport meta with width=device-width")
if not viewport:
    fail("viewport meta missing")
if not re.search(r'<html lang="en">', HTML):
    fail("html lang attribute missing")
print("  ok   html lang attribute present" if re.search(r'<html lang="en">', HTML) else "  FAIL html lang attribute")

bad_refs = [x for x in ("fonts.googleapis", "cdn.", "unpkg", "jsdelivr", "//cdn") if x in HTML + CSS]
if bad_refs:
    fail(f"external CDN/font reference found: {bad_refs}")
print("  ok   no external font/CDN reference" if not bad_refs else f"  FAIL external refs {bad_refs}")

if "fonts.googleapis" in CSS:
    fail("Google Fonts referenced in CSS")
if "font-family" in CSS and "sans-serif" not in CSS:
    fail("no system font stack")

# images: the legal guardrail forbids photos; only emoji/SVG/CSS shapes are allowed
if re.search(r"<img\b", HTML):
    fail("<img> element present; the build uses no image files")
print("  ok   no <img> element" if not re.search(r"<img\b", HTML) else "  FAIL <img> present")

# ---------------------------------------------------------------- report
if notes:
    print("\nNotes")
    for n in notes:
        print(f"  - {n}")
if failures:
    print("\nFAILURES")
    for f in failures:
        print(f"  - {f}")
    print(f"\n{len(failures)} failure(s)")
    sys.exit(1)
print("\nAll static accessibility checks passed.")
