/* ============================================================
   Idol Table — app
   Plain HTML/CSS/JS. No framework, no build step, no CDN.
   Data: data/people.json, data/places.json, data/questions.json, data/routes.json
   Game: date-seeded daily set, streak, four levels, badges, ranking codes.
          Everything is stored in this browser's localStorage only.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var NAME = CFG.name || 'Idol Table';

  var $ = function (id) { return document.getElementById(id); };
  var VIEWS = ['home', 'idols', 'idol', 'areas', 'area', 'place', 'routes', 'route', 'quiz', 'result', 'me'];
  var LETTERS = ['A', 'B', 'C', 'D'];

  var STORE = {
    progress: 'idoltable.v1.progress',
    session: 'idoltable.v1.session',
    game: 'idoltable.v1.game',
    lang: 'idoltable.v1.lang'
  };

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function reduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function todayKey(d) {
    var t = d || new Date();
    var p = function (n) { return (n < 10 ? '0' + n : '' + n); };
    return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
  }
  function yesterdayKey() { return todayKey(new Date(Date.now() - 86400000)); }

  /* ================= language ================= */
  var lang = load(STORE.lang, CFG.defaultLang || 'en');
  if (lang !== 'en' && lang !== 'ko') lang = 'en';

  var T = {
    en: {
      navIdols: 'Idols',
      navQuiz: 'Quiz',
      langSwitch: '한국어',
      homeTitle: 'Where idols ate, and what they ordered',
      homeLede: 'Every place here is tied to a report you can open. Play today\u2019s quiz, then walk the same streets.',
      todaysChallenge: 'TODAY\u2019S CHALLENGE',
      bankLine: '{n} questions in the bank \u00b7 today\u2019s set: {m}',
      setLine: 'Today\u2019s {m} questions',
      bankNote: 'Bank: {n} questions.',
      playDaily: 'Play today\u2019s {m} questions',
      redoDaily: 'Play today\u2019s set again',
      dailyDone: 'Done for today',
      dailyDoneNote: 'Today\u2019s set is finished. A new set unlocks tomorrow.',
      dailyOpenNote: 'Same set for everyone today, chosen by the date. No account needed.',
      oneMore: 'One more round (random)',
      resume: 'Resume',
      levelWord: 'Level',
      streakWord: 'day streak',
      bestWord: 'best',
      ranking: 'RANKING',
      rankNote: 'There is no server, so this is not a live leaderboard. Share your code and paste your friends\u2019 codes to build one together.',
      myCode: 'Copy my code',
      addCode: 'Paste a friend\u2019s code',
      badgesWord: 'badges',
      tileIdols: 'Find by idol',
      tileIdolsSub: '{n} artists \u00b7 {p} places from reports',
      tileAreas: 'Find by area',
      tileAreasSub: '{n} areas \u00b7 what is reported in each',
      tileRoutes: 'Routes',
      tileRoutesSub: 'Two tables, one afternoon \u00b7 walk times',
      aboutData: 'About the data \u00b7 sources',
      idolsTitle: 'Find by idol',
      idolsLede: 'A place appears only after at least one linked report names it. Nothing here is guessed.',
      lineup: 'Launch lineup',
      alsoReports: 'Also with reports',
      placesCount: '{n} place',
      placesCountPlural: '{n} places',
      reportsCount: '{n} report',
      reportsCountPlural: '{n} reports',
      comingSoon: 'Coming soon',
      comingSoonShort: 'Coming soon',
      basedOn: 'Based on {n} public report',
      basedOnPlural: 'Based on {n} public reports',
      comingSoonTitle: 'Coming soon',
      comingSoonBody: 'No linked report has been verified for this artist yet. Rather than invent one, this page stays empty until one is. It will fill the day the first report is checked.',
      seeIdolsWithReports: 'See the artists with reports',
      reportedPlaces: 'Reported places',
      menReported: 'Menu reported',
      mentionOnly: 'Mentioned as a visitor',
      otherIdolsHere: 'Other idols reported in this area',
      sources: 'Sources',
      openReport: 'Open the report',
      placeTitle: 'Place',
      category: 'Category',
      areaLabel: 'Area',
      reportedNotConfirmed: 'Reported, not confirmed',
      whatTheyOrdered: 'What they ordered',
      reportSays: 'What the report says',
      whoWent: 'Reported visitors',
      hours: 'Opening hours',
      hoursUnknown: 'Not verified yet \u2014 check before you go',
      hoursChecked: 'Checked {d}',
      findIt: 'Find it',
      copy: 'Copy',
      copied: 'Copied',
      copyFailed: 'Could not copy \u2014 select the text instead',
      koreanAddress: 'Korean address',
      englishAddress: 'English address',
      coordinates: 'Coordinates',
      romanizedNote: 'Romanized from the Korean road-name address; not yet checked against the official English address database.',
      openGoogle: 'Google Maps',
      openNaver: 'Naver Map',
      onTheRoute: 'On the route',
      noPhotos: 'No shop photos, logos, signboards or map screenshots are used on this site.',
      areasTitle: 'Find by area',
      areasLede: 'Places grouped by the neighbourhood they sit in.',
      areaPlaces: 'Reported here',
      areaEmpty: 'No published place in this area yet.',
      routesTitle: 'Routes',
      routesLede: 'Places in the same district, put in an order you can walk.',
      routeStops: '{n} stops',
      routeWalk: '\u2248 {km} km \u00b7 about {min} min on foot',
      routeEstimate: 'Distance is a straight line between the stored coordinates with a 1.25 road factor, walked at 4.8 km/h. It is an estimate, not a turn-by-turn route.',
      routeCopy: 'Copy this route',
      routeCopied: 'Route copied',
      stopWord: 'Stop',
      openPlace: 'Open place',
      directions: 'Directions',
      quizQuestion: 'Question {i} of {n}',
      checkAnswer: 'Check answer',
      nextQuestion: 'Next question',
      seeResult: 'See result',
      correct: 'Correct',
      wrong: 'Not quite',
      answerWas: 'Answer: {a}',
      explanation: 'Why',
      openPlacePage: 'Open the place page',
      openRoutePage: 'Open the route',
      typeA: 'Who went where',
      typeB: 'What was ordered',
      typeC: 'Which area',
      leaveQuiz: 'Leave the quiz',
      resultTitle: 'Result',
      score: '{r} of {n}',
      msgPerfect: 'A clean sweep. You know the reports.',
      msgGood: 'Solid. The ones you missed are below.',
      msgLow: 'Read the sources on the ones you missed \u2014 that is where the answers live.',
      wrongList: 'Missed questions',
      playAgain: 'Play again (random {n})',
      home: 'Home',
      meTitle: 'My record',
      levelLabel: 'Level',
      nextLevel: '{n} more correct to reach \u201c{next}\u201d',
      topLevel: 'Top level reached \u00b7 {xp} correct so far',
      streakLine: 'Streak {d} days \u00b7 best {b}',
      streakNone: 'No streak yet \u2014 finish a daily set to start one.',
      badgeTitle: 'Badges',
      notEarned: 'Not yet',
      rankTitle: 'Ranking code',
      rankExplain: 'Your code holds your nickname, how many questions you have answered correctly, and today\u2019s date. Paste friends\u2019 codes to see a combined table.',
      nickname: 'Nickname',
      nickPlaceholder: 'e.g. Table 4',
      makeCode: 'Make my code',
      copyCode: 'Copy code',
      pasteLabel: 'Paste friends\u2019 codes (one per line)',
      pastePlaceholder: 'Paste one or more codes here',
      addToBoard: 'Add to the table',
      boardEmpty: 'No codes pasted yet.',
      boardNote: 'Combined from codes you pasted. Nothing is sent anywhere.',
      resetTitle: 'Saved data',
      resetBody: 'Answered questions, streak, badges and ranking codes are stored in this browser only.',
      reset: 'Erase my record',
      resetDone: 'Erased',
      back: 'Back',
      errorLoad: 'Could not load the data. Open the site over http (a local server or a web host), not as a file.',
      footNote: 'Reports-based. Not affiliated with any artist, agency or restaurant.',
      corrected: 'Something wrong?',
      correctedBody: 'Every item can be corrected or taken down. A correction address will be published here before launch.',
      noReportsYet: 'No verified report yet',
      scoreLabel: 'Score',
      copiedCode: 'Code copied',
      codeMade: 'Code made \u2014 select it if the copy did not work',
      badCode: 'No valid code found',
      addedCodes: '{n} codes added',
      todaysSet: 'Today\u2019s set',
      randomSet: 'Random round'
    },
    ko: {
      navIdols: '아이돌',
      navQuiz: '퀴즈',
      langSwitch: 'EN',
      homeTitle: '아이돌이 다녀간 곳, 무엇을 먹었나',
      homeLede: '여기 있는 모든 장소에는 열어볼 수 있는 보도가 붙어 있습니다. 오늘의 퀴즈를 풀고, 같은 동네 길을 걸어보세요.',
      todaysChallenge: '오늘의 도전',
      bankLine: '문제은행 {n}문제 \u00b7 오늘은 {m}문제',
      setLine: '오늘의 {m}문제',
      bankNote: '문제은행 {n}문제.',
      playDaily: '오늘의 {m}문제 풀기',
      redoDaily: '오늘 세트 다시 풀기',
      dailyDone: '오늘 몫 완료',
      dailyDoneNote: '오늘 세트는 끝냈습니다. 새 세트는 내일 열립니다.',
      dailyOpenNote: '날짜로 정해지는 세트라 오늘은 모두 같은 문제입니다. 계정은 필요 없습니다.',
      oneMore: '한 판 더 (랜덤)',
      resume: '이어풀기',
      levelWord: '레벨',
      streakWord: '연속',
      bestWord: '최고',
      ranking: '랭킹',
      rankNote: '서버가 없는 사이트라 실시간 순위가 아닙니다. 내 코드를 보내고 친구 코드를 붙여넣으면 그 코드들로 순위표를 만듭니다.',
      myCode: '내 코드 복사',
      addCode: '친구 코드 붙여넣기',
      badgesWord: '배지',
      tileIdols: '아이돌로 찾기',
      tileIdolsSub: '아티스트 {n}명 \u00b7 보도된 장소 {p}곳',
      tileAreas: '동네로 찾기',
      tileAreasSub: '동네 {n}곳 \u00b7 어디에 무엇이 보도됐나',
      tileRoutes: '동선',
      tileRoutesSub: '두 곳을 반나절에 \u00b7 도보 시간',
      aboutData: '자료실 \u00b7 출처',
      idolsTitle: '아이돌로 찾기',
      idolsLede: '링크가 붙은 보도가 한 건이라도 있는 곳만 올립니다. 추측으로 채우지 않습니다.',
      lineup: '첫 라인업',
      alsoReports: '보도가 있는 다른 아티스트',
      placesCount: '{n}곳',
      placesCountPlural: '{n}곳',
      reportsCount: '보도 {n}건',
      reportsCountPlural: '보도 {n}건',
      comingSoon: '준비 중',
      comingSoonShort: '준비 중',
      basedOn: '공개 보도 {n}건 기반',
      basedOnPlural: '공개 보도 {n}건 기반',
      comingSoonTitle: '준비 중입니다 \u00b7 곧 공개',
      comingSoonBody: '이 아티스트에 대해 검증된 링크 보도가 아직 없습니다. 지어내지 않고, 첫 보도가 확인되는 날 이 화면이 채워집니다.',
      seeIdolsWithReports: '보도가 있는 아티스트 보기',
      reportedPlaces: '보도된 장소',
      menReported: '메뉴까지 보도됨',
      mentionOnly: '방문자로 언급됨',
      otherIdolsHere: '이 동네에 보도된 다른 아이돌',
      sources: '출처',
      openReport: '보도 열기',
      placeTitle: '장소',
      category: '분류',
      areaLabel: '동네',
      reportedNotConfirmed: '보도된 곳 \u00b7 확인된 사실 아님',
      whatTheyOrdered: '무엇을 시켰나',
      reportSays: '보도 내용',
      whoWent: '다녀간 것으로 보도된 사람',
      hours: '영업시간',
      hoursUnknown: '미확인 \u2014 방문 전에 확인하세요',
      hoursChecked: '{d} 확인',
      findIt: '위치',
      copy: '복사',
      copied: '복사했습니다',
      copyFailed: '복사가 막혔습니다 \u2014 글자를 직접 선택해 주세요',
      koreanAddress: '한글 주소',
      englishAddress: '영문 주소',
      coordinates: '좌표',
      romanizedNote: '한글 도로명주소를 로마자화한 값입니다. 공식 영문주소 DB와 대조하지는 않았습니다.',
      openGoogle: '구글맵',
      openNaver: '네이버지도',
      onTheRoute: '이 동선에 포함',
      noPhotos: '가게 사진·로고·간판·지도 캡처는 쓰지 않습니다.',
      areasTitle: '동네로 찾기',
      areasLede: '같은 동네에 있는 장소끼리 묶었습니다.',
      areaPlaces: '이 동네의 보도',
      areaEmpty: '아직 공개된 장소가 없습니다.',
      routesTitle: '동선',
      routesLede: '같은 구에 있는 장소를 걸어서 옮길 수 있는 순서로 묶었습니다.',
      routeStops: '{n}곳',
      routeWalk: '\u2248 {km}km \u00b7 도보 약 {min}분',
      routeEstimate: '거리는 저장된 좌표 사이 직선거리에 도로 보정 1.25를 곱하고 시속 4.8km로 계산한 값입니다. 길안내가 아니라 추정치입니다.',
      routeCopy: '이 동선 복사',
      routeCopied: '동선을 복사했습니다',
      stopWord: '지점',
      openPlace: '장소 보기',
      directions: '길찾기',
      quizQuestion: '{n}문제 중 {i}번',
      checkAnswer: '정답 확인',
      nextQuestion: '다음 문제',
      seeResult: '결과 보기',
      correct: '정답입니다',
      wrong: '아쉽습니다',
      answerWas: '정답: {a}',
      explanation: '해설',
      openPlacePage: '장소 페이지 열기',
      openRoutePage: '동선 보기',
      typeA: '누가 어디로',
      typeB: '무엇을 시켰나',
      typeC: '어느 동네',
      leaveQuiz: '퀴즈 나가기',
      resultTitle: '결과',
      score: '{n}문제 중 {r}문제',
      msgPerfect: '전부 맞혔습니다. 보도를 제대로 읽으셨네요.',
      msgGood: '좋습니다. 틀린 문제는 아래에 있습니다.',
      msgLow: '틀린 문제의 출처를 읽어보세요. 답은 거기에 있습니다.',
      wrongList: '틀린 문제',
      playAgain: '한 판 더 (랜덤 {n})',
      home: '홈으로',
      meTitle: '내 기록',
      levelLabel: '레벨',
      nextLevel: '다음 레벨 \u201c{next}\u201d까지 {n}문제',
      topLevel: '최고 레벨 \u00b7 지금까지 {xp}문제 정답',
      streakLine: '연속 {d}일 \u00b7 최고 {b}일',
      streakNone: '연속 기록이 없습니다 \u2014 오늘 세트를 끝내면 시작됩니다.',
      badgeTitle: '배지',
      notEarned: '미획득',
      rankTitle: '랭킹 코드',
      rankExplain: '코드에는 닉네임, 지금까지 맞힌 문제 수, 오늘 날짜가 담깁니다. 친구 코드를 붙여넣으면 합친 표를 볼 수 있습니다.',
      nickname: '닉네임',
      nickPlaceholder: '예: 4번 테이블',
      makeCode: '내 코드 만들기',
      copyCode: '코드 복사',
      pasteLabel: '친구 코드 붙여넣기 (한 줄에 하나)',
      pastePlaceholder: '받은 코드를 여기에 붙여넣으세요',
      addToBoard: '표에 추가',
      boardEmpty: '아직 붙여넣은 코드가 없습니다.',
      boardNote: '붙여넣은 코드로만 만든 표입니다. 어디로도 전송되지 않습니다.',
      resetTitle: '저장 데이터',
      resetBody: '푼 문제, 연속 기록, 배지, 랭킹 코드는 이 브라우저에만 저장됩니다.',
      reset: '내 기록 지우기',
      resetDone: '지웠습니다',
      back: '뒤로',
      errorLoad: '데이터를 불러오지 못했습니다. 파일로 열지 말고 http(로컬 서버나 호스팅)로 열어 주세요.',
      footNote: '공개 보도 기반. 어떤 아티스트·소속사·가게와도 제휴가 없습니다.',
      corrected: '잘못된 정보가 있나요?',
      correctedBody: '모든 항목은 정정하거나 내릴 수 있습니다. 정정 접수 주소는 오픈 전에 이곳에 안내합니다.',
      noReportsYet: '검증된 보도 없음',
      scoreLabel: '점수',
      copiedCode: '코드를 복사했습니다',
      codeMade: '코드를 만들었습니다 \u2014 복사가 안 되면 직접 선택해 주세요',
      badCode: '형식에 맞는 코드가 없습니다',
      addedCodes: '코드 {n}개 추가',
      todaysSet: '오늘의 세트',
      randomSet: '랜덤 한 판'
    }
  };

  function t(key, vars) {
    var s = (T[lang] && T[lang][key]) || (T.en[key] || key);
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
    return s;
  }
  function pick(obj, base) { if (!obj) return ''; return obj[base + '_' + lang] || obj[base + '_en'] || obj[base + '_ko'] || ''; }
  function other(obj, base) { var k = base + '_' + (lang === 'en' ? 'ko' : 'en'); return obj[k] || ''; }

  /* ================= data ================= */
  var DATA = { people: [], places: [], areas: [], questions: [], routes: [] };
  var BY = { person: {}, place: {}, area: {}, question: {}, route: {} };

  function index() {
    [['people', 'person'], ['places', 'place'], ['areas', 'area'], ['questions', 'question'], ['routes', 'route']].forEach(function (pair) {
      var list = DATA[pair[0]] || [];
      BY[pair[1]] = {};
      list.forEach(function (x) { BY[pair[1]][x.id] = x; });
    });
  }
  function publishedPlaces() { return DATA.places.filter(function (p) { return p.status === 'published'; }); }
  function publishedQuestions() { return DATA.questions.filter(function (q) { return q.status === 'published'; }); }
  function placesOfPerson(p) { return (p.place_ids || []).map(function (id) { return BY.place[id]; }).filter(function (p2) { return p2 && p2.status === 'published'; }); }
  function peopleOfPlace(place) { return (place.visitors || []).map(function (v) { return BY.person[v.person_id]; }).filter(Boolean); }
  function placesOfArea(areaId) { return publishedPlaces().filter(function (p) { return p.area_id === areaId; }); }
  function areasOfPerson(p) {
    var ids = {};
    placesOfPerson(p).forEach(function (pl) { ids[pl.area_id] = 1; });
    return Object.keys(ids).map(function (id) { return BY.area[id]; }).filter(Boolean);
  }
  function reportUrls(items) {
    var seen = {}, out = [];
    items.forEach(function (it) {
      (it.sources || []).forEach(function (s) { if (s && s.url && !seen[s.url]) { seen[s.url] = 1; out.push(s); } });
    });
    return out;
  }
  function reportsOfPerson(p) { return reportUrls(placesOfPerson(p)); }
  function reportsOfPlace(p) { return reportUrls([p]); }
  function allSources() { return reportUrls(publishedPlaces()); }

  /* ================= geometry ================= */
  function distanceKm(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function walkMin(km) { return Math.max(1, Math.round((km * 1.25) / 4.8 * 60 / 5) * 5); }
  function routeLegs(route) {
    var stops = (route.stops || []).slice().sort(function (a, b) { return a.order - b.order; });
    var legs = [], total = 0;
    for (var i = 1; i < stops.length; i++) {
      var a = BY.place[stops[i - 1].place_id], b = BY.place[stops[i].place_id];
      if (!a || !b) continue;
      var straight = distanceKm(a, b), km = straight * 1.25, min = walkMin(straight);
      legs.push({ from: a, to: b, km: km, straight: straight, min: min });
      total += km;
    }
    return { stops: stops, legs: legs, km: total, min: total ? walkMin(total / 1.25) : 0 };
  }

  /* ================= game state ================= */
  var progress = load(STORE.progress, {});
  var game = load(STORE.game, null);
  if (!game || typeof game !== 'object') game = {};
  if (!game.daily) game.daily = null;
  if (!game.badges || typeof game.badges !== 'object') game.badges = {};
  if (!game.streak || typeof game.streak !== 'object') game.streak = { last: '', days: 0, best: 0 };
  if (!game.rank || typeof game.rank !== 'object') game.rank = { nick: '', board: [] };
  function saveGame() { save(STORE.game, game); }

  var LEVELS = [
    { xp: 0, en: 'Taste Rookie', ko: '맛초보' },
    { xp: 3, en: 'Neighbourhood Regular', ko: '동네 단골' },
    { xp: 6, en: 'Foodie Guide', ko: '맛집 가이드' },
    { xp: 10, en: 'Seoul Insider', ko: '서울 인사이더' }
  ];
  function xpOf() { return Object.keys(progress).filter(function (k) { return progress[k] && progress[k].ok; }).length; }
  function levelOf() {
    var xp = xpOf(), i = 0;
    for (var k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].xp) i = k;
    var next = LEVELS[i + 1] || null;
    return { i: i, xp: xp, name: LEVELS[i][lang] || LEVELS[i].en, next: next ? (next[lang] || next.en) : null, need: next ? next.xp - xp : 0 };
  }
  function levelPct() {
    var lv = levelOf();
    if (!lv.next) return 100;
    var base = LEVELS[lv.i].xp, top = LEVELS[lv.i + 1].xp;
    return Math.max(4, Math.min(100, Math.round(((lv.xp - base) / (top - base)) * 100)));
  }
  function badgeDefs() {
    return [
      { id: 'first', icon: '🥢', en: 'First table', ko: '첫 테이블' },
      { id: 'perfect', icon: '🎯', en: '10 out of 10', ko: '10문제 만점' },
      { id: 'streak7', icon: '🔥', en: '7-day streak', ko: '7일 연속' },
      { id: 'streak30', icon: '🔥', en: '30-day streak', ko: '30일 연속' },
      { id: 'allq', icon: '🏆', en: 'Whole bank cleared', ko: '문제은행 완주' }
    ];
  }

  var session = load(STORE.session, null);
  if (!session || !session.ids || !session.ids.length) session = null;

  function dailyIds() {
    var key = todayKey();
    if (game.daily && game.daily.date === key && game.daily.ids && game.daily.ids.length) return game.daily.ids;
    var seed = parseInt(key.replace(/-/g, ''), 10) % 2147483647;
    var rnd = function () { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    var pool = publishedQuestions().map(function (q) { return q.id; });
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    var size = Math.min(CFG.dailySize || 10, pool.length);
    var ids = pool.slice(0, size);
    game.daily = { date: key, ids: ids, done: false };
    saveGame();
    return ids;
  }
  function dailyDone() { return !!(game.daily && game.daily.date === todayKey() && game.daily.done); }
  function savedSession() { return (session && session.ids && session.ids.length && session.i < session.ids.length) ? session : null; }

  /* ================= rendering helpers ================= */
  var COPY = {};
  function copyKey(text) {
    var k = 'c' + (Object.keys(COPY).length + 1);
    COPY[k] = text;
    return k;
  }
  function copyBtn(text, label) {
    var k = copyKey(text);
    return '<button class="copy-btn" type="button" data-copy-key="' + k + '">' +
      '<span aria-hidden="true">⧉</span><span>' + esc(label) + '</span></button>';
  }
  function show(v) {
    VIEWS.forEach(function (x) { var el = $('view-' + x); if (el) el.hidden = (x !== v); });
    document.documentElement.lang = lang;
    var foot = $('siteFoot');
    if (foot) {
      foot.innerHTML = '<p class="foot-brand">' + esc(lang === 'ko' ? (CFG.nameKo || NAME) : NAME) + '</p>' +
        '<p>' + esc(t('footNote')) + '</p>' +
        '<p class="foot-meta">' + esc(CFG.tagline ? (CFG.tagline[lang] || CFG.tagline.en) : '') + '</p>';
    }
    window.scrollTo(0, 0);
  }
  function setTitle(page) {
    document.title = page ? (page + ' · ' + NAME) : NAME;
    var b = $('brand');
    if (b) b.textContent = lang === 'ko' ? (CFG.nameKo || NAME) : NAME;
    var ni = $('navIdols'), nq = $('navQuiz'), lt = $('langToggle');
    if (ni) ni.textContent = t('navIdols');
    if (nq) nq.textContent = t('navQuiz');
    if (lt) { lt.textContent = t('langSwitch'); lt.setAttribute('aria-label', lang === 'ko' ? 'Switch to English' : '한국어로 전환'); }
  }
  function pill(text, cls) { return '<span class="pill' + (cls ? ' ' + cls : '') + '">' + esc(text) + '</span>'; }
  function pcount(n) { return t(n === 1 ? 'placesCount' : 'placesCountPlural', { n: n }); }
  function rcount(n) { return t(n === 1 ? 'reportsCount' : 'reportsCountPlural', { n: n }); }
  function placeName(place) {
    var main = lang === 'ko' ? place.name_ko : place.name_en;
    var sub = lang === 'ko' ? place.name_en : place.name_ko;
    return { main: main, sub: sub };
  }
  function personName(p) {
    var main = lang === 'ko' ? p.name_ko : p.name_en;
    var sub = lang === 'ko' ? p.name_en : p.name_ko;
    return { main: main, sub: sub };
  }
  function areaName(a) { return lang === 'ko' ? a.name_ko : a.name_en; }
  function areaDistrict(a) { return lang === 'ko' ? a.district_ko : a.district_en; }
  function srcList(sources) {
    return '<ul class="src-list">' + sources.map(function (s) {
      var title = s.title;
      var gloss = lang === 'en' && s.title_gloss_en ? ' <span class="gloss">(' + esc(s.title_gloss_en) + ')</span>' : '';
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(title) + '</a>' + gloss +
        '<span class="src-meta">' + esc(s.outlet) + ' · ' + esc(s.date) + '</span></li>';
    }).join('') + '</ul>';
  }
  function googleMapsUrl(place) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.lat + ',' + place.lng);
  }
  function naverMapsUrl(place) {
    return 'https://map.naver.com/p/search/' + encodeURIComponent(place.name_ko);
  }
  function placeRow(place, evidence) {
    var n = placeName(place);
    var area = BY.area[place.area_id];
    var order = place.what_ordered || [];
    var menu = order.map(function (m) { return lang === 'ko' ? m.ko : m.en; }).join(' · ');
    return '<li class="row-item">' +
      '<a class="row" href="#/place/' + encodeURIComponent(place.id) + '">' +
      '<span class="row-main"><b>' + esc(n.main) + '</b><span class="row-sub">' + esc(n.sub) + '</span></span>' +
      '<span class="row-meta">' + (area ? esc(areaName(area)) : '') + ' · ' + esc(rcount(reportsOfPlace(place).length)) + '</span>' +
      (menu ? '<span class="row-note">' + esc(menu) + '</span>' : '') +
      (evidence ? '<span class="row-tags">' + (evidence === 'menu' ? pill(t('menReported'), 'ok') : pill(t('mentionOnly'), 'soft')) + '</span>' : '') +
      '</a></li>';
  }

  /* ================= home ================= */
  function renderHome() {
    var bank = publishedQuestions().length;
    var ids = dailyIds();
    var done = dailyDone();
    var st = game.streak || { days: 0, best: 0 };
    var lv = levelOf();
    var badges = badgeDefs();
    var got = badges.filter(function (b) { return game.badges[b.id]; });
    var saved = savedSession();
    var places = publishedPlaces().length;
    var peopleWithReports = DATA.people.filter(function (p) { return placesOfPerson(p).length; }).length;
    var areas = DATA.areas.filter(function (a) { return placesOfArea(a.id).length; }).length;
    var routes = DATA.routes.filter(function (r) { return r.status === 'published'; }).length;

    var html = '' +
      '<div class="home-head">' +
      '<p class="eyebrow">' + esc(NAME) + '</p>' +
      '<h1 class="home-title" id="homeTitle">' + esc(t('homeTitle')) + '</h1>' +
      '<p class="lede">' + esc(t('homeLede')) + '</p>' +
      '</div>' +

      '<section class="game-card" aria-labelledby="dailyLabel">' +
      '<p class="game-kicker" id="dailyLabel">' + esc(t('todaysChallenge')) + '</p>' +
      '<p class="game-state">' + esc(done ? t('dailyDone') : t('setLine', { m: ids.length })) + '</p>' +
      '<button class="btn primary big" type="button" data-action="play-daily">' + esc(done ? t('redoDaily') : t('playDaily', { m: ids.length })) + '</button>' +
      '<p class="game-note">' + esc(done ? t('dailyDoneNote') : t('dailyOpenNote') + ' ' + t('bankNote', { n: bank })) + '</p>' +
      '<div class="game-sub">' +
      '<button class="btn" type="button" data-action="play-random">' + esc(t('oneMore')) + '</button>' +
      (saved ? '<button class="btn ghost" type="button" data-action="resume">' + esc(t('resume')) + ' (' + (saved.i + 1) + '/' + saved.ids.length + ')</button>' : '') +
      '</div>' +
      '<div class="game-stats">' +
      '<span><span class="stat-k">' + esc(t('levelWord')) + '</span> <b>' + esc(lv.name) + '</b></span>' +
      '<span><span class="stat-k">' + esc(t('streakWord')) + '</span> <b>' + (st.days || 0) + '</b>' + (lang === 'ko' ? '일' : '') + '</span>' +
      '<span><span class="stat-k">' + esc(t('badgesWord')) + '</span> <b>' + got.length + '/' + badges.length + '</b></span>' +
      '</div>' +
      '</section>' +

      '<section class="rank-card" aria-labelledby="rankHead">' +
      '<div class="card-head"><p class="game-kicker" id="rankHead">' + esc(t('ranking')) + '</p>' +
      '<a class="text-link" href="#/me">' + esc(t('meTitle')) + ' →</a></div>' +
      '<p class="rank-level">' + esc(lv.name) + '</p>' +
      '<div class="level-bar" role="img" aria-label="' + esc(t('levelWord') + ' ' + lv.name) + '"><span style="width:' + levelPct() + '%"></span></div>' +
      '<p class="rank-next">' + esc(lv.next ? t('nextLevel', { n: lv.need, next: lv.next }) : t('topLevel', { xp: lv.xp })) + '</p>' +
      '<p class="rank-streak">' + esc(t('streakLine', { d: st.days || 0, b: st.best || 0 })) + '</p>' +
      renderMiniBoard() +
      '<div class="card-actions">' +
      '<button class="btn ghost" type="button" data-action="copy-code">' + esc(t('myCode')) + '</button>' +
      '<button class="btn ghost" type="button" data-go="#/me?paste=1">' + esc(t('addCode')) + '</button>' +
      '</div>' +
      '<p class="fine">' + esc(t('rankNote')) + '</p>' +
      '</section>' +

      '<nav class="tiles" aria-label="' + esc(t('homeTitle')) + '">' +
      '<a class="tile" href="#/idols"><span class="tile-kicker">01</span><span class="tile-title">' + esc(t('tileIdols')) + '</span>' +
      '<span class="tile-sub">' + esc(t('tileIdolsSub', { n: DATA.people.length, p: places })) + '</span></a>' +
      '<a class="tile" href="#/areas"><span class="tile-kicker">02</span><span class="tile-title">' + esc(t('tileAreas')) + '</span>' +
      '<span class="tile-sub">' + esc(t('tileAreasSub', { n: areas })) + '</span></a>' +
      '<a class="tile" href="#/routes"><span class="tile-kicker">03</span><span class="tile-title">' + esc(t('tileRoutes')) + '</span>' +
      '<span class="tile-sub">' + esc(t('tileRoutesSub')) + '</span></a>' +
      '</nav>' +

      renderSourcesPanel();

    $('view-home').innerHTML = html;
    setTitle('');
    show('home');
  }

  function renderMiniBoard() {
    var board = (game.rank.board || []).slice().sort(function (a, b) { return b.x - a.x; }).slice(0, 3);
    if (!board.length) return '<p class="mini-empty">' + esc(t('boardEmpty')) + '</p>';
    return '<ol class="mini-board">' + board.map(function (e, i) {
      return '<li><span class="mb-no">' + (i + 1) + '</span><span class="mb-nick">' + esc(e.n) + '</span><span class="mb-x">' + e.x + '</span></li>';
    }).join('') + '</ol>';
  }

  function renderSourcesPanel() {
    var srcs = allSources();
    return '<details class="archive">' +
      '<summary>' + esc(t('aboutData')) + '</summary>' +
      '<div class="archive-body">' +
      '<p class="archive-lead">' + esc(lang === 'ko'
        ? '이 사이트의 모든 장소에는 매체명·제목·게시일·링크 네 가지가 붙은 보도가 있습니다. 링크 없는 항목은 데이터에 넣지 않았습니다.'
        : 'Every place here carries a report with four things: outlet, title, publication date and link. Items without a link are not in the data at all.') + '</p>' +
      srcList(srcs) +
      '<h3>' + esc(lang === 'ko' ? '쓰는 방식' : 'How we write') + '</h3>' +
      '<ul class="rules">' +
      '<li>' + esc(lang === 'ko' ? '“다녀갔다”가 아니라 “보도됐다”로 씁니다. 기사가 말한 사실만 자기 문장으로 다시 씁니다.' : 'We write \u201creported\u201d, not \u201cconfirmed\u201d, and restate only the facts a report gives, in our own words.') + '</li>' +
      '<li>' + esc(lang === 'ko' ? '사진·로고·간판·지도 캡처를 쓰지 않습니다. 링크로만 보냅니다.' : 'No photos, logos, signboards or map screenshots. Links only.') + '</li>' +
      '<li>' + esc(lang === 'ko' ? '실시간 위치·동선·목격담은 다루지 않습니다.' : 'No live locations, itineraries or fan sightings.') + '</li>' +
      '<li>' + esc(lang === 'ko' ? '아티스트 이름을 서비스명·광고 문구에 쓰지 않습니다.' : 'Artist names are never used in the service name or ad copy.') + '</li>' +
      '<li>' + esc(lang === 'ko' ? '가게에 확인 전화·방문 요구·제휴를 요구하지 않습니다.' : 'We never ask a restaurant to confirm, host us or partner with us.') + '</li>' +
      '</ul>' +
      '<h3>' + esc(t('corrected')) + '</h3>' +
      '<p>' + esc(t('correctedBody')) + '</p>' +
      '<h3>' + esc(lang === 'ko' ? '데이터' : 'Data') + '</h3>' +
      '<p class="fine">people.json · places.json · questions.json · routes.json — ' +
      esc(lang === 'ko' ? '사람 ' + DATA.people.length + ' · 장소 ' + publishedPlaces().length + ' · 문제 ' + publishedQuestions().length + ' · 동선 ' + DATA.routes.length : DATA.people.length + ' people · ' + publishedPlaces().length + ' places · ' + publishedQuestions().length + ' questions · ' + DATA.routes.length + ' route') + '</p>' +
      '</div></details>';
  }

  /* ================= idols ================= */
  function renderIdols() {
    var launch = DATA.people.filter(function (p) { return p.launch; }).sort(function (a, b) { return a.order - b.order; });
    var extra = DATA.people.filter(function (p) { return !p.launch; }).sort(function (a, b) { return a.order - b.order; });
    function row(p) {
      var n = personName(p);
      var pl = placesOfPerson(p);
      var reps = reportsOfPerson(p);
      var meta = pl.length ? (lang === 'ko' ? '장소 ' + pl.length + '곳 · 보도 ' + reps.length + '건' : pl.length + ' place' + (pl.length > 1 ? 's' : '') + ' · ' + reps.length + ' report' + (reps.length > 1 ? 's' : '')) : t('comingSoonShort');
      return '<li class="row-item"><a class="row" href="#/idol/' + encodeURIComponent(p.id) + '">' +
        '<span class="row-main"><b>' + esc(n.main) + '</b><span class="row-sub">' + esc(n.sub) + '</span></span>' +
        '<span class="row-meta">' + esc(meta) + '</span>' +
        '</a></li>';
    }
    var html = '<header class="page-head"><a class="back" href="#/">← ' + esc(t('home')) + '</a>' +
      '<h1>' + esc(t('idolsTitle')) + '</h1><p class="lede">' + esc(t('idolsLede')) + '</p></header>' +
      '<h2 class="sec-title">' + esc(t('lineup')) + '</h2><ul class="rows">' + launch.map(row).join('') + '</ul>' +
      (extra.length ? '<h2 class="sec-title">' + esc(t('alsoReports')) + '</h2><ul class="rows">' + extra.map(row).join('') + '</ul>' : '');
    $('view-idols').innerHTML = html;
    setTitle(t('idolsTitle'));
    show('idols');
  }

  function renderIdol(id) {
    var p = BY.person[id];
    if (!p) return renderIdols();
    var n = personName(p);
    var pl = placesOfPerson(p);
    var reps = reportsOfPerson(p);
    var members = (p.members || []).map(function (m) { return lang === 'ko' ? m.name_ko : m.name_en; }).join(' · ');
    var html = '<header class="page-head">' +
      '<a class="back" href="#/idols">← ' + esc(t('idolsTitle')) + '</a>' +
      '<p class="eyebrow">' + esc(lang === 'ko' ? '아티스트' : 'ARTIST') + '</p>' +
      '<h1>' + esc(n.main) + '</h1>' +
      '<p class="page-sub">' + esc(n.sub) + (members ? ' · ' + esc(members) : '') + '</p>' +
      (pl.length ? pill(t(reps.length === 1 ? 'basedOn' : 'basedOnPlural', { n: reps.length }), 'ok') : pill(t('comingSoon'), 'soft')) +
      '<p class="lede">' + esc(pick(p, 'summary')) + '</p>' +
      '</header>';

    if (!pl.length) {
      html += '<section class="empty-card">' +
        '<p class="empty-icon" aria-hidden="true">🍽</p>' +
        '<h2>' + esc(t('comingSoonTitle')) + '</h2>' +
        '<p>' + esc(t('comingSoonBody')) + '</p>' +
        '<a class="btn" href="#/idols">' + esc(t('seeIdolsWithReports')) + '</a>' +
        '</section>';
      $('view-idol').innerHTML = html;
      setTitle(n.main);
      show('idol');
      return;
    }

    html += '<h2 class="sec-title">' + esc(t('reportedPlaces')) + '</h2><ul class="rows">' +
      pl.map(function (place) {
        var ev = (place.visitors || []).filter(function (v) { return v.person_id === p.id; })[0];
        return placeRow(place, ev ? ev.evidence : null);
      }).join('') + '</ul>';

    /* same neighbourhood, or another neighbourhood in the same district (Gangnam-gu etc.) */
    var ownAreas = areasOfPerson(p);
    var ownIds = {};
    var districts = {};
    ownAreas.forEach(function (a) { ownIds[a.id] = 1; districts[(a.district_en || '') + '|' + (a.district_ko || '')] = 1; });
    var otherPeople = {};
    DATA.areas.forEach(function (a) {
      var sameDistrict = districts[(a.district_en || '') + '|' + (a.district_ko || '')];
      if (!ownIds[a.id] && !sameDistrict) return;
      placesOfArea(a.id).forEach(function (place) {
        peopleOfPlace(place).forEach(function (op) { if (op.id !== p.id) otherPeople[op.id] = op; });
      });
    });
    var others = Object.keys(otherPeople).map(function (k) { return otherPeople[k]; });
    if (others.length) {
      html += '<h2 class="sec-title">' + esc(t('otherIdolsHere')) + '</h2><div class="chips">' +
        others.map(function (op) {
          var on = personName(op);
          var opArea = areasOfPerson(op)[0];
          return '<a class="chip" href="#/idol/' + encodeURIComponent(op.id) + '">' + esc(on.main) +
            (opArea ? '<span class="chip-tag">' + esc(areaName(opArea)) + '</span>' : '') + '</a>';
        }).join('') + '</div>';
    }

    html += '<h2 class="sec-title">' + esc(t('sources')) + '</h2>' + srcList(reps);
    $('view-idol').innerHTML = html;
    setTitle(n.main);
    show('idol');
  }

  /* ================= areas ================= */
  function renderAreas() {
    var areas = DATA.areas.filter(function (a) { return placesOfArea(a.id).length; });
    var html = '<header class="page-head"><a class="back" href="#/">← ' + esc(t('home')) + '</a>' +
      '<h1>' + esc(t('areasTitle')) + '</h1><p class="lede">' + esc(t('areasLede')) + '</p></header><ul class="rows">' +
      areas.map(function (a) {
        var pls = placesOfArea(a.id);
        return '<li class="row-item"><a class="row" href="#/area/' + encodeURIComponent(a.id) + '">' +
          '<span class="row-main"><b>' + esc(areaName(a)) + '</b><span class="row-sub">' + esc(areaDistrict(a)) + '</span></span>' +
          '<span class="row-meta">' + esc(pcount(pls.length)) + '</span>' +
          '<span class="row-note">' + esc(pls.map(function (pl) { return placeName(pl).main; }).join(' · ')) + '</span>' +
          '</a></li>';
      }).join('') + '</ul>';
    $('view-areas').innerHTML = html;
    setTitle(t('areasTitle'));
    show('areas');
  }

  function renderArea(id) {
    var a = BY.area[id];
    if (!a) return renderAreas();
    var pls = placesOfArea(id);
    var routes = DATA.routes.filter(function (r) { return (r.area_ids || []).indexOf(id) >= 0; });
    var html = '<header class="page-head"><a class="back" href="#/areas">← ' + esc(t('areasTitle')) + '</a>' +
      '<p class="eyebrow">' + esc(areaDistrict(a)) + '</p><h1>' + esc(areaName(a)) + '</h1>' +
      '<p class="page-sub">' + esc(pcount(pls.length)) + '</p></header>' +
      '<h2 class="sec-title">' + esc(t('areaPlaces')) + '</h2>' +
      (pls.length ? '<ul class="rows">' + pls.map(function (pl) {
        var ev = (pl.visitors || [])[0];
        return placeRow(pl, ev ? ev.evidence : null);
      }).join('') + '</ul>' : '<p class="empty">' + esc(t('areaEmpty')) + '</p>');
    if (routes.length) {
      html += '<h2 class="sec-title">' + esc(t('routesTitle')) + '</h2><ul class="rows">' + routes.map(function (r) {
        var legs = routeLegs(r);
        return '<li class="row-item"><a class="row" href="#/route/' + encodeURIComponent(r.id) + '">' +
          '<span class="row-main"><b>' + esc(pick(r, 'title')) + '</b></span>' +
          '<span class="row-meta">' + esc(t('routeStops', { n: legs.stops.length })) + '</span>' +
          '<span class="row-note">' + esc(t('routeWalk', { km: legs.km.toFixed(1), min: legs.min })) + '</span>' +
          '</a></li>';
      }).join('') + '</ul>';
    }
    $('view-area').innerHTML = html;
    setTitle(areaName(a));
    show('area');
  }

  /* ================= place ================= */
  function renderPlace(id) {
    var place = BY.place[id];
    if (!place) return renderAreas();
    var n = placeName(place);
    var area = BY.area[place.area_id];
    var visitors = peopleOfPlace(place);
    var order = place.what_ordered || [];
    var routes = (place.route_ids || []).map(function (rid) { return BY.route[rid]; }).filter(Boolean);
    var coords = place.lat.toFixed(4) + ', ' + place.lng.toFixed(4);

    var html = '<header class="page-head">' +
      '<a class="back" href="' + (area ? '#/area/' + encodeURIComponent(area.id) : '#/areas') + '">← ' + esc(area ? areaName(area) : t('areasTitle')) + '</a>' +
      '<p class="eyebrow">' + esc(pick(place, 'category')) + '</p>' +
      '<h1>' + esc(n.main) + '</h1>' +
      '<p class="page-sub">' + esc(n.sub) + (area ? ' · <a href="#/area/' + encodeURIComponent(area.id) + '">' + esc(areaName(area)) + ', ' + esc(areaDistrict(area)) + '</a>' : '') + '</p>' +
      pill(t('reportedNotConfirmed'), 'warn') +
      '</header>';

    html += '<section class="block"><h2 class="block-title">' + esc(pick(place, 'menu_label') || t('whatTheyOrdered')) + '</h2>' +
      '<ul class="order-list">' + order.map(function (m) {
        return '<li><b>' + esc(lang === 'ko' ? m.ko : m.en) + '</b><span>' + esc(lang === 'ko' ? m.en : m.ko) + '</span></li>';
      }).join('') + '</ul></section>';

    if (visitors.length) {
      html += '<section class="block"><h2 class="block-title">' + esc(t('whoWent')) + '</h2><div class="chips">' +
        visitors.map(function (v) {
          var vn = personName(v);
          var ev = (place.visitors || []).filter(function (x) { return x.person_id === v.id; })[0];
          return '<a class="chip" href="#/idol/' + encodeURIComponent(v.id) + '">' + esc(vn.main) +
            '<span class="chip-tag">' + esc(ev && ev.evidence === 'menu' ? t('menReported') : t('mentionOnly')) + '</span></a>';
        }).join('') + '</div></section>';
    }

    html += '<section class="block"><h2 class="block-title">' + esc(t('reportSays')) + '</h2>' +
      '<p class="body-text">' + esc(pick(place, 'report_note')) + '</p></section>';

    html += '<section class="block"><h2 class="block-title">' + esc(t('hours')) + '</h2>' +
      '<p class="body-text">' + (place.hours ? esc(place.hours) : esc(t('hoursUnknown'))) + '</p>' +
      '<p class="fine">' + esc(t('hoursChecked', { d: place.hours_checked || '' })) + '</p></section>';

    html += '<section class="block"><h2 class="block-title">' + esc(t('findIt')) + '</h2>' +
      '<div class="copy-grid">' +
      '<div class="copy-row"><span class="copy-label">' + esc(t('koreanAddress')) + '</span>' +
      '<span class="copy-value">' + esc(place.address_ko) + '</span>' + copyBtn(place.address_ko, t('copy')) + '</div>' +
      '<div class="copy-row"><span class="copy-label">' + esc(t('englishAddress')) + '</span>' +
      '<span class="copy-value">' + esc(place.address_en) + '</span>' + copyBtn(place.address_en, t('copy')) + '</div>' +
      '<div class="copy-row"><span class="copy-label">' + esc(t('coordinates')) + '</span>' +
      '<span class="copy-value mono">' + esc(coords) + '</span>' + copyBtn(coords, t('copy')) + '</div>' +
      '</div>' +
      (place.address_en_status === 'romanized' ? '<p class="fine">' + esc(t('romanizedNote')) + '</p>' : '') +
      '<div class="map-links">' +
      '<a class="btn" href="' + esc(googleMapsUrl(place)) + '" target="_blank" rel="noopener">' + esc(t('openGoogle')) + '</a>' +
      '<a class="btn" href="' + esc(naverMapsUrl(place)) + '" target="_blank" rel="noopener">' + esc(t('openNaver')) + '</a>' +
      '</div>' +
      '<p class="fine">' + esc(place.coord_source || '') + '</p></section>';

    if (routes.length) {
      html += '<section class="block"><h2 class="block-title">' + esc(t('onTheRoute')) + '</h2><ul class="rows">' +
        routes.map(function (r) {
          var legs = routeLegs(r);
          return '<li class="row-item"><a class="row" href="#/route/' + encodeURIComponent(r.id) + '">' +
            '<span class="row-main"><b>' + esc(pick(r, 'title')) + '</b></span>' +
            '<span class="row-meta">' + esc(t('routeWalk', { km: legs.km.toFixed(1), min: legs.min })) + '</span></a></li>';
        }).join('') + '</ul></section>';
    }

    html += '<section class="block"><h2 class="block-title">' + esc(t('sources')) + '</h2>' + srcList(reportsOfPlace(place)) +
      '<p class="fine">' + esc(t('noPhotos')) + '</p></section>';

    $('view-place').innerHTML = html;
    setTitle(n.main);
    show('place');
  }

  /* ================= routes ================= */
  function renderRoutes() {
    var routes = DATA.routes.filter(function (r) { return r.status === 'published'; });
    var html = '<header class="page-head"><a class="back" href="#/">← ' + esc(t('home')) + '</a>' +
      '<h1>' + esc(t('routesTitle')) + '</h1><p class="lede">' + esc(t('routesLede')) + '</p></header>';
    html += '<ul class="rows">' + routes.map(function (r) {
      var legs = routeLegs(r);
      return '<li class="row-item"><a class="row" href="#/route/' + encodeURIComponent(r.id) + '">' +
        '<span class="row-main"><b>' + esc(pick(r, 'title')) + '</b><span class="row-sub">' + esc(pick(r, 'intro')) + '</span></span>' +
        '<span class="row-meta">' + esc(t('routeStops', { n: legs.stops.length })) + '</span>' +
        '<span class="row-note">' + esc(t('routeWalk', { km: legs.km.toFixed(1), min: legs.min })) + '</span>' +
        '</a></li>';
    }).join('') + '</ul>' +
      '<p class="fine">' + esc(t('routeEstimate')) + '</p>';
    $('view-routes').innerHTML = html;
    setTitle(t('routesTitle'));
    show('routes');
  }

  function routeText(route) {
    var legs = routeLegs(route);
    var lines = [pick(route, 'title'), ''];
    legs.stops.forEach(function (s, i) {
      var place = BY.place[s.place_id];
      if (!place) return;
      lines.push((i + 1) + '. ' + place.name_en + ' (' + place.name_ko + ')');
      lines.push('   ' + place.address_ko);
      lines.push('   ' + place.address_en);
      lines.push('   ' + place.lat + ', ' + place.lng);
      lines.push('   ' + googleMapsUrl(place));
      if (s.order && legs.legs[i]) lines.push('   ↓ ' + t('routeWalk', { km: legs.legs[i].km.toFixed(1), min: legs.legs[i].min }));
    });
    return lines.join('\n');
  }

  function renderRoute(id) {
    var route = BY.route[id];
    if (!route) return renderRoutes();
    var legs = routeLegs(route);
    var html = '<header class="page-head"><a class="back" href="#/routes">← ' + esc(t('routesTitle')) + '</a>' +
      '<h1>' + esc(pick(route, 'title')) + '</h1>' +
      '<p class="lede">' + esc(pick(route, 'intro')) + '</p>' +
      '<p class="route-figures">' + esc(t('routeStops', { n: legs.stops.length })) + ' · ' + esc(t('routeWalk', { km: legs.km.toFixed(1), min: legs.min })) + '</p>' +
      '</header>' +
      '<div class="card-actions"><button class="btn primary" type="button" data-copy-key="' + copyKey(routeText(route)) + '">' + esc(t('routeCopy')) + '</button></div>' +
      '<ol class="stops">' + legs.stops.map(function (s, i) {
        var place = BY.place[s.place_id];
        if (!place) return '';
        var pn = placeName(place);
        var leg = legs.legs[i];
        return '<li class="stop">' +
          '<div class="stop-head"><span class="stop-no">' + (i + 1) + '</span><div class="stop-title"><b>' + esc(pn.main) + '</b><span>' + esc(pn.sub) + '</span></div></div>' +
          '<p class="stop-note">' + esc(pick(s, 'note')) + '</p>' +
          '<p class="stop-addr">' + esc(place.address_ko) + ' · <span class="mono">' + place.lat + ', ' + place.lng + '</span></p>' +
          '<div class="stop-actions">' +
          '<a class="btn ghost sm" href="#/place/' + encodeURIComponent(place.id) + '">' + esc(t('openPlace')) + '</a>' +
          '<a class="btn ghost sm" href="' + esc(googleMapsUrl(place)) + '" target="_blank" rel="noopener">' + esc(t('openGoogle')) + '</a>' +
          '</div>' +
          (leg ? '<p class="stop-leg">↓ ' + esc(t('routeWalk', { km: leg.km.toFixed(1), min: leg.min })) + '</p>' : '') +
          '</li>';
      }).join('') + '</ol>' +
      '<p class="fine">' + esc(t('routeEstimate')) + '</p>';
    $('view-route').innerHTML = html;
    setTitle(pick(route, 'title'));
    show('route');
  }

  /* ================= quiz ================= */
  function startSession(ids, mode, label) {
    session = { ids: ids, i: 0, answers: [], mode: mode, label: label, at: Date.now() };
    save(STORE.session, session);
    renderQuiz();
  }
  function startDaily() {
    var ids = dailyIds();
    startSession(ids, 'daily', t('todaysSet'));
  }
  function startRandom() {
    var pool = publishedQuestions().map(function (q) { return q.id; });
    var ids = shuffle(pool).slice(0, Math.min(CFG.dailySize || 10, pool.length));
    startSession(ids, 'random', t('randomSet'));
  }
  function currentQuestion() { return session && session.ids[session.i] ? BY.question[session.ids[session.i]] : null; }

  function renderQuiz() {
    if (!session) { startRandom(); return; }
    var q = currentQuestion();
    if (!q) { renderResult(); return; }
    var answered = session.answers.filter(function (a) { return a.qid === q.id; })[0];
    var score = session.answers.filter(function (a) { return a.ok; }).length;
    var person = BY.person[q.person_id];
    var pn = person ? personName(person) : { main: '', sub: '' };
    var typeLabel = { A: t('typeA'), B: t('typeB'), C: t('typeC') }[q.type] || '';
    var choices = (lang === 'ko' ? q.choices_ko : q.choices_en) || q.choices_en || [];
    var otherQ = other(q, 'question');

    var html = '<header class="quiz-bar">' +
      '<button class="icon-btn" type="button" data-action="leave-quiz" aria-label="' + esc(t('leaveQuiz')) + '">←</button>' +
      '<div class="bar-progress"><b>' + esc(t('quizQuestion', { i: session.i + 1, n: session.ids.length })) + '</b>' +
      '<span>' + esc(session.label || '') + '</span></div>' +
      '<button class="icon-btn lang-btn" type="button" data-action="lang" aria-label="' + esc(lang === 'ko' ? 'View in English' : '한국어로 보기') + '" title="' + esc(lang === 'ko' ? 'English' : '한국어') + '">' + esc(lang === 'ko' ? 'EN' : 'KO') + '</button>' +
      '<span class="score-pill">' + score + '</span>' +
      '</header>' +
      '<div class="q-meta">' +
      '<span class="q-type">' + esc(typeLabel) + '</span>' +
      (pn.main ? '<span class="q-person">' + esc(pn.main) + '</span>' : '') +
      '</div>' +
      '<h1 class="q-text">' + esc(pick(q, 'question')) + '</h1>' +
      '<p class="q-text-other">' + esc(otherQ) + '</p>' +
      '<div class="choices" id="choices" role="group" aria-label="' + esc(pick(q, 'question')) + '">' +
      choices.map(function (c, i) {
        return '<button class="choice" type="button" data-choice="' + i + '">' +
          '<span class="mark">' + LETTERS[i] + '</span><span class="ctext">' + esc(c) + '</span><span class="icon" aria-hidden="true"></span></button>';
      }).join('') + '</div>' +
      '<div id="feedback" class="feedback" hidden></div>' +
      '<div class="quiz-foot">' +
      '<button class="btn primary big" type="button" id="btnCheck" disabled>' + esc(t('checkAnswer')) + '</button>' +
      '<button class="btn primary big" type="button" id="btnNext" hidden>' + esc(t('nextQuestion')) + '</button>' +
      '</div>';

    $('view-quiz').innerHTML = html;
    setTitle(t('navQuiz'));
    show('quiz');

    var picked = null;
    var box = $('choices');
    Array.prototype.forEach.call(box.querySelectorAll('[data-choice]'), function (btn) {
      btn.addEventListener('click', function () {
        if (box.getAttribute('data-locked')) return;
        picked = parseInt(btn.getAttribute('data-choice'), 10);
        Array.prototype.forEach.call(box.children, function (c, i) { c.classList.toggle('sel', i === picked); });
        $('btnCheck').disabled = false;
      });
    });
    if (answered) applyAnswer(q, box, answered.pick, answered.ok, false);
    else {
      $('btnCheck').addEventListener('click', function () {
        if (picked === null) return;
        var ok = picked === q.answer;
        session.answers.push({ qid: q.id, pick: picked, ok: ok, at: Date.now() });
        progress[q.id] = { ok: ok, at: Date.now() };
        save(STORE.progress, progress);
        save(STORE.session, session);
        applyAnswer(q, box, picked, ok, true);
      });
    }
  }

  function applyAnswer(q, box, chosen, ok, fresh) {
    box.setAttribute('data-locked', '1');
    Array.prototype.forEach.call(box.children, function (c, i) {
      c.classList.add('locked');
      c.classList.remove('sel');
      if (i === q.answer) { c.classList.add('correct'); c.querySelector('.icon').textContent = '✓'; }
      if (i === chosen && chosen !== q.answer) { c.classList.add('wrong'); c.querySelector('.icon').textContent = '✕'; }
    });
    var check = $('btnCheck');
    if (check) check.hidden = true;
    var next = $('btnNext');
    next.hidden = false;
    next.textContent = session.i + 1 < session.ids.length ? t('nextQuestion') : t('seeResult');
    next.onclick = nextQuestion;
    var place = BY.place[q.place_id];
    var pn = place ? placeName(place) : null;
    var route = q.route_id ? BY.route[q.route_id] : null;
    var fb = $('feedback');
    fb.hidden = false;
    fb.innerHTML =
      '<div class="verdict ' + (ok ? 'ok' : 'bad') + '">' +
      '<span class="vicon" aria-hidden="true">' + (ok ? '✓' : '✕') + '</span>' +
      '<span class="vtext">' + esc(ok ? t('correct') : t('wrong')) + '</span>' +
      (!ok ? '<span class="vpick">' + esc(t('answerWas', { a: (lang === 'ko' ? q.choices_ko : q.choices_en)[q.answer] })) + '</span>' : '') +
      '</div>' +
      '<div class="explain">' +
      '<p class="ex-head">' + esc(t('explanation')) + '</p>' +
      '<p class="ex-body">' + esc(pick(q, 'note')) + '</p>' +
      (place ? '<div class="ex-place">' +
        '<p class="ex-place-head"><b>' + esc(pn.main) + '</b> <span>' + esc(pn.sub) + '</span></p>' +
        (place.what_ordered || []).map(function (m) { return '<p class="ex-menu">· ' + esc(lang === 'ko' ? m.ko : m.en) + '</p>'; }).join('') +
        '<div class="card-actions">' +
        '<a class="btn ghost sm" href="#/place/' + encodeURIComponent(place.id) + '">' + esc(t('openPlacePage')) + '</a>' +
        (route ? '<a class="btn ghost sm" href="#/route/' + encodeURIComponent(route.id) + '">' + esc(t('openRoutePage')) + '</a>' : '') +
        '</div></div>' : '') +
      '<div class="ex-src">' + srcList(q.sources || []) + '</div>' +
      '</div>' +
      '<p class="score-line">' + esc(t('scoreLabel')) + ': ' + session.answers.filter(function (a) { return a.ok; }).length + ' / ' + session.answers.length + '</p>';
    var pillEl = document.querySelector('.score-pill');
    if (pillEl) pillEl.textContent = session.answers.filter(function (a) { return a.ok; }).length;
    if (fresh) {
      celebrate(fb);
      if (ok) afterCorrect();
    }
  }

  function nextQuestion() {
    if (!session) return renderHome();
    session.i += 1;
    save(STORE.session, session);
    if (session.i >= session.ids.length) renderResult();
    else renderQuiz();
  }

  function celebrate(el) {
    if (reduced() || !el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function afterCorrect() {
    giveBadge('first');
  }

  /* Returns true only the first time a badge is earned. */
  function giveBadge(id, silent) {
    if (game.badges[id]) return false;
    game.badges[id] = todayKey();
    saveGame();
    if (!silent) {
      var def = badgeDefs().filter(function (b) { return b.id === id; })[0];
      if (def) toast(def.icon + ' ' + (lang === 'ko' ? def.ko : def.en) + ' — ' + (lang === 'ko' ? '새 배지' : 'new badge'));
    }
    return true;
  }

  /* ================= result ================= */
  function earnedBlock(outcome) {
    if (!outcome) return '';
    var parts = [];
    if (outcome.levelUp) {
      parts.push('<p class="earned-line"><span class="earned-k">' + esc(lang === 'ko' ? '레벨 업' : 'LEVEL UP') + '</span> ' + esc(outcome.levelUp.name) + '</p>');
    }
    (outcome.earned || []).forEach(function (id) {
      var def = badgeDefs().filter(function (b) { return b.id === id; })[0];
      if (def) parts.push('<p class="earned-line"><span class="earned-k">' + esc(lang === 'ko' ? '새 배지' : 'NEW BADGE') + '</span> ' + def.icon + ' ' + esc(lang === 'ko' ? def.ko : def.en) + '</p>');
    });
    return parts.length ? '<div class="earned">' + parts.join('') + '</div>' : '';
  }

  function renderResult() {
    if (!session) return renderHome();
    var answers = session.answers;
    var total = answers.length;
    var right = answers.filter(function (a) { return a.ok; }).length;
    var pct = total ? Math.round((right / total) * 100) : 0;
    var msg = pct === 100 ? t('msgPerfect') : pct >= 60 ? t('msgGood') : t('msgLow');
    var outcome = finishSession(right, total);
    var wrong = answers.filter(function (a) { return !a.ok; });

    var html = '<header class="result-hero">' +
      '<p class="eyebrow">' + esc(t('resultTitle')) + '</p>' +
      '<div class="score-ring"><b>' + right + ' / ' + total + '</b><span>' + pct + '%</span></div>' +
      '<p class="result-msg">' + esc(msg) + '</p>' +
      '<p class="fine">' + esc(session.label || '') + '</p>' +
      earnedBlock(outcome) +
      '</header>' +
      '<div class="result-actions">' +
      '<button class="btn primary" type="button" data-action="play-random">' + esc(t('playAgain', { n: Math.min(CFG.dailySize || 10, publishedQuestions().length) })) + '</button>' +
      '<a class="btn" href="#/">' + esc(t('home')) + '</a>' +
      '</div>' +
      '<h2 class="sec-title">' + esc(t('wrongList')) + '</h2>' +
      (wrong.length ? '<ul class="rows">' + wrong.map(function (a) {
        var q = BY.question[a.qid];
        if (!q) return '';
        var place = BY.place[q.place_id];
        var pn = place ? placeName(place) : { main: '', sub: '' };
        return '<li class="row-item"><a class="row" href="' + (place ? '#/place/' + encodeURIComponent(place.id) : '#/idols') + '">' +
          '<span class="row-main"><b>' + esc(pn.main) + '</b><span class="row-sub">' + esc(pick(q, 'question')) + '</span></span>' +
          '<span class="row-meta">' + esc(t('openPlace')) + ' →</span></a></li>';
      }).join('') + '</ul>' : '<p class="empty">' + esc(lang === 'ko' ? '틀린 문제가 없습니다.' : 'Nothing missed.') + '</p>');

    $('view-result').innerHTML = html;
    setTitle(t('resultTitle'));
    show('result');
    save(STORE.session, null);
    session = null;
  }

  function finishSession(right, total) {
    var before = levelOf();
    var earned = [];
    if (session.mode === 'daily') {
      if (game.daily) game.daily.done = true;
      var key = todayKey();
      if (game.streak.last !== key) {
        game.streak.days = (game.streak.last === yesterdayKey() ? (game.streak.days || 0) + 1 : 1);
        game.streak.last = key;
        if (game.streak.days > (game.streak.best || 0)) game.streak.best = game.streak.days;
      }
      if ((game.streak.days || 0) >= 7 && giveBadge('streak7', true)) earned.push('streak7');
      if ((game.streak.days || 0) >= 30 && giveBadge('streak30', true)) earned.push('streak30');
    }
    if (total >= 10 && right === total && giveBadge('perfect', true)) earned.push('perfect');
    var bank = publishedQuestions();
    if (bank.length && bank.every(function (q) { return progress[q.id]; }) && giveBadge('allq', true)) earned.push('allq');
    saveGame();
    var after = levelOf();
    return { earned: earned, levelUp: after.i > before.i ? after : null };
  }

  /* ================= me ================= */
  function renderMe(opts) {
    var lv = levelOf();
    var st = game.streak || { days: 0, best: 0 };
    var badges = badgeDefs();
    var html = '<header class="page-head"><a class="back" href="#/">← ' + esc(t('home')) + '</a>' +
      '<h1>' + esc(t('meTitle')) + '</h1></header>' +
      '<section class="block"><p class="block-title">' + esc(t('levelLabel')) + '</p>' +
      '<p class="me-level">' + esc(lv.name) + '</p>' +
      '<div class="level-bar" role="img" aria-label="' + esc(lv.name) + '"><span style="width:' + levelPct() + '%"></span></div>' +
      '<p class="rank-next">' + esc(lv.next ? t('nextLevel', { n: lv.need, next: lv.next }) : t('topLevel', { xp: lv.xp })) + '</p>' +
      '<p class="rank-streak">' + esc(st.days ? t('streakLine', { d: st.days, b: st.best || 0 }) : t('streakNone')) + '</p></section>' +
      '<section class="block"><h2 class="block-title">' + esc(t('badgeTitle')) + '</h2><div class="badge-grid">' +
      badges.map(function (b) {
        var got = !!game.badges[b.id];
        return '<div class="badge' + (got ? ' got' : '') + '"><span class="badge-icon" aria-hidden="true">' + (got ? b.icon : '·') + '</span>' +
          '<span class="badge-name">' + esc(lang === 'ko' ? b.ko : b.en) + '</span>' +
          '<span class="badge-date">' + esc(got ? game.badges[b.id] : t('notEarned')) + '</span></div>';
      }).join('') + '</div></section>' +

      '<section class="block rank-block"><h2 class="block-title">' + esc(t('rankTitle')) + '</h2>' +
      '<p class="body-text">' + esc(t('rankExplain')) + '</p>' +
      '<label class="field-label" for="nickInput">' + esc(t('nickname')) + '</label>' +
      '<input id="nickInput" class="field" type="text" maxlength="14" autocomplete="off" placeholder="' + esc(t('nickPlaceholder')) + '" value="' + esc(game.rank.nick || '') + '">' +
      '<div class="card-actions"><button class="btn" type="button" data-action="make-code">' + esc(t('makeCode')) + '</button>' +
      '<button class="btn ghost" type="button" data-action="copy-made">' + esc(t('copyCode')) + '</button></div>' +
      '<textarea id="codeBox" class="code-box" rows="3" readonly aria-label="' + esc(t('rankTitle')) + '"></textarea>' +
      '<label class="field-label" for="pasteBox">' + esc(t('pasteLabel')) + '</label>' +
      '<textarea id="pasteBox" class="code-box" rows="3" placeholder="' + esc(t('pastePlaceholder')) + '"></textarea>' +
      '<div class="card-actions"><button class="btn ghost" type="button" data-action="add-codes">' + esc(t('addToBoard')) + '</button></div>' +
      '<div id="board" class="board"></div>' +
      '<p class="fine">' + esc(t('boardNote')) + '</p></section>' +

      '<section class="block"><h2 class="block-title">' + esc(t('resetTitle')) + '</h2>' +
      '<p class="body-text">' + esc(t('resetBody')) + '</p>' +
      '<button class="btn ghost danger" type="button" data-action="reset">' + esc(t('reset')) + '</button></section>';

    $('view-me').innerHTML = html;
    setTitle(t('meTitle'));
    renderBoard();
    show('me');
    if (opts && opts.focus === 'paste') { var el = $('pasteBox'); if (el) el.focus(); }
    if (opts && opts.focus === 'nick') { var el2 = $('nickInput'); if (el2) el2.focus(); }
  }

  function renderBoard() {
    var box = $('board');
    if (!box) return;
    var board = (game.rank.board || []).slice().sort(function (a, b) { return b.x - a.x; }).slice(0, 20);
    if (!board.length) { box.innerHTML = '<p class="mini-empty">' + esc(t('boardEmpty')) + '</p>'; return; }
    box.innerHTML = '<ol class="mini-board">' + board.map(function (e, i) {
      return '<li><span class="mb-no">' + (i + 1) + '</span><span class="mb-nick">' + esc(e.n) + '</span>' +
        '<span class="mb-lv">' + esc(e.l || '') + '</span><span class="mb-x">' + e.x + '</span></li>';
    }).join('') + '</ol>';
  }

  function buildCode(nick) {
    var lv = levelOf();
    var payload = { n: nick, x: xpOf(), q: Object.keys(progress).length, l: lv.name, d: todayKey() };
    return (CFG.rankCodePrefix || 'IDOLTABLE1.') + encodeURIComponent(JSON.stringify(payload));
  }

  function makeCode() {
    var nick = (($('nickInput') && $('nickInput').value) || '').trim() || (lang === 'ko' ? '이름없음' : 'No name');
    game.rank.nick = nick;
    saveGame();
    var code = buildCode(nick);
    var box = $('codeBox');
    if (box) box.value = code;
    return code;
  }

  function copyMade() {
    var box = $('codeBox');
    var code = (box && box.value) || makeCode();
    doCopy(code);
    toast(t('codeMade'));
  }

  function addCodes() {
    var raw = ($('pasteBox') && $('pasteBox').value) || '';
    var lines = raw.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var prefix = CFG.rankCodePrefix || 'IDOLTABLE1.';
    var added = 0;
    lines.forEach(function (line) {
      var body = line.indexOf(prefix) === 0 ? line.slice(prefix.length) : line;
      try {
        var o = JSON.parse(decodeURIComponent(body));
        if (!o || !o.n) return;
        if (game.rank.board.some(function (e) { return e.n === o.n && e.d === o.d; })) return;
        game.rank.board.push({ n: String(o.n).slice(0, 14), x: Number(o.x) || 0, q: Number(o.q) || 0, l: String(o.l || ''), d: String(o.d || '') });
        added++;
      } catch (e) {}
    });
    saveGame();
    if ($('pasteBox')) $('pasteBox').value = '';
    renderBoard();
    toast(added ? t('addedCodes', { n: added }) : t('badCode'));
  }

  function resetAll() {
    progress = {};
    game = { daily: null, badges: {}, streak: { last: '', days: 0, best: 0 }, rank: { nick: '', board: [] } };
    try { localStorage.removeItem(STORE.progress); localStorage.removeItem(STORE.session); localStorage.removeItem(STORE.game); } catch (e) {}
    session = null;
    toast(t('resetDone'));
    renderMe();
  }

  /* ================= copy + toast ================= */
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function doCopy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(t('copied')); }).catch(function () {
        toast(fallbackCopy(text) ? t('copied') : t('copyFailed'));
      });
    } else {
      toast(fallbackCopy(text) ? t('copied') : t('copyFailed'));
    }
  }
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ================= routing ================= */
  function parseHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    var qs = '';
    var qi = raw.indexOf('?');
    if (qi >= 0) { qs = raw.slice(qi + 1); raw = raw.slice(0, qi); }
    var parts = raw.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    var params = {};
    qs.split('&').filter(Boolean).forEach(function (kv) { var a = kv.split('='); params[a[0]] = a[1] || '1'; });
    return { name: parts[0] || 'home', id: parts[1] || null, params: params };
  }

  function route() {
    var r = parseHash();
    if (r.name === 'home') return renderHome();
    if (r.name === 'idols') return renderIdols();
    if (r.name === 'idol') return renderIdol(r.id);
    if (r.name === 'areas') return renderAreas();
    if (r.name === 'area') return renderArea(r.id);
    if (r.name === 'place') return renderPlace(r.id);
    if (r.name === 'routes') return renderRoutes();
    if (r.name === 'route') return renderRoute(r.id);
    if (r.name === 'quiz') { if (session) renderQuiz(); else startDaily(); return; }
    if (r.name === 'me') return renderMe({ focus: r.params.paste ? 'paste' : (r.params.nick ? 'nick' : '') });
    return renderHome();
  }

  /* ================= events ================= */
  document.addEventListener('click', function (e) {
    var copyEl = e.target.closest('[data-copy-key]');
    if (copyEl) {
      e.preventDefault();
      var key = copyEl.getAttribute('data-copy-key');
      if (COPY[key]) doCopy(COPY[key]);
      return;
    }
    var goEl = e.target.closest('[data-go]');
    if (goEl) {
      e.preventDefault();
      location.hash = goEl.getAttribute('data-go').replace(/^#/, '');
      if (!location.hash) route();
      return;
    }
    var act = e.target.closest('[data-action]');
    if (!act) return;
    var a = act.getAttribute('data-action');
    if (a === 'play-daily') { startDaily(); }
    else if (a === 'play-random') { startRandom(); }
    else if (a === 'resume') {
      var saved = savedSession();
      if (saved) { session = saved; renderQuiz(); } else renderHome();
    }
    else if (a === 'leave-quiz') {
      if (session) save(STORE.session, session);
      location.hash = '#/';
      renderHome();
    }
    else if (a === 'lang') {
      lang = lang === 'ko' ? 'en' : 'ko';
      save(STORE.lang, lang);
      setTitle('');
      route();
    }
    else if (a === 'copy-code') {
      if (!game.rank.nick) { location.hash = '#/me?nick=1'; renderMe({ focus: 'nick' }); toast(t('nickname')); return; }
      doCopy(buildCode(game.rank.nick));
    }
    else if (a === 'make-code') { makeCode(); toast(t('codeMade')); }
    else if (a === 'copy-made') { copyMade(); }
    else if (a === 'add-codes') { addCodes(); }
    else if (a === 'reset') { resetAll(); }
  });

  var lt = $('langToggle');
  if (lt) lt.addEventListener('click', function () {
    lang = lang === 'ko' ? 'en' : 'ko';
    save(STORE.lang, lang);
    setTitle('');
    route();
  });

  window.addEventListener('hashchange', route);

  /* ================= boot ================= */
  function fail(msg) {
    var el = $('loadError');
    if (!el) return;
    el.hidden = false;
    el.textContent = t('errorLoad') + ' (' + msg + ')';
  }
  function fetchJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' HTTP ' + r.status);
      return r.json();
    });
  }

  /* the tab title and brand come from config.js, before the data even loads */
  setTitle('');

  Promise.all([fetchJson('data/people.json'), fetchJson('data/places.json'), fetchJson('data/questions.json'), fetchJson('data/routes.json')])
    .then(function (res) {
      DATA.people = (res[0].people || []).slice();
      DATA.places = (res[1].places || []).slice();
      DATA.areas = (res[1].areas || []).slice();
      DATA.questions = (res[2].questions || []).slice();
      DATA.routes = (res[3].routes || []).slice();
      index();
      setTitle('');
      route();
    })
    .catch(function (err) { fail(err && err.message ? err.message : String(err)); });
})();
