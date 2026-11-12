#!/usr/bin/env python3
"""Data integrity check for the Idol Table data files.

Run:  python3 tools/validate_data.py
Exit code 0 = all checks passed, 1 = at least one error.

Checks
  * JSON parses; required top-level keys exist.
  * Unique ids in each collection.
  * Every reference resolves (place_id, person_id, area_id, route_id).
  * Every place and every question has sources[] with all four fields
    (outlet, title, date, url), non-empty, https, and on the verified media list.
  * Choice count is 4, answer index is inside the choices.
  * Coordinates are numeric and inside the world range; Korean places inside a
    Korea bounding box.
  * People without published places are marked coming-soon; people with places
    are not.
  * No image or photo fields are stored anywhere (legal guardrail).
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Only these two reports were opened and checked for this build.
VERIFIED_SOURCES = {
    "https://www.allurekorea.com/2024/02/23/%ec%95%84%ec%9d%b4%eb%8f%8c-%ec%b6%9c%eb%aa%b0-%eb%a7%9b%ec%a7%91-%eb%a6%ac%ec%8a%a4%ed%8a%b8-txt/",
    "https://www.gqkorea.co.kr/2024/10/08/%ec%9a%94%ec%a6%98-%ec%95%84%ec%9d%b4%eb%8f%8c%ec%9d%b4-%ec%88%a8%ea%b2%a8%eb%91%94-%ed%95%ab%ed%94%8c%eb%a0%88%ec%9d%b4%ec%8a%a4-%ea%b5%ad%eb%82%b4-ver/",
}

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def load(name):
    p = DATA / name
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        err(f"{name}: cannot parse ({exc})")
        return {}


def check_sources(where, items):
    if not isinstance(items, list) or not items:
        err(f"{where}: sources[] missing or empty")
        return 0
    for i, s in enumerate(items):
        for field in ("outlet", "title", "date", "url"):
            if not isinstance(s.get(field), str) or not s.get(field).strip():
                err(f"{where}: sources[{i}] lacks '{field}'")
        url = s.get("url", "")
        if url and not url.startswith("https://"):
            err(f"{where}: sources[{i}] url is not https ({url[:60]})")
        if url and url not in VERIFIED_SOURCES:
            err(f"{where}: sources[{i}] url is not on the verified list ({url[:60]})")
        date = s.get("date", "")
        if date and not (len(date) == 10 and date[4] == "-" and date[7] == "-"):
            err(f"{where}: sources[{i}] date is not YYYY-MM-DD ({date})")
    return len(items)


def main():
    people_doc = load("people.json")
    places_doc = load("places.json")
    questions_doc = load("questions.json")
    routes_doc = load("routes.json")

    people = people_doc.get("people", [])
    places = places_doc.get("places", [])
    areas = places_doc.get("areas", [])
    questions = questions_doc.get("questions", [])
    routes = routes_doc.get("routes", [])

    if not people:
        err("people.json: no people")
    if not places:
        err("places.json: no places")
    if not questions:
        err("questions.json: no questions")

    def unique(where, items):
        seen = set()
        for it in items:
            i = it.get("id")
            if not i:
                err(f"{where}: item without id")
            elif i in seen:
                err(f"{where}: duplicate id '{i}'")
            seen.add(i)
        return seen

    person_ids = unique("people", people)
    place_ids = unique("places", places)
    area_ids = unique("areas", areas)
    question_ids = unique("questions", questions)
    unique("routes", routes)

    person_by_id = {p["id"]: p for p in people if "id" in p}
    place_by_id = {p["id"]: p for p in places if "id" in p}
    route_ids = {r.get("id") for r in routes}

    # ---- people ----
    for p in people:
        pid = p.get("id", "?")
        for field in ("name_en", "name_ko", "status", "summary_en", "summary_ko"):
            if not str(p.get(field, "")).strip():
                err(f"people[{pid}]: missing {field}")
        for pl in p.get("place_ids", []):
            if pl not in place_ids:
                err(f"people[{pid}]: place_id '{pl}' does not exist")
        for a in p.get("area_ids", []):
            if a not in area_ids:
                err(f"people[{pid}]: area_id '{a}' does not exist")
        published_places = [place_by_id[x] for x in p.get("place_ids", [])
                            if x in place_by_id and place_by_id[x].get("status") == "published"]
        if p.get("status") == "published" and not published_places:
            err(f"people[{pid}]: published but has no published place")
        if p.get("status") == "coming-soon" and published_places:
            err(f"people[{pid}]: coming-soon but has published places")
        if p.get("launch") is True and len(p.get("place_ids", [])) and not published_places:
            err(f"people[{pid}]: launch member with place_ids but nothing published")

    # ---- places ----
    source_count = 0
    for pl in places:
        pid = pl.get("id", "?")
        for field in ("name_en", "name_ko", "name_roman", "category_en", "category_ko",
                      "address_ko", "address_en", "area_id", "status"):
            if not str(pl.get(field, "")).strip():
                err(f"places[{pid}]: missing {field}")
        if pl.get("area_id") not in area_ids:
            err(f"places[{pid}]: area_id '{pl.get('area_id')}' does not exist")
        lat, lng = pl.get("lat"), pl.get("lng")
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            err(f"places[{pid}]: lat/lng not numeric")
        else:
            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                err(f"places[{pid}]: lat/lng outside world range ({lat}, {lng})")
            if pl.get("area_id") and pl["area_id"] in area_ids:
                # Korea bounding box for all current areas
                if not (33.0 <= lat <= 39.0 and 124.0 <= lng <= 132.0):
                    err(f"places[{pid}]: coordinates {lat},{lng} outside Korea box")
        if not pl.get("what_ordered"):
            err(f"places[{pid}]: what_ordered is empty")
        for rid in pl.get("route_ids", []):
            if rid not in route_ids:
                err(f"places[{pid}]: route_id '{rid}' does not exist")
        for v in pl.get("visitors", []):
            if v.get("person_id") not in person_ids:
                err(f"places[{pid}]: visitor person_id '{v.get('person_id')}' does not exist")
            if v.get("evidence") not in ("menu", "mention"):
                err(f"places[{pid}]: visitor evidence must be 'menu' or 'mention'")
        if pl.get("hours") is None and not pl.get("hours_checked"):
            err(f"places[{pid}]: hours unknown but no hours_checked date")
        source_count += check_sources(f"places[{pid}]", pl.get("sources"))
        if pl.get("place_ids", {}).get("google"):
            warn(f"places[{pid}]: google place_id stored; Google terms allow storing place_id only")

    # ---- questions ----
    for q in questions:
        qid = q.get("id", "?")
        for field in ("type", "status", "question_en", "question_ko", "note_en", "note_ko"):
            if not str(q.get(field, "")).strip():
                err(f"questions[{qid}]: missing {field}")
        if q.get("type") not in ("A", "B", "C"):
            err(f"questions[{qid}]: type must be A, B or C")
        if q.get("place_id") not in place_ids:
            err(f"questions[{qid}]: place_id '{q.get('place_id')}' does not exist")
        if q.get("person_id") not in person_ids:
            err(f"questions[{qid}]: person_id '{q.get('person_id')}' does not exist")
        if q.get("route_id") and q["route_id"] not in route_ids:
            err(f"questions[{qid}]: route_id '{q['route_id']}' does not exist")
        for lang_key, n in (("choices_en", 4), ("choices_ko", 4)):
            choices = q.get(lang_key, [])
            if not isinstance(choices, list) or len(choices) != n:
                err(f"questions[{qid}]: {lang_key} must have {n} entries")
            elif len(set(choices)) != len(choices):
                err(f"questions[{qid}]: {lang_key} has duplicate options")
        ans = q.get("answer")
        if not isinstance(ans, int) or not (0 <= ans < 4):
            err(f"questions[{qid}]: answer index {ans} is not 0..3")
        source_count += check_sources(f"questions[{qid}]", q.get("sources"))
        # the answer must be backed by the question's own sources
        if q.get("place_id") in place_by_id:
            place_urls = {s["url"] for s in place_by_id[q["place_id"]].get("sources", []) if "url" in s}
            q_urls = {s["url"] for s in q.get("sources", []) if "url" in s}
            if q_urls and not (q_urls & place_urls):
                err(f"questions[{qid}]: sources do not overlap its place's sources")

    # ---- routes ----
    for r in routes:
        rid = r.get("id", "?")
        if r.get("status") != "published":
            continue
        stops = r.get("stops", [])
        if len(stops) < 2:
            err(f"routes[{rid}]: a route needs at least 2 stops")
        orders = [s.get("order") for s in stops]
        if len(set(orders)) != len(orders):
            err(f"routes[{rid}]: duplicate stop order values")
        for s in stops:
            if s.get("place_id") not in place_ids:
                err(f"routes[{rid}]: stop place_id '{s.get('place_id')}' does not exist")
            if not str(s.get("note_en", "")).strip() or not str(s.get("note_ko", "")).strip():
                err(f"routes[{rid}]: stop note missing")
        for a in r.get("area_ids", []):
            if a not in area_ids:
                err(f"routes[{rid}]: area_id '{a}' does not exist")
        for p in r.get("person_ids", []):
            if p not in person_ids:
                err(f"routes[{rid}]: person_id '{p}' does not exist")

    # ---- guardrail: no image fields ----
    def walk(obj, path):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.lower() in ("image", "images", "photo", "photos", "photo_url", "thumbnail", "logo"):
                    err(f"{path}: image-like field '{k}' is not allowed")
                walk(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, f"{path}[{i}]")

    for doc, name in ((people_doc, "people.json"), (places_doc, "places.json"),
                      (questions_doc, "questions.json"), (routes_doc, "routes.json")):
        walk(doc, name)

    # ---- summary ----
    published_places = [p for p in places if p.get("status") == "published"]
    published_q = [q for q in questions if q.get("status") == "published"]
    coming_soon = [p["name_en"] for p in people if p.get("status") == "coming-soon"]
    with_data = [p["name_en"] for p in people if p.get("status") == "published"]

    print("Idol Table — data validation")
    print(f"  people            : {len(people)}  (with reports: {len(with_data)}, coming soon: {len(coming_soon)})")
    print(f"  places            : {len(places)}  (published: {len(published_places)})")
    print(f"  questions         : {len(questions)}  (published: {len(published_q)})")
    print(f"  routes            : {len(routes)}")
    print(f"  source entries    : {source_count}")
    print(f"  coming-soon people: {', '.join(coming_soon) if coming_soon else '-'}")
    for w in warnings:
        print(f"  WARN  {w}")
    if errors:
        print("\nERRORS:")
        for e in errors:
            print(f"  - {e}")
        print(f"\n{len(errors)} error(s)")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
