# Idol Table — 사이트 뼈대 (MVP)

셀럽 맛집 퀴즈 사이트의 첫 뼈대입니다. 순수 HTML + CSS + JS, **외부 CDN·프레임워크·빌드 도구 없음**.
로컬에서만 만들었고 커밋·푸시·배포는 하지 않았습니다.

## 실행

```bash
cd projects/kpop-food-quiz/site
python3 -m http.server 8000
# 브라우저에서 http://127.0.0.1:8000/ 열기
```

`index.html`을 파일로 직접 열면(`file://`) 브라우저가 JSON `fetch`를 막기 때문에 화면에 http로 열라는 안내가 나옵니다.
배포는 나중에 GitHub Pages(정적)로 그대로 올리면 됩니다 — 빌드 과정 없음.

## 서비스 이름 바꾸기

`config.js` 한 파일만 고치면 됩니다.

```js
window.SITE_CONFIG = {
  name: 'Idol Table',       // 탭 제목, 상단 브랜드, 푸터, 랭킹 코드 접두어
  nameKo: 'Idol Table',
  ...
};
```

`correctionContact`(정정 접수처)는 비워 두었고, 화면에는 "오픈 전 안내" 문구가 나옵니다.

`config.js`가 화면·탭 제목·랭킹 코드 접두어의 이름을 정합니다. `index.html`의 `<title>`과 브랜드 글자는
자바스크립트가 실행되기 전 잠깐 보이는 대체 문구(스크립트가 곧 덮어씀)이니, 이름을 바꿀 때 함께 고치면 됩니다.

## 화면 (해시 라우트)

| 화면 | 주소 |
|---|---|
| 홈 (오늘의 세트 · 랭킹 · 세 진입 타일 · 접힌 자료실) | `#/` |
| 아이돌 목록 | `#/idols` |
| 아이돌 상세 / 준비 중 상태 | `#/idol/{id}` (예: `#/idol/seventeen`, `#/idol/blackpink`) |
| 동네 목록 | `#/areas` |
| 동네 상세 | `#/area/{id}` |
| 장소 상세 (한글/영문/좌표 복사) | `#/place/{id}` |
| 동선 목록 | `#/routes` |
| 동선 상세 | `#/route/{id}` |
| 퀴즈 | `#/quiz` |
| 내 기록·배지·랭킹 코드 | `#/me` |

## 데이터

| 파일 | 내용 |
|---|---|
| `data/people.json` | 아티스트 10명 (첫 라인업 8 + 보도가 있는 NCT·차은우 2) |
| `data/places.json` | 동네 3곳 + 검증된 장소 3곳 |
| `data/questions.json` | 문제 12개 (A 인물→가게 / B 가게→메뉴·사실 / C 지역) |
| `data/routes.json` | 동선 1개 (압구정 → 청담, 도보) |

각 장소·문제의 `sources[]`는 **매체명 · 제목 · 게시일 · URL** 네 가지가 모두 채워져 있어야 하고,
`tools/validate_data.py`가 그 규칙과 참조 무결성·좌표 범위·이미지 필드 금지를 검사합니다.

## 검사 도구

```bash
python3 tools/validate_data.py   # 데이터 무결성
python3 tools/check_a11y.py      # 대비·글자 크기·터치 크기·넘침 (정적)
python3 tools/smoke_test.py      # 실제 브라우저로 홈→아이돌→장소→동선→퀴즈→채점 흐름
```

`smoke_test.py`는 로컬 http.server를 스스로 띄우고, 결과를 `tools/test_report.txt`,
화면 캡처를 `preview/`에 남깁니다. (헤드리스 Chromium — 시스템 라이브러리가 없는 환경에서는
`~/.local/chromelibs`에 받아 둔 라이브러리를 `LD_LIBRARY_PATH`로 물려 실행합니다.)

## 법적 가드레일 (코드에 반영된 것)

- 사진·로고·간판·지도 캡처 없음. 시각 요소는 CSS 도형과 이모지뿐.
- 모든 장소 문장은 "보도된 것으로" 서술하고 `Reported, not confirmed` 표시.
- 아티스트 이름을 서비스명·광고 문구에 쓰지 않음 (`config.js`의 이름은 중립).
- 광고 자리는 `index.html`에 주석 한 줄만 있고 코드는 없음.
- 정정 접수처는 오픈 전 채워 넣을 자리로 비워 둠.

## 검토용 시안 페이지 (2026-11-12)

`sample-seventeen-seongsu.html` — "SEVENTEEN 성수 반나절 코스" 시안 1장. 동근 님이 화면을 눈으로 보고
레이아웃·문구·정보 밀도를 판단하기 위한 페이지입니다. **모든 장소·영업시간·출처·방문 기록은 샘플**이며
페이지 상단 배너와 카드마다 `(sample)` 표기가 붙어 있습니다.

```bash
# 서버 없이 파일로 바로 열립니다 (fetch를 쓰지 않는 단일 페이지)
open sample-seventeen-seongsu.html

# 휴대폰 폭(390px) 스크린샷을 다시 만들 때
python3 tools/screenshot_sample.py     # -> screenshots/ 3장, 콘솔 오류·가로 넘침 검사
```

이 페이지가 반영한 규칙: `route_rule_v0.3.md`의 포지셔닝 문구, 근거 등급(verified/single/stale)과
근거 날짜, 취향 3단계 표기, 장소 3~5곳·단일 출처 최대 1곳, 면책 문구. 메인 MVP(`index.html`)와
데이터(`data/*.json`)는 건드리지 않았습니다.

## 아직 안 된 것

- 배포·도메인·광고 코드 (의도적으로 없음)
- 영업시간: 세 곳 모두 미확인 → 화면에 "확인 필요 (2026-11-12 확인)"으로 표시
- 공식 영문주소 DB 대조: 세 곳 모두 도로명 규칙 로마자화 값 → 화면에 그 사실을 표시
- 지도: 정적 지도·유료 API 없이 구글맵·네이버지도 검색 링크만
