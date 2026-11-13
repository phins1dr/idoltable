# Idol Quiz — K-pop 팬덤 대항 덕력고사

내 최애 그룹(팬덤)을 골라 10문제를 풀고, 정답마다 우리 팀에 점수를 쌓아
**주간 그룹 순위표**에서 다른 팬덤과 겨루는 정적 웹앱입니다.
순수 HTML + CSS + JS (빌드 없음). 배포: https://phins1dr.github.io/idoltable/

## 지금 들어 있는 것

| 축 | 동작 |
|---|---|
| 그룹전(메인) | 시작할 때 응원 그룹 선택 → 정답 1개마다 그 팀에 점수 적립 → 그룹 합산 순위표 |
| 난이도 | 쉬움(1점) / 보통(2점) / 덕후(3점). 시작 전에 선택, 순위표에 기준 표시 |
| 매일 새 문제 | Asia/Seoul 날짜 시드 → 하루 동안 모두 같은 세트, 자정에 교체 |
| 1:1 도전장 | 결과 링크에 점수·팀·난이도·날짜시드를 실어 보냄 → 받은 사람은 같은 문제·같은 난이도로 팀 대항 |
| 주간 시즌 | 월~일(Asia/Seoul), 월요일 00:00 리셋. 지난 시즌 내 최고 기록은 남음 |
| 누적 기록 | localStorage — 일별 점수, 연속 참여일, 최고 기록 |
| 실시간 랭킹 | Firebase 익명 로그인 + Firestore `idol_scores` (규칙 게시 전에는 자동으로 코드 순위표로 폴백) |
| 코드 순위표(폴백) | `KPOP.시즌.난이도.점수/최대.연속.팀.닉` 코드를 붙여넣어 순위표 생성 (서버 없음) |

## 파일

```
index.html     화면 (홈 · 퀴즈 · 결과 · 리그)
app.js         엔진 (날짜 시드, 점수, 도전장, 리그, Firebase 연동)
style.css      다크 테마
config.js      (구) 서비스 이름 설정 — 현재 화면은 index.html 문자열 사용
data/kpop_questions.json   문제 20문항 + 카테고리 + 등급 + level(1~3)
assets/og-cover.png        카톡·SNS 공유 카드 (tools/make_og.py로 생성)
assets/favicon.svg
firestore.rules.idol       실시간 랭킹용 보안 규칙(합본) — 콘솔에 게시해야 동작
tools/make_og.py           공유 카드 생성 스크립트
preview-mobile.html        데스크톱에서 390x844로 확인하는 미리보기 틀 (배포 사이트에서도 열림)
```

## 난이도 분류

`data/kpop_questions.json`의 각 문항에 `level` 필드가 있습니다. **새 문제를 만들지 않고
기존 20문항을 재분류**한 것입니다.

| level | 이름 | 점수 | 문항 수 |
|---|---|---|---|
| 1 | 쉬움 | 1점 | 8 |
| 2 | 보통 | 2점 | 6 |
| 3 | 덕후 | 3점 | 6 |

세트 구성은 난이도가 높을수록 높은 level부터 채웁니다(덕후 = level 3 전체 + level 2).
문항 풀이 작아서 10문제를 채우려면 옆 난이도에서 빌려옵니다.

## 결과 코드

```
KPOP.2026W46.덕후.18/30.3.BTS.지수
     └ 시즌   └난이도 └점수/최대 └연속일 └팀 └닉네임
```

- 팀 순위 = 그 주 팀원 점수 합 → 참여 인원 → 연속 참여일
- 개인 순위 = 점수 → 연속일 → 정답률

## Firebase (실시간 랭킹)

- 전용 프로젝트 `idol-quiz-38b09` (Spark 무료, 럭비 퀴즈와 완전 분리)
- 컬렉션 `idol_scores` 사용
- 문서 ID `{uid}_{시즌}` = 1인 1행
- 익명 로그인 사용 → `firebase.auth().signInAnonymously()`
- Firestore 서울 리전(asia-northeast3)에 `idol_scores` 전용 보안 규칙 게시 완료됨.

## 로컬 실행

```bash
python3 -m http.server 8000    # 이 폴더에서
# http://127.0.0.1:8000/
```

`file://`로 열면 JSON fetch가 막혀 폴백 데이터로 동작합니다.

## 배포

`gh-pages` 브랜치에 커밋·푸시하면 GitHub Pages가 그대로 서빙합니다. 빌드 없음.
