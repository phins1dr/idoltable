/* ============================================================
   Idol Quiz — K-pop 팬덤 대항 덕력고사 (v5)
   ------------------------------------------------------------
   중심 컨셉 : 내 응원 그룹을 골라 정답마다 팀에 점수를 쌓고,
              주간 그룹 순위표에서 팬덤끼리 겨룬다.
   · 난이도 3단계 : 쉬움 1점 / 보통 2점 / 덕후 3점 (정답 1개당)
   · 매일 새 문제  : Asia/Seoul 날짜 시드 → 하루 동안 같은 세트
   · 1:1 도전장    : 결과 링크에 점수·팀·난이도·날짜시드를 실어 팀 대항
   · 주간 리그     : 결과 코드(KPOP.시즌.난이도.점수/최대.연속.팀.닉)를 모아
                    그룹 합산 점수 순위표를 그림
   서버 없음 · 로그인 없음 · localStorage + URL 파라미터만 사용
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'idolquiz_v5_save';
  var SITE_URL = 'https://phins1dr.github.io/idoltable/';
  var DAY_MS = 86400000;
  var KST_MS = 9 * 3600000;
  var MAX_CODES = 30;

  /* 실시간 랭킹 — 럭비 퀴즈와 같은 Firebase 프로젝트, 컬렉션은 idol_ 접두사만 사용 */
  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyC7XmqS9j4qzqKHZgkeF6m6GhZacFDXUBU',
    authDomain: 'wr-quiz-fceaa.firebaseapp.com',
    projectId: 'wr-quiz-fceaa',
    storageBucket: 'wr-quiz-fceaa.firebasestorage.app',
    messagingSenderId: '71974210293',
    appId: '1:71974210293:web:f0da4eb94d73427e0213bc'
  };
  var SDK_URL = {
    app: 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js',
    auth: 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js',
    fs: 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js'
  };
  var LIVE = {
    status: 'idle', reason: '', scores: [], uid: null, db: null,
    season: '', unsub: null, mineExists: false, tried: false
  };

  /* 팬덤 후보 — 퀴즈 데이터의 그룹 + 많이 찾는 그룹. 목록에 없으면 직접 입력 */
  var TEAM_PRESETS = [
    { key: 'bts', name: 'BTS', icon: '💜' },
    { key: 'seventeen', name: '세븐틴', icon: '💎' },
    { key: 'straykids', name: '스트레이키즈', icon: '⚡' },
    { key: 'rescene', name: '리센느', icon: '🌹' },
    { key: 'newjeans', name: '뉴진스', icon: '🐰' },
    { key: 'blackpink', name: '블랙핑크', icon: '🖤' },
    { key: 'enhypen', name: '엔하이픈', icon: '🌙' }
  ];

  /* 난이도 — 정답 1개당 점수 가중치 */
  var LEVELS = [
    { id: 1, name: '쉬움', icon: '🌱', weight: 1, desc: '대표곡·가사 도입부·기본 프로필' },
    { id: 2, name: '보통', icon: '🎧', weight: 2, desc: '타이틀곡·방송 장면·유닛' },
    { id: 3, name: '덕후', icon: '👑', weight: 3, desc: 'B면·자체 예능 TMI·기록 디테일' }
  ];

  var DATA = null;
  var pendingStart = null;
  var boardDiff = 0;   /* 0 = 전체(난이도 합산), 1~3 = 해당 난이도만 */

  var state = {
    view: 'home',
    mode: 'all',
    level: 2,
    dateKey: '',
    team: '',
    questions: [],
    currIdx: 0,
    score: 0,
    correctCount: 0,
    timer: null,
    timeLeft: 10,
    startTime: 0,
    totalTimeSpent: 0,
    challenge: null,
    lastResult: null
  };

  var save = {
    v: 5, nick: '', team: '', diff: 2, days: {}, sent: 0, received: 0,
    room: { season: '', codes: [] }
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- helpers ---------------- */

  function p2(n) { return (n < 10 ? '0' : '') + n; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function clampText(s, max) {
    s = String(s == null ? '' : s).replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
    return s.slice(0, max);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function num(v, def) { return isFinite(v) ? v : def; }

  /* ---------------- 난이도 ---------------- */

  function levelOf(id) {
    var lv = num(parseInt(id, 10), 2);
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === lv) return LEVELS[i];
    return LEVELS[1];
  }

  function levelByName(name) {
    var s = String(name || '').trim();
    var map = { '쉬움': 1, 'easy': 1, 'E': 1, '1': 1, '보통': 2, 'normal': 2, 'N': 2, '2': 2, '덕후': 3, 'hard': 3, 'H': 3, '3': 3 };
    return levelOf(map[s] || 2);
  }

  function levelTag(lv) { var l = levelOf(lv); return l.icon + ' ' + l.name; }

  function poolCounts(mode, level) {
    if (!DATA || !DATA.questions) return { n: 0 };
    var pool = (mode === 'all') ? DATA.questions : DATA.questions.filter(function (q) { return q.group === mode; });
    var same = pool.filter(function (q) { return (q.level || 2) === level; }).length;
    return { n: same, total: pool.length };
  }

  /* ---------------- 팀 ---------------- */

  function teamNorm(name) { return String(name || '').replace(/\s+/g, '').toLowerCase(); }

  function sanitizeTeam(raw) {
    return clampText(raw, 12).replace(/[.~,]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function teamDisplay(raw) {
    var n = teamNorm(raw);
    for (var i = 0; i < TEAM_PRESETS.length; i++) if (TEAM_PRESETS[i].key === n) return TEAM_PRESETS[i].name;
    return sanitizeTeam(raw) || '무소속';
  }

  function teamIcon(raw) {
    var n = teamNorm(raw);
    for (var i = 0; i < TEAM_PRESETS.length; i++) {
      if (TEAM_PRESETS[i].key === n || teamNorm(TEAM_PRESETS[i].name) === n) return TEAM_PRESETS[i].icon;
    }
    return '🎤';
  }

  function currentTeam() { return save.team ? teamDisplay(save.team) : ''; }

  function chooseTeam(raw, andStart) {
    var name = sanitizeTeam(raw);
    if (!name) return;
    save.team = teamDisplay(name);
    persist();
    $('teamPicker').hidden = true;
    renderHome();
    if (andStart && pendingStart) {
      var fn = pendingStart; pendingStart = null; fn();
    }
  }

  /* ---------------- KST 날짜 / 시즌 ---------------- */

  function kstWall(ts) { return new Date((ts == null ? Date.now() : ts) + KST_MS); }

  function dateKeyOf(ts) {
    var d = kstWall(ts);
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }

  function partsOf(key) { var p = String(key).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function utcOf(key) { var o = partsOf(key); return Date.UTC(o.y, o.m - 1, o.d); }
  function addDays(key, n) { return new Date(utcOf(key) + n * DAY_MS).toISOString().slice(0, 10); }
  function dowOf(key) { return new Date(utcOf(key)).getUTCDay(); }
  function mondayOf(key) { return addDays(key, -((dowOf(key) + 6) % 7)); }

  function seasonOf(key) {
    var mon = utcOf(mondayOf(key));
    var thu = new Date(mon + 3 * DAY_MS);
    var yr = thu.getUTCFullYear();
    var week = Math.floor((thu.getTime() - Date.UTC(yr, 0, 1)) / (7 * DAY_MS)) + 1;
    return yr + 'W' + p2(week);
  }

  function seasonLabel(sid) {
    var m = /^(\d{4})W(\d{2})$/.exec(sid || '');
    return m ? m[1] + ' W' + m[2] : (sid || '');
  }

  function fmtKoDate(key) { var o = partsOf(key); return o.m + '월 ' + o.d + '일'; }

  function fmtShort(key) {
    var o = partsOf(key);
    var names = ['일', '월', '화', '수', '목', '금', '토'];
    return o.m + '.' + o.d + '(' + names[dowOf(key)] + ')';
  }

  function msToMidnight() {
    var d = kstWall();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - (Date.now() + KST_MS);
  }

  function msToSeasonEnd() {
    var nextMon = addDays(mondayOf(dateKeyOf()), 7);
    return (utcOf(nextMon) - KST_MS) - Date.now();
  }

  function leftText(ms) {
    if (ms < 0) ms = 0;
    var totalMin = Math.floor(ms / 60000);
    var days = Math.floor(totalMin / 1440);
    var hours = Math.floor((totalMin % 1440) / 60);
    var mins = totalMin % 60;
    if (days > 0) return days + '일 ' + hours + '시간';
    if (hours > 0) return hours + '시간 ' + mins + '분';
    return mins + '분';
  }

  function clockText(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    return p2(Math.floor(s / 3600)) + ':' + p2(Math.floor((s % 3600) / 60)) + ':' + p2(s % 60);
  }

  /* ---------------- storage ---------------- */

  function loadSaved() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!d) d = JSON.parse(localStorage.getItem('idolquiz_v4_save') || 'null');
      if (!d) d = JSON.parse(localStorage.getItem('idolquiz_v3_save') || 'null');
      if (d) {
        save.v = 5;
        save.nick = clampText(d.nick, 12);
        save.team = d.team || '';
        save.diff = num(parseInt(d.diff, 10), 2);
        save.days = (d.days && typeof d.days === 'object') ? d.days : {};
        save.sent = d.sent || 0;
        save.received = d.received || 0;
        save.room = (d.room && typeof d.room === 'object')
          ? { season: d.room.season || '', codes: d.room.codes || [] }
          : { season: '', codes: [] };
      }
    } catch (e) {}
    if (!save.nick) save.nick = '덕후' + (hashStr(String(Date.now())) % 90 + 10);
    if (!save.diff || save.diff < 1 || save.diff > 3) save.diff = 2;
    persist();
  }

  function persist() {
    try {
      var keys = Object.keys(save.days).sort();
      while (keys.length > 400) delete save.days[keys.shift()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch (e) {}
  }

  function nick() { return clampText(save.nick, 12) || '덕후'; }

  /* ---------------- 기록 ---------------- */

  function runKey(mode, lv) { return mode + '@' + lv; }

  function dayRec(key, mode, lv) {
    var d = save.days[key];
    if (!d) return null;
    return d[runKey(mode, lv)] || null;
  }

  function playedOn(key) {
    var d = save.days[key];
    return !!(d && Object.keys(d).length);
  }

  function runPoints(r) {
    if (!r) return 0;
    if (r.s != null) return r.s;
    return (r.c || 0) * levelOf(r.lv).weight;
  }

  function bestOf(key) {
    var d = save.days[key];
    if (!d) return null;
    var best = null;
    Object.keys(d).forEach(function (k) {
      var r = d[k];
      if (!r || !r.tot) return;
      if (!best || r.c / r.tot > best.c / best.tot || (r.c / r.tot === best.c / best.tot && r.c > best.c)) {
        best = {
          c: r.c, tot: r.tot, s: runPoints(r), p: runPoints(r), t: r.t,
          lv: levelOf(r.lv).id, team: r.g || '', date: key
        };
      }
    });
    return best;
  }

  function streakDays() {
    var today = dateKeyOf();
    var k = playedOn(today) ? today : addDays(today, -1);
    var n = 0, guard = 0;
    while (playedOn(k) && guard < 400) { n++; k = addDays(k, -1); guard++; }
    return n;
  }

  function totalDays() {
    var n = 0;
    Object.keys(save.days).forEach(function (k) { if (playedOn(k)) n++; });
    return n;
  }

  function seasonStats() {
    var map = {};
    Object.keys(save.days).forEach(function (dk) {
      if (!playedOn(dk)) return;
      var sid = seasonOf(dk);
      if (!map[sid]) map[sid] = { id: sid, monday: mondayOf(dk), best: null, bestPoints: null, dayCount: 0 };
      map[sid].dayCount++;
      var day = save.days[dk];
      Object.keys(day).forEach(function (k) {
        var r = day[k];
        if (!r || !r.tot) return;
        var run = { c: r.c, tot: r.tot, p: runPoints(r), lv: levelOf(r.lv).id, team: r.g || '', date: dk, mode: k };
        if (!map[sid].best || r.c / r.tot > map[sid].best.c / map[sid].best.tot ||
            (r.c / r.tot === map[sid].best.c / map[sid].best.tot && r.c > map[sid].best.c)) {
          map[sid].best = run;
        }
        if (!map[sid].bestPoints || run.p > map[sid].bestPoints.p) map[sid].bestPoints = run;
      });
    });
    return map;
  }

  function bestAllTime() {
    var stats = seasonStats();
    var best = null;
    Object.keys(stats).forEach(function (sid) {
      var b = stats[sid].best;
      if (!b) return;
      if (!best || b.c / b.tot > best.c / best.tot || (b.c / b.tot === best.c / best.tot && b.c > best.c)) best = b;
    });
    return best;
  }

  function recordRun(dk, mode, lv, correct, total, secs, team) {
    var day = save.days[dk] || (save.days[dk] = {});
    var k = runKey(mode, lv);
    var prev = day[k];
    var points = correct * levelOf(lv).weight;
    var rec = { c: correct, tot: total, s: points, lv: lv, g: team || '', t: secs, ts: Date.now() };
    if (!prev || points > runPoints(prev) || (points === runPoints(prev) && secs < (prev.t || 999))) day[k] = rec;
    persist();
  }

  /* ---------------- 등급 ---------------- */

  function tiers() { return (DATA && DATA.tiers && DATA.tiers.length) ? DATA.tiers : []; }

  function tierForRate(rateVal) {
    var pct = Math.round(rateVal * 100);
    var list = tiers();
    for (var i = 0; i < list.length; i++) if (pct >= list[i].min) return list[i];
    return list[list.length - 1] || { name: '🌱 새싹', desc: '' };
  }

  function tierIcon(t) { return (String(t.name).match(/^\S+/) || ['🌱'])[0]; }
  function tierLabel(t) { return String(t.name).replace(/^\S+\s*/, '').split('(')[0].trim(); }
  function tierWord(t) { return (tierLabel(t).split(' ')[0] || '덕후'); }

  /* ---------------- 문제 세트 ---------------- */

  function dailySize() {
    var n = (DATA && DATA.meta && DATA.meta.dailySize) || 10;
    return n > 0 ? n : 10;
  }

  /** 난이도가 높을수록 높은 level 문제부터 채운다. 같은 날·같은 난이도면 모두 같은 세트. */
  function dailySet(mode, dateKey, lv) {
    if (!DATA || !DATA.questions) return [];
    lv = levelOf(lv).id;
    var pool = (mode === 'all')
      ? DATA.questions.slice()
      : DATA.questions.filter(function (q) { return q.group === mode; });
    if (!pool.length) pool = DATA.questions.slice();

    var order = (lv === 1) ? [1, 2, 3] : (lv === 2 ? [2, 1, 3] : [3, 2, 1]);
    var rand = mulberry32(hashStr('idolquiz|' + dateKey + '|' + mode + '|L' + lv));
    var out = [];
    order.forEach(function (L) {
      var tierPool = pool.filter(function (q) { return (q.level || 2) === L; });
      out = out.concat(seededShuffle(tierPool, rand));
    });
    return out.slice(0, Math.min(dailySize(), out.length));
  }

  function validMode(m) {
    if (!DATA || !DATA.categories) return 'all';
    for (var i = 0; i < DATA.categories.length; i++) if (DATA.categories[i].id === m) return m;
    return 'all';
  }

  function catOf(mode) {
    var list = (DATA && DATA.categories) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === mode) return list[i];
    return null;
  }

  function modeLabel(mode) {
    var c = catOf(mode);
    if (mode === 'all' || !c) return '🎲 전국 올스타';
    return c.icon + ' ' + c.name;
  }

  /* ---------------- 결과 코드 ---------------- */

  function sanitizeNick(raw) {
    var s = clampText(raw, 12).replace(/[.~,]/g, ' ').replace(/\s+/g, ' ').trim();
    return (s || '익명').slice(0, 12);
  }

  function buildCode(entry) {
    return 'KPOP.' + entry.season + '.' + levelOf(entry.lv).name + '.' +
      entry.p + '/' + entry.max + '.' + (entry.streak || 0) + '.' +
      sanitizeTeam(entry.team) + '.' + sanitizeNick(entry.nick);
  }

  var CODE_RE = /KPOP\.(\d{4}W\d{2})\.(쉬움|보통|덕후|easy|normal|hard|[123ENH])\.(\d{1,3})\/(\d{1,3})\.(\d{1,4})\.([^.~,\n\r]{1,12})\.([^~,\n\r]{1,12})/;

  function parseCode(raw, wantSeason) {
    var s = clampText(raw, 100);
    var m = CODE_RE.exec(s);
    if (!m) return null;
    var lv = levelByName(m[2]);
    var p = +m[3], max = +m[4], streak = +m[5];
    if (!max || max > 30 || p < 0 || p > max) return null;
    streak = Math.min(400, Math.max(0, isFinite(streak) ? streak : 0));
    var team = sanitizeTeam(m[6]);
    if (!team) return null;
    if (wantSeason && m[1] !== wantSeason) return null;
    var totalQ = Math.max(1, Math.round(max / lv.weight));
    var correct = Math.round(p / lv.weight);
    return {
      season: m[1], lv: lv.id, p: p, max: max, c: Math.min(correct, totalQ), tot: totalQ,
      streak: streak, team: teamDisplay(team), nick: sanitizeNick(m[7]),
      rate: totalQ ? Math.min(1, correct / totalQ) : 0, raw: s,
      code: 'KPOP.' + m[1] + '.' + lv.name + '.' + p + '/' + max + '.' + streak + '.' + sanitizeTeam(team) + '.' + sanitizeNick(m[7])
    };
  }

  function extractCodes(text) {
    var out = [];
    /* 줄바꿈·쉼표·물결뿐 아니라, 한 줄에 공백으로 이어 붙은 코드도 각각 집는다 */
    String(text || '').split(/[\n\r,~]+|(?=KPOP\.)/).forEach(function (seg) {
      var i = seg.indexOf('KPOP.');
      if (i < 0) return;
      var e = parseCode(seg.slice(i));
      if (e) out.push(e);
    });
    return out;
  }

  /** 팀 기여도 = 그 주에 쌓은 점수. 동률이면 정답률 → 연속일 */
  function stronger(a, b) {
    if (!b) return true;
    if (a.p !== b.p) return a.p > b.p;
    if (Math.abs(a.rate - b.rate) > 1e-9) return a.rate > b.rate;
    return a.streak > b.streak;
  }

  function roomSeason() { return seasonOf(dateKeyOf()); }

  function roomCodes() {
    if (!save.room || save.room.season !== roomSeason()) return [];
    return save.room.codes || [];
  }

  function mySeasonEntry() {
    var sid = roomSeason();
    var stats = seasonStats()[sid];
    if (!stats || !stats.bestPoints) return null;
    var b = stats.bestPoints;
    var streak = streakDays();
    var team = b.team ? teamDisplay(b.team) : (currentTeam() || '무소속');
    var lv = levelOf(b.lv || 2);
    return {
      season: sid, lv: lv.id, p: b.p, max: b.tot * lv.weight, c: b.c, tot: b.tot,
      streak: streak, team: team, nick: nick(), rate: b.c / b.tot, mine: true,
      code: buildCode({ season: sid, lv: lv.id, p: b.p, max: b.tot * lv.weight, streak: streak, team: team, nick: nick() })
    };
  }

  function boardEntries() {
    var my = mySeasonEntry();
    var entries = [];
    roomCodes().forEach(function (raw) {
      var e = parseCode(raw, roomSeason());
      if (e) entries.push(e);
    });
    if (my) entries.push(my);

    var byNick = {};
    entries.forEach(function (e) {
      var key = e.nick;
      if (!byNick[key] || stronger(e, byNick[key])) {
        e.mine = !!(my && e.nick === my.nick);
        byNick[key] = e;
      }
    });
    var arr = Object.keys(byNick).map(function (k) { return byNick[k]; });
    arr.sort(function (a, b) {
      if (b.p !== a.p) return b.p - a.p;
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.rate !== a.rate) return b.rate - a.rate;
      return a.nick.localeCompare(b.nick);
    });
    arr.forEach(function (e, i) { e.rank = i + 1; });
    return arr;
  }

  /** 그룹 합산 순위 — 점수 합 → 참여 인원 → 연속 참여일. boardDiff로 난이도 필터 */
  function teamBoard() {
    var entries = rankingEntries();
    if (boardDiff) entries = entries.filter(function (e) { return e.lv === boardDiff; });
    var map = {};
    entries.forEach(function (e) {
      var key = teamNorm(e.team);
      if (!map[key]) map[key] = { key: key, name: teamDisplay(e.team), icon: teamIcon(e.team), points: 0, members: 0, bestStreak: 0, top: null };
      var t = map[key];
      t.points += e.p;
      t.members += 1;
      t.bestStreak = Math.max(t.bestStreak, e.streak || 0);
      if (!t.top || stronger(e, t.top)) t.top = e;
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; });
    arr.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.members !== a.members) return b.members - a.members;
      if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
      return a.name.localeCompare(b.name);
    });
    arr.forEach(function (t, i) { t.rank = i + 1; });
    return arr;
  }

  function myTeamRow() {
    var key = teamNorm(currentTeam());
    if (!key) return null;
    var arr = teamBoard();
    for (var i = 0; i < arr.length; i++) if (arr[i].key === key) return arr[i];
    return null;
  }

  function addRoomCode(raw) {
    var e = parseCode(raw, roomSeason());
    if (!e) return false;
    var sid = roomSeason();
    if (!save.room || save.room.season !== sid) save.room = { season: sid, codes: [] };
    var codes = save.room.codes;
    for (var i = 0; i < codes.length; i++) {
      var old = parseCode(codes[i], sid);
      if (old && old.nick === e.nick) {
        if (stronger(e, old)) codes[i] = e.code;
        persist();
        return true;
      }
    }
    if (codes.length >= MAX_CODES) codes.shift();
    codes.push(e.code);
    persist();
    return true;
  }

  function roomUrl() {
    var codes = roomCodes();
    return codes.length ? SITE_URL + '?r=' + encodeURIComponent(codes.join('~')) : SITE_URL;
  }

  /* ---------------- views ---------------- */

  function showView(viewId) {
    state.view = viewId;
    ['home', 'quiz', 'result', 'league'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = (v !== viewId);
    });
    window.scrollTo(0, 0);
  }

  /* ---------------- boot ---------------- */

  function init() {
    if (/[?&]pv=1/.test(location.search)) document.documentElement.className += ' pv';
    loadSaved();
    state.level = save.diff;
    renderHome();
    bindEvents();
    tick();
    setInterval(tick, 1000);

    fetch('data/kpop_questions.json')
      .then(function (r) { return r.json(); })
      .then(function (json) { DATA = json; afterData(); })
      .catch(function (err) {
        console.error('문제 데이터를 불러오지 못했습니다', err);
        DATA = getFallbackData();
        afterData();
      });
  }

  function afterData() {
    renderHomeCategories();
    renderHome();
    routeFromUrl();
    if (pendingStart) { var f = pendingStart; pendingStart = null; f(); }
    setTimeout(function () { initLive(); }, 700);
  }

  function routeFromUrl() {
    var params = new URLSearchParams(location.search);
    var ch = readChallenge(params);
    var room = params.get('r');

    if (room && !ch) {
      var got = extractCodes(room.replace(/~/g, '\n'));
      got.forEach(function (e) { addRoomCode(e.code); });
      if (got.length) { save.received += got.length; persist(); }
      showView('league');
      renderLeagueView(got.length ? '도착한 코드 ' + got.length + '개를 순위표에 올렸어요.' : null);
      return;
    }

    if (ch) {
      state.challenge = ch;
      save.received++;
      persist();
      renderChallenge();
    } else {
      $('challengeBanner').hidden = true;
      $('homeHero').hidden = false;
    }
  }

  function readChallenge(params) {
    if (!params.has('ch') || !params.has('tot')) return null;
    var ch = parseInt(params.get('ch'), 10);
    var tot = parseInt(params.get('tot'), 10);
    if (!isFinite(ch) || !isFinite(tot) || tot <= 0 || tot > 20 || ch < 0 || ch > tot) return null;
    var n = sanitizeNick(params.get('n') || '친구');
    var t = clampText(params.get('t') || '', 40);
    var g = sanitizeTeam(params.get('g') || '') || '무소속';
    var d = params.get('d') || '';
    var dateKey = dateKeyOf();
    if (/^\d{8}$/.test(d)) {
      var cand = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      if (/^\d{4}-\d{2}-\d{2}$/.test(cand)) dateKey = cand;
    }
    var lv = levelOf(num(parseInt(params.get('lv'), 10), 2));
    return { n: n, ch: ch, tot: tot, t: t, team: g, dateKey: dateKey, mode: validMode(params.get('m') || 'all'), lv: lv.id };
  }

  /* ---------------- home ---------------- */

  function renderTeamGrid() {
    var grid = $('teamGrid');
    if (!grid) return;
    var chosen = teamNorm(currentTeam());
    var html = '';
    TEAM_PRESETS.forEach(function (t) {
      var on = teamNorm(t.name) === chosen;
      html += '<button class="team-option' + (on ? ' on' : '') + '" type="button" data-team="' + esc(t.name) + '">' +
        '<span class="to-icon">' + t.icon + '</span><span class="to-name">' + esc(t.name) + '</span></button>';
    });
    grid.innerHTML = html;
    var opts = grid.querySelectorAll('.team-option');
    for (var i = 0; i < opts.length; i++) {
      opts[i].addEventListener('click', function () { chooseTeam(this.getAttribute('data-team'), true); });
    }
  }

  function renderDiffPicker() {
    var pick = $('diffPick');
    if (!pick) return;
    var btns = pick.querySelectorAll('.dp-btn');
    for (var i = 0; i < btns.length; i++) {
      var lv = parseInt(btns[i].getAttribute('data-lv'), 10);
      btns[i].className = 'dp-btn' + (lv === state.level ? ' on' : '');
    }
    var L = levelOf(state.level);
    var counts = poolCounts('all', L.id);
    $('diffCaption').textContent = L.icon + ' ' + L.name + ' 난이도 · 정답 1개 = ' + L.weight + '점' +
      (counts.n ? ' · 이 난이도 문제 ' + counts.n + '/' + counts.total : '');
  }

  function renderDiffTabs() {
    ['homeDiffTabs', 'leagueDiffTabs'].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      var btns = box.querySelectorAll('.dt-btn');
      for (var i = 0; i < btns.length; i++) {
        var d = parseInt(btns[i].getAttribute('data-diff'), 10);
        btns[i].className = 'dt-btn' + (d === boardDiff ? ' on' : '');
      }
    });
    var cap = boardDiff
      ? levelTag(boardDiff) + ' 난이도 기준 · 정답 1개 = ' + levelOf(boardDiff).weight + '점'
      : '전체 = 난이도별 가중치 합산 (쉬움1·보통2·덕후3점)';
    if ($('homeDiffCaption')) $('homeDiffCaption').textContent = cap;
    if ($('leagueDiffCaption')) $('leagueDiffCaption').textContent = cap;
  }

  function renderHome() {
    var today = dateKeyOf();
    var todayBest = bestOf(today);
    var yBest = bestOf(addDays(today, -1));
    var myTeam = currentTeam();
    var L = levelOf(state.level);

    $('heroWeek').textContent = seasonLabel(roomSeason());
    $('myTeamChip').textContent = myTeam || '그룹 고르기';
    $('myTeamIcon').textContent = myTeam ? teamIcon(myTeam) : '＋';
    $('myTeamBox').className = 'my-team' + (myTeam ? ' has-team' : '');
    $('btnTeamPick').className = 'team-chip' + (myTeam ? ' has-team' : '');
    if (!myTeam) $('teamPicker').hidden = false;
    renderTeamGrid();
    renderDiffPicker();

    $('dailyTitle').textContent = '🔥 ' + fmtKoDate(today) + ' · ' + L.name + ' ' + dailySize() + '문항';
    $('dailySub').textContent = myTeam
      ? '정답마다 ' + teamIcon(myTeam) + ' ' + myTeam + '에 ' + L.weight + '점 적립 · 매일 자정 새 문제'
      : '응원팀을 고르면 정답마다 우리 팀에 점수가 쌓입니다';

    var mineBox = $('dailyMine');
    if (todayBest) {
      mineBox.hidden = false;
      $('dailyMineScore').textContent = todayBest.c + ' / ' + todayBest.tot + ' · ' + todayBest.p + '점';
      var deltaEl = $('dailyMineDelta');
      if (yBest) {
        var diff = todayBest.p - yBest.p;
        deltaEl.textContent = '어제보다 ' + (diff > 0 ? '+' : '') + diff + '점';
        deltaEl.className = 'daily-mine-delta ' + (diff > 0 ? 'up' : (diff < 0 ? 'down' : ''));
      } else {
        deltaEl.textContent = '어제는 쉬었어요';
        deltaEl.className = 'daily-mine-delta';
      }
      $('dailyBtnLabel').textContent = myTeam ? teamIcon(myTeam) + ' ' + myTeam + ' 한 번 더' : '한 번 더 도전';
    } else {
      mineBox.hidden = true;
      $('dailyBtnLabel').textContent = myTeam ? teamIcon(myTeam) + ' ' + myTeam + ' 도전하기' : '응원팀 고르고 시작';
    }

    renderHomeBoard();
    renderRecordCard(today, todayBest, yBest);
    updateHeaderStats();
    updateMidnightText();
  }

  function renderHomeBoard() {
    var today = dateKeyOf();
    var mon = mondayOf(today);
    $('homeBoardSub').textContent = seasonLabel(roomSeason()) + ' · ' + fmtShort(mon) + ' ~ ' + fmtShort(addDays(mon, 6));
    $('homeBoardDeadline').textContent = '마감 ' + leftText(msToSeasonEnd());
    renderDiffTabs();
    renderLiveBadge();

    var teams = teamBoard();
    var el = $('homeGroupBoard');
    var myKey = teamNorm(currentTeam());

    if (!teams.length) {
      el.innerHTML = '<div class="gb-empty">' +
        '<p class="gb-empty-title">' + (boardDiff ? levelTag(boardDiff) + ' 순위표가 아직 비었어요' : '이번 주 순위표가 비어 있어요') + '</p>' +
        '<p class="gb-empty-desc">' + (currentTeam()
          ? '한 판 풀면 우리 팀이 1위로 올라갑니다.'
          : '응원팀을 고르고 한 판 풀면 우리 팀이 1위로 올라갑니다.') + '</p>' +
        '</div>';
      return;
    }

    var maxPts = teams[0].points || 1;
    var list = teams.slice(0, 5);
    if (myKey) {
      var mine = null;
      for (var i = 0; i < teams.length; i++) if (teams[i].key === myKey) mine = teams[i];
      if (mine && list.indexOf(mine) < 0) list.push(mine);
    }

    var html = '';
    list.forEach(function (t) {
      var pct = Math.max(6, Math.round(t.points / maxPts * 100));
      html += '<div class="grow' + (t.key === myKey ? ' me' : '') + '">' +
        '<span class="grank r' + (t.rank <= 3 ? t.rank : 'x') + '">' + t.rank + '</span>' +
        '<span class="gicon">' + t.icon + '</span>' +
        '<div class="gmain">' +
          '<div class="gline">' +
            '<span class="gname">' + esc(t.name) + (t.key === myKey ? '<span class="gme">우리 팀</span>' : '') + '</span>' +
            '<span class="gpoints">' + t.points + '<span class="gpoints-unit">점</span></span>' +
          '</div>' +
          '<div class="gbar"><div class="gbar-fill' + (t.key === myKey ? ' me' : '') + '" style="width:' + pct + '%"></div></div>' +
          '<span class="gmeta">' + t.members + '명 참여' + (t.top ? ' · 최고 ' + t.top.p + '점' : '') + '</span>' +
        '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  function renderRecordCard(today, todayBest, yBest) {
    var card = $('recordCard');
    var days = totalDays();
    if (!days) { card.hidden = true; return; }
    card.hidden = false;

    var bestAll = bestAllTime();
    $('recStreak').textContent = streakDays() + '일';
    $('recBest').textContent = bestAll ? (bestAll.c + '/' + bestAll.tot) : '—';
    $('recDays').textContent = days + '일';

    var line = '';
    if (todayBest && yBest) {
      var diff = todayBest.p - yBest.p;
      if (diff > 0) line = '어제 ' + yBest.p + '점 → 오늘 ' + todayBest.p + '점, ' + diff + '점 더 쌓았어요.';
      else if (diff === 0) line = '어제와 같은 ' + todayBest.p + '점. 내일 한 문제만 더 넘겨봐요.';
      else line = '어제 ' + yBest.p + '점 → 오늘 ' + todayBest.p + '점, 다음 판에서 만회해봐요.';
    } else if (todayBest) {
      line = '오늘 ' + todayBest.p + '점을 쌓았어요. 내일도 이어서 연속 기록을 만들어봐요.';
    } else if (yBest) {
      line = '어제 ' + yBest.p + '점. 오늘 판이 새로 열렸어요 — 지금 도전해보세요.';
    } else {
      line = '첫 기록이 저장됐어요.';
    }
    $('recordLine').textContent = line;
  }

  function updateHeaderStats() {
    var streak = streakDays();
    $('streakVal').textContent = streak > 0 ? streak + '일 연속' : '새 도전';

    var bestAll = bestAllTime();
    if (bestAll) {
      var t = tierForRate(bestAll.c / bestAll.tot);
      $('badgeIcon').textContent = tierIcon(t);
      $('badgeVal').textContent = tierWord(t);
    } else {
      $('badgeIcon').textContent = '🌱';
      $('badgeVal').textContent = '새싹';
    }
  }

  function updateMidnightText() {
    var el = $('dailyCountdown');
    if (el) el.textContent = '자정까지 ' + clockText(msToMidnight());
  }

  var lastDayKey = null;
  function tick() {
    updateMidnightText();
    var today = dateKeyOf();
    if (lastDayKey === null) { lastDayKey = today; return; }
    if (today !== lastDayKey) {
      lastDayKey = today;
      if (state.view === 'home') renderHome();
      if (state.view === 'league') renderLeagueView();
    }
  }

  /* ---------------- 도전장 진입 ---------------- */

  function renderChallenge() {
    var c = state.challenge;
    if (!c) { $('challengeBanner').hidden = true; $('homeHero').hidden = false; return; }

    $('challengeBanner').hidden = false;
    $('homeHero').hidden = true;

    $('chFriendName').textContent = c.n;
    $('chFriendTeam').textContent = teamIcon(c.team) + ' ' + c.team;
    $('chScoreLine').textContent = c.tot + '문제 중 ' + c.ch + '문제';
    $('chVsFriend').textContent = c.ch;
    $('chAvatar').textContent = chAvatar(c.n);
    $('chDiff').textContent = levelTag(c.lv) + ' 난이도';

    var t = tierForRate(c.ch / c.tot);
    $('chFriendTier').textContent = tierIcon(t) + ' ' + (c.t || tierLabel(t));

    var myTeam = currentTeam();
    $('chVsMyTeamLabel').textContent = myTeam ? teamIcon(myTeam) + ' ' + myTeam : '내 팀';
    $('chVsFriendTeamLabel').textContent = teamIcon(c.team) + ' ' + c.team;
    $('chQuestion').textContent = myTeam ? '우리 팀이 이길 수 있어요?' : '내 응원팀을 골라 팀 대항으로 받아줘요';

    var roomBtn = $('btnChallengeRoom');
    var count = boardEntries().length;
    if (count > 1) {
      roomBtn.hidden = false;
      roomBtn.textContent = '🏆 이 방 그룹 순위표 보기 (' + count + '명)';
    } else {
      roomBtn.hidden = true;
    }
  }

  function chAvatar(name) {
    var pool = ['😎', '🔥', '💜', '🎧', '💎', '⚡', '🐰', '🦊', '🌙', '🍀'];
    return pool[hashStr(String(name)) % pool.length];
  }

  /* ---------------- quiz ---------------- */

  function requestStart(mode, opts) {
    opts = opts || {};
    if (!currentTeam()) {
      pendingStart = function () { requestStart(mode, opts); };
      if (state.view !== 'home') showView('home');
      $('homeHero').hidden = false;
      $('teamPicker').hidden = false;
      $('teamPicker').classList.add('pulse');
      setTimeout(function () { $('teamPicker').classList.remove('pulse'); }, 1200);
      try { $('teamPicker').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      showToast('응원하는 그룹을 먼저 골라주세요!');
      return;
    }
    startQuiz(mode, opts);
  }

  function startQuiz(mode, opts) {
    opts = opts || {};
    if (!DATA) {
      pendingStart = function () { startQuiz(mode, opts); };
      showToast('문제를 불러오는 중이에요. 잠시만요!');
      return;
    }
    state.mode = validMode(mode);
    state.dateKey = opts.dateKey || dateKeyOf();
    state.level = levelOf(opts.level || save.diff).id;
    state.challenge = opts.challenge || null;
    state.team = currentTeam();
    state.questions = dailySet(state.mode, state.dateKey, state.level);
    state.currIdx = 0;
    state.score = 0;
    state.correctCount = 0;
    state.totalTimeSpent = 0;

    $('qGroupTag').textContent = modeLabel(state.mode);
    renderBattleStrip();
    showView('quiz');
    loadQuestion(0);
  }

  function renderBattleStrip() {
    var myTeam = currentTeam() || '무소속';
    var L = levelOf(state.level);
    $('bsMyTeam').textContent = teamIcon(myTeam) + ' ' + myTeam + ' · ' + L.name;
    $('bsMyPoints').textContent = state.score;

    var c = state.challenge;
    if (c) {
      $('bsVs').hidden = false;
      $('bsEnemy').hidden = false;
      $('bsEnemyTeam').textContent = teamIcon(c.team) + ' ' + c.team;
      $('bsEnemyScore').textContent = c.ch;
    } else {
      $('bsVs').hidden = true;
      $('bsEnemy').hidden = true;
    }
  }

  function loadQuestion(idx) {
    state.currIdx = idx;
    var q = state.questions[idx];
    if (!q) { finishQuiz(); return; }

    $('qCounter').textContent = '문제 ' + (idx + 1) + ' / ' + state.questions.length;
    $('progressFill').style.width = Math.round(((idx + 1) / state.questions.length) * 100) + '%';
    $('qCategoryPill').textContent = (q.category || '스피드 퀴즈') + ' · ' + levelTag(q.level || 2);
    $('qText').textContent = q.question;

    var original = q.choices.map(function (c, i) { return { text: c, isCorrect: i === q.answer }; });
    var shuffled = shuffle(original);
    state._choices = shuffled;
    var list = $('choicesList');
    var letters = ['A', 'B', 'C', 'D', 'E'];
    list.innerHTML = '';

    shuffled.forEach(function (item, i) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.type = 'button';
      btn.innerHTML = '<span class="choice-mark">' + letters[i] + '</span><span class="choice-text">' + esc(item.text) + '</span>';
      btn.addEventListener('click', function () { submitAnswer(item.isCorrect, btn, shuffled); });
      list.appendChild(btn);
    });

    $('feedbackCard').hidden = true;
    startTimer();
  }

  function startTimer() {
    clearInterval(state.timer);
    state.timeLeft = 10;
    $('timerBadge').classList.remove('urgent');
    $('timerSec').textContent = '10';
    state.startTime = Date.now();

    state.timer = setInterval(function () {
      state.timeLeft--;
      $('timerSec').textContent = state.timeLeft;
      if (state.timeLeft <= 3) $('timerBadge').classList.add('urgent');
      if (state.timeLeft <= 0) { clearInterval(state.timer); timeOut(); }
    }, 1000);
  }

  function lockChoices(choices) {
    var btns = $('choicesList').querySelectorAll('.choice-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      if (choices && choices[i] && choices[i].isCorrect) btns[i].classList.add('correct');
    }
  }

  function timeOut() {
    lockChoices(state._choices || null);
    showFeedback(false, '시간 초과! 아쉽네요. 다음엔 더 빠르게!');
  }

  function submitAnswer(isCorrect, clickedBtn, choices) {
    clearInterval(state.timer);
    state._choices = choices;
    state.totalTimeSpent += Math.round((Date.now() - state.startTime) / 1000);
    lockChoices(choices);

    var L = levelOf(state.level);
    if (isCorrect) {
      clickedBtn.classList.add('correct');
      state.score += L.weight;
      state.correctCount++;
      $('bsMyPoints').textContent = state.score;
      showFeedback(true, '정답! ' + teamIcon(currentTeam() || '🎤') + ' ' + (currentTeam() || '우리 팀') + '에 +' + L.weight + '점');
      var box = $('bsMyPoints').parentElement;
      box.classList.add('pop');
      setTimeout(function () { box.classList.remove('pop'); }, 400);
    } else {
      clickedBtn.classList.add('wrong');
      showFeedback(false, '아쉽게도 틀렸습니다!');
    }
  }

  function showFeedback(isCorrect, title) {
    var q = state.questions[state.currIdx];
    var icon = $('verdictIcon');
    icon.textContent = isCorrect ? '✓' : '✕';
    icon.parentElement.className = 'verdict-row ' + (isCorrect ? 'ok' : 'bad');
    $('verdictText').textContent = title;
    $('explainText').textContent = '💡 해설: ' + ((q && q.explain) || '정답을 확인하세요.');
    $('feedbackCard').hidden = false;
  }

  function finishQuiz() {
    clearInterval(state.timer);
    var L = levelOf(state.level);
    var correct = state.correctCount;
    var total = state.questions.length || 1;
    var points = correct * L.weight;
    var maxPoints = total * L.weight;

    recordRun(state.dateKey, state.mode, L.id, correct, total, state.totalTimeSpent, state.team);

    var tier = tierForRate(correct / total);
    $('resTargetGroup').textContent = modeLabel(state.mode) + ' · ' + L.name + ' ' + total + '문항';

    $('resTierIcon').textContent = tierIcon(tier);
    $('resTierName').textContent = tierLabel(tier);
    $('resTierDesc').textContent = tier.desc || '';
    $('resScoreNum').textContent = points;
    $('resScoreTotal').textContent = '/ ' + maxPoints;
    $('resCorrectCount').textContent = correct + ' / ' + total;
    $('resTimeUsed').textContent = state.totalTimeSpent + '초';
    $('resCodeHash').textContent = 'IDOL' + seasonOf(state.dateKey) + '.' + points;

    state.lastResult = {
      c: correct, tot: total, p: points, max: maxPoints, secs: state.totalTimeSpent,
      mode: state.mode, dateKey: state.dateKey, team: state.team, lv: L.id
    };

    var yRec = dayRec(addDays(state.dateKey, -1), state.mode, L.id);
    var deltaEl = $('resDelta');
    if (yRec) {
      var diff = points - runPoints(yRec);
      deltaEl.hidden = false;
      deltaEl.className = 'card-delta ' + (diff > 0 ? 'up' : (diff < 0 ? 'down' : ''));
      deltaEl.textContent = '어제 같은 난이도 ' + runPoints(yRec) + '점 → 오늘 ' + points + '점 (' + (diff > 0 ? '+' + diff : (diff === 0 ? '동일' : diff)) + ')';
    } else {
      deltaEl.className = 'card-delta';
      deltaEl.hidden = false;
      deltaEl.textContent = L.icon + ' ' + L.name + ' 난이도 · 정답 1개 ' + L.weight + '점 · 최대 ' + maxPoints + '점';
    }

    if (state.challenge) state.level = save.diff;   /* 도전장 난이도는 그 판에서만 */
    renderTeamResult();
    renderVersus();
    renderResultActions();
    renderCodeCard();
    renderHome();
    showView('result');
    if (LIVE.status === 'ready' && LIVE.mineExists) submitLive(resultEntry(), true);
  }

  function renderTeamResult() {
    var team = state.team || currentTeam() || '무소속';
    var r = state.lastResult;
    var L = levelOf(r.lv);
    $('resTeamIcon').textContent = teamIcon(team);
    $('resTeamName').textContent = team;
    $('resTeamPoints').textContent = r.p;
    $('resTitle').textContent = teamIcon(team) + ' ' + team + '에 ' + r.p + '점!';
    $('resDiffLine').textContent = L.icon + ' ' + L.name + ' 난이도 · 정답 1개 = ' + L.weight + '점';

    var row = myTeamRow();
    if (row) {
      var board = teamBoard();
      var ahead = null;
      for (var i = 0; i < board.length; i++) if (board[i].rank === row.rank - 1) ahead = board[i];
      var txt = '이번 주 전체 ' + row.rank + '위 · ' + row.points + '점 · ' + row.members + '명 참여';
      if (ahead && ahead.points > row.points) txt += ' · 1위까지 ' + (ahead.points - row.points) + '점';
      $('resTeamRank').textContent = txt;
    } else {
      $('resTeamRank').textContent = '이번 주 첫 주자예요. 순위표에 올려보세요!';
    }
  }

  function renderVersus() {
    var card = $('versusCard');
    var c = state.challenge;
    if (!c) { card.hidden = true; return; }
    card.hidden = false;

    var my = state.lastResult;
    var myRate = my.c / my.tot;
    var fRate = c.ch / c.tot;
    var myTeam = my.team || currentTeam() || '무소속';
    var L = levelOf(my.lv);

    $('vsFriendTeam').textContent = teamIcon(c.team) + ' ' + c.team;
    $('vsFriendNum').textContent = c.ch;
    $('vsFriendBar').style.width = Math.round(fRate * 100) + '%';
    $('vsFriendTier').textContent = c.n + ' · ' + tierIcon(tierForRate(fRate)) + ' ' + tierWord(tierForRate(fRate));

    $('vsMyTeam').textContent = teamIcon(myTeam) + ' ' + myTeam;
    $('vsMyNum').textContent = my.c;
    $('vsMyBar').style.width = Math.round(myRate * 100) + '%';
    $('vsMyTier').textContent = '나 · ' + tierIcon(tierForRate(myRate)) + ' ' + tierWord(tierForRate(myRate));

    var diff = my.c - c.ch;
    var verdict, sub;
    if (my.c > c.ch || (my.tot !== c.tot && myRate > fRate + 1e-9)) {
      verdict = '🏅 우리 팀이 이겼어요!';
      sub = diff === 1 ? '딱 한 문제 차이. 팀 승리를 가져왔어요.' : ('상대 팀을 ' + diff + '문제 차이로 눌렀어요.');
      card.className = 'versus-card win';
    } else if (my.c < c.ch || (my.tot !== c.tot && myRate < fRate - 1e-9)) {
      verdict = '😤 한 문제 차이로 졌어요';
      sub = diff === -1 ? '한 문제만 더 맞히면 우리 팀이 이겨요. 같은 문제로 다시!' : (Math.abs(diff) + '문제 차이. 같은 문제로 다시 도전!');
      card.className = 'versus-card lose';
    } else {
      verdict = '🤝 팀 대항 무승부';
      sub = '점수까지 똑같네요. 다음 판이 진짜 승부!';
      card.className = 'versus-card tie';
    }
    $('vsVerdict').textContent = verdict;
    $('vsVerdictSub').textContent = sub;

    var sameDay = c.dateKey === my.dateKey;
    $('vsNote').textContent = (sameDay ? '같은 ' + my.tot + '문제' : '친구가 풀었던 ' + fmtKoDate(c.dateKey) + '의 ' + c.tot + '문제') +
      ' · ' + L.name + ' 난이도 · 같은 조건';
  }

  function currentCode() {
    var r = state.lastResult || { c: 0, tot: 10, p: 0, max: 10, lv: save.diff };
    return buildCode({
      season: seasonOf(state.dateKey || dateKeyOf()),
      lv: r.lv, p: r.p, max: r.max, streak: streakDays(),
      team: state.team || currentTeam() || '무소속',
      nick: $('nickInput') ? sanitizeNick($('nickInput').value) : nick()
    });
  }

  function renderCodeCard() {
    if ($('nickInput')) $('nickInput').value = nick();
    $('myCode').textContent = currentCode();
  }

  function renderResultActions() {
    var c = state.challenge;
    $('resEyebrow').textContent = c ? '💥 TEAM BATTLE RESULT' : '💥 FANDOM BATTLE RESULT';
    $('shareBtnLabel').textContent = c ? '🔁 도전장 되돌려주기 (내 팀 점수 보내기)' : '📤 도전장 보내기 (팀 대항)';
    $('retryBtnLabel').textContent = c ? '🔁 같은 문제로 다시 도전' : '🔄 다른 영역 도전하기';
    $('shareNote').innerHTML = c
      ? '친구가 <b>되돌려받은 도전장</b>으로 같은 난이도·같은 문제를 다시 풉니다. 순위표에 올리면 다른 팬덤과도 겨룰 수 있어요.'
      : '링크를 받은 친구는 <b>내가 푼 그 ' + (state.lastResult ? state.lastResult.tot : 10) + '문제</b>를 같은 난이도로 겨룹니다. 받는 사람 팀과 점수가 함께 표시돼요.';
    renderResultLiveLabel();
  }

  /* ---------------- 공유 ---------------- */

  function challengeUrl() {
    var r = state.lastResult || { c: 0, tot: 10, p: 0, max: 10, lv: save.diff };
    var team = state.team || currentTeam() || '무소속';
    var t = tierForRate(r.c / r.tot);
    var p = new URLSearchParams();
    p.set('ch', String(r.c));
    p.set('tot', String(r.tot));
    p.set('t', tierLabel(t));
    p.set('g', team);
    p.set('n', sanitizeNick($('nickInput') ? $('nickInput').value : nick()));
    p.set('d', String(state.dateKey || dateKeyOf()).replace(/-/g, ''));
    p.set('m', state.mode);
    p.set('lv', String(r.lv));
    var codes = roomCodes();
    if (codes.length && codes.length <= 12) p.set('r', codes.join('~'));
    return { url: SITE_URL + '?' + p.toString(), text: shareText(r) };
  }

  function shareText(r) {
    var team = state.team || currentTeam() || '무소속';
    var L = levelOf(r.lv);
    var head = '⚔️ ' + teamIcon(team) + ' ' + team + ' · ' + L.icon + L.name + ' ' + r.c + '/' + r.tot + ' (' + r.p + '점)';
    var tail;
    if (state.challenge) {
      if (r.c > state.challenge.ch) tail = '우리 팀이 이겼다! 같은 문제로 다시 해볼래?';
      else if (r.c === state.challenge.ch) tail = '무승부야. 한 판 더?';
      else tail = '이번엔 네 팀이 이겼어. 같은 문제로 한 번 더!';
    } else {
      tail = '우리 팀 점수 올렸다. 같은 문제로 네 팀이랑 겨뤄보자!';
    }
    return head + '\n' + tail;
  }

  function copyText(text, okMsg) {
    var done = function () { showToast(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done)['catch'](function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done();
  }

  function shareChallenge() {
    var built = challengeUrl();
    if (navigator.share) {
      navigator.share({ title: '팬덤 대항전 · K-pop 덕력고사', text: built.text, url: built.url })
        ['catch'](function () { copyText(built.text + '\n👉 ' + built.url, '도전장 링크가 복사됐어요. 친구에게 붙여넣어 보세요!'); });
      return;
    }
    copyText(built.text + '\n👉 ' + built.url, '도전장 링크가 복사됐어요. 친구에게 붙여넣어 보세요!');
  }

  var toastTimer = null;
  function showToast(msg) {
    var t = (state.view === 'league' && $('toastPopupLeague')) ? $('toastPopupLeague') : $('toastPopup');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------------- league view ---------------- */

  function renderLeagueView(notice) {
    var today = dateKeyOf();
    var sid = seasonOf(today);
    var mon = mondayOf(today);
    $('leagueNavName').textContent = seasonLabel(sid);
    $('leagueTitle').textContent = seasonLabel(sid) + ' 그룹 대항 리그';
    $('leagueRange').textContent = fmtShort(mon) + ' ~ ' + fmtShort(addDays(mon, 6)) + ' · 마감까지 ' + leftText(msToSeasonEnd());

    var teams = teamBoard();
    var entries = rankingEntries();
    var myRow = myTeamRow();

    $('leagueTeamRank').textContent = myRow ? myRow.rank + '위' : '—';
    $('leagueTeamPoints').textContent = myRow ? myRow.points : 0;
    $('leaguePlayers').textContent = entries.length;
    renderDiffTabs();
    renderLiveBadge();

    var el = $('leagueGroupBoard');
    if (!teams.length) {
      el.innerHTML = '<div class="gb-empty">' +
        '<span class="gb-empty-icon">🏆</span>' +
        '<p class="gb-empty-title">아직 순위표가 비어 있어요</p>' +
        '<p class="gb-empty-desc">내 결과 코드를 복사해 단톡방에 붙이고,<br>친구 코드를 모아 오면 그룹 순위표가 서요.</p>' +
        '</div>';
    } else {
      var maxPts = teams[0].points || 1;
      var html = '';
      teams.forEach(function (t) {
        var pct = Math.max(6, Math.round(t.points / maxPts * 100));
        var mine = myRow && myRow.key === t.key;
        html += '<div class="grow big' + (mine ? ' me' : '') + '">' +
          '<span class="grank r' + (t.rank <= 3 ? t.rank : 'x') + '">' + t.rank + '</span>' +
          '<span class="gicon">' + t.icon + '</span>' +
          '<div class="gmain">' +
            '<div class="gline">' +
              '<span class="gname">' + esc(t.name) + (mine ? '<span class="gme">우리 팀</span>' : '') + '</span>' +
              '<span class="gpoints">' + t.points + '<span class="gpoints-unit">점</span></span>' +
            '</div>' +
            '<div class="gbar"><div class="gbar-fill' + (mine ? ' me' : '') + '" style="width:' + pct + '%"></div></div>' +
            '<span class="gmeta">' + t.members + '명 참여' + (t.top ? ' · 최고 ' + t.top.p + '점' : '') +
              (t.bestStreak ? ' · 🔥 ' + t.bestStreak + '일' : '') + '</span>' +
          '</div>' +
        '</div>';
      });
      el.innerHTML = html;
    }

    var pEl = $('leaguePlayerBoard');
    var shown = entries;
    if (boardDiff) shown = entries.filter(function (e) { return e.lv === boardDiff; });
    if (!shown.length) {
      pEl.innerHTML = '<p class="player-empty">아직 올라온 개인 코드가 없어요.</p>';
    } else {
      var phtml = '';
      shown.slice(0, 12).forEach(function (e) {
        phtml += '<div class="player-row' + (e.mine ? ' me' : '') + '">' +
          '<span class="prank">' + e.rank + '</span>' +
          '<span class="pteam">' + teamIcon(e.team) + '</span>' +
          '<span class="pnick">' + esc(e.nick) + (e.mine ? '<span class="board-me-pill">나</span>' : '') + '</span>' +
          '<span class="pdiff">' + levelOf(e.lv).icon + '</span>' +
          '<span class="pstreak">🔥' + (e.streak || 0) + '</span>' +
          '<span class="pscore">' + e.p + '<span class="pscore-unit">점</span></span>' +
        '</div>';
      });
      pEl.innerHTML = phtml;
    }

    var mine = mySeasonEntry();
    $('leagueCodeHint').textContent = mine
      ? '내 코드: ' + mine.code + (LIVE.status === 'ready' ? ' · 실시간 랭킹에도 올라가 있어요' : '')
      : '아직 이번 시즌 기록이 없어요. 오늘의 ' + dailySize() + '문제를 풀고 코드를 받아보세요.';

    renderPastSeasons();
    if (notice) showToast(notice);
  }

  function renderPastSeasons() {
    var box = $('pastSeasons');
    var stats = seasonStats();
    var cur = roomSeason();
    var ids = Object.keys(stats).filter(function (s) { return s !== cur; }).sort().reverse();
    if (!ids.length) { box.hidden = true; return; }
    box.hidden = false;
    var html = '<h3 class="past-title">지난 시즌 내 기록</h3>';
    ids.slice(0, 6).forEach(function (sid) {
      var s = stats[sid];
      var b = s.bestPoints;
      html += '<div class="past-row">' +
        '<span class="past-season">' + seasonLabel(sid) + '</span>' +
        '<span class="past-score">' + (b ? b.p + '점' : '—') + '</span>' +
        '<span class="past-team">' + (b && b.team ? teamIcon(b.team) + ' ' + esc(teamDisplay(b.team)) : '') + '</span>' +
        '<span class="past-days">' + s.dayCount + '일 참여</span>' +
        '</div>';
    });
    box.innerHTML = html;
  }

  function buildBoardFromInput() {
    var codes = extractCodes($('codeInput').value);
    if (!codes.length) { showToast('KPOP.으로 시작하는 결과 코드를 찾지 못했어요.'); return; }
    codes.forEach(function (e) { addRoomCode(e.code); });
    $('codeInput').value = '';
    renderLeagueView(codes.length + '개 코드를 순위표에 올렸어요.');
    renderHome();
  }

  /* ---------------- 실시간 랭킹 (Firebase · 익명 로그인) ----------------
     럭비 퀴즈와 같은 Firebase 프로젝트를 쓰되 idol_ 접두사 컬렉션만 읽고 씁니다.
     럭비 컬렉션(players / weeks / hall)은 건드리지 않습니다.
     보안 규칙이 게시되지 않으면 permission-denied → 코드 순위표로 자동 폴백. */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error('sdk-load')); };
      document.head.appendChild(s);
    });
  }

  function initLive(force) {
    if (LIVE.status === 'loading' || LIVE.status === 'ready') return;
    if (LIVE.status === 'denied' && !force) return;
    if (!navigator.onLine) { setLive('offline', '오프라인 상태예요 · 코드 순위표로 참여'); return; }
    LIVE.tried = true;
    setLive('loading', '실시간 랭킹 연결 중…');

    loadScript(SDK_URL.app)
      .then(function () { return loadScript(SDK_URL.auth); })
      .then(function () { return loadScript(SDK_URL.fs); })
      .then(function () {
        if (!window.firebase) throw new Error('sdk-missing');
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        LIVE.db = firebase.firestore();
        try { LIVE.db.settings({ ignoreUndefinedProperties: true }); } catch (e) {}
        if (firebase.auth().currentUser) return { user: firebase.auth().currentUser };
        return firebase.auth().signInAnonymously();
      })
      .then(function (cred) {
        LIVE.uid = cred && cred.user ? cred.user.uid : (firebase.auth().currentUser || {}).uid;
        return startLiveSubscription();
      })
      .catch(function (err) { classifyLiveError(err); });
  }

  function startLiveSubscription() {
    var season = roomSeason();
    if (LIVE.unsub) { try { LIVE.unsub(); } catch (e) {} LIVE.unsub = null; }
    LIVE.season = season;
    return new Promise(function (resolve, reject) {
      LIVE.unsub = LIVE.db.collection('idol_scores')
        .where('season', '==', season)
        .limit(200)
        .onSnapshot(function (snap) {
          var rows = [];
          snap.forEach(function (doc) {
            var d = doc.data() || {};
            rows.push({
              uid: (doc.id || '').split('_')[0],
              nick: d.nick, team: d.team, season: d.season,
              points: d.points || 0, correct: d.correct || 0, total: d.total || 1,
              level: d.level || 2, streak: d.streak || 0
            });
          });
          LIVE.scores = rows;
          LIVE.mineExists = rows.some(function (r) { return r.uid === LIVE.uid; });
          setLive('ready', '');
          resolve();
        }, function (err) { reject(err); });
    });
  }

  function classifyLiveError(err) {
    var code = String((err && (err.code || err.message)) || '');
    if (/permission-denied|insufficient/i.test(code)) {
      setLive('denied', '온라인 랭킹 준비 중 · 코드 순위표로 참여할 수 있어요');
    } else if (/operation-not-allowed|anonymous/i.test(code)) {
      setLive('error', '익명 로그인이 꺼져 있어 코드 순위표로 참여해요');
    } else if (/unavailable|network|offline|timeout|sdk-load|sdk-missing/i.test(code)) {
      setLive('offline', '오프라인 상태예요 · 코드 순위표로 참여');
    } else {
      setLive('error', '온라인 랭킹에 연결하지 못했어요 · 코드 순위표로 참여');
    }
  }

  function setLive(status, reason) {
    var changed = (LIVE.status !== status);
    LIVE.status = status;
    if (reason !== undefined) LIVE.reason = reason;
    renderLiveBadge();
    if (changed) {
      if (state.view === 'home') renderHomeBoard();
      if (state.view === 'league') renderLeagueView();
      if (state.view === 'result') renderResultLiveLabel();
    }
  }

  function liveLabel() {
    if (LIVE.status === 'ready') return { cls: 'on', text: '● 실시간 그룹 순위' };
    if (LIVE.status === 'loading' || LIVE.status === 'idle') return { cls: '', text: '● 실시간 연결 중…' };
    if (LIVE.status === 'denied') return { cls: 'warn', text: '● 온라인 랭킹 준비 중 · 코드 순위표' };
    return { cls: 'warn', text: '● 오프라인 · 코드 순위표' };
  }

  function renderLiveBadge() {
    var l = liveLabel();
    var lb = $('homeLiveBadge');
    if (lb) { lb.className = 'gb-live ' + l.cls; lb.textContent = l.text; }
    var st = $('liveStatus');
    if (!st) return;
    st.className = 'live-status ' + l.cls;
    $('liveStatusText').textContent = LIVE.status === 'ready'
      ? '실시간 랭킹 · 익명 로그인 연결됨 · 이번 주 ' + LIVE.scores.length + '명 참가'
      : (LIVE.reason || l.text.replace('● ', ''));
    $('btnLiveRetry').hidden = !(LIVE.status === 'denied' || LIVE.status === 'error' || LIVE.status === 'offline');
  }

  function liveEntries() {
    return LIVE.scores.map(function (r) {
      var lv = levelOf(r.level);
      var tot = Math.max(1, r.total || 1);
      var c = Math.min(tot, Math.max(0, r.correct || 0));
      return {
        season: r.season || LIVE.season, lv: lv.id, p: r.points || 0, max: tot * lv.weight,
        c: c, tot: tot, streak: r.streak || 0, team: teamDisplay(r.team),
        nick: sanitizeNick(r.nick), rate: c / tot, uid: r.uid, mine: r.uid === LIVE.uid,
        code: buildCode({ season: r.season || LIVE.season, lv: lv.id, p: r.points || 0, max: tot * lv.weight, streak: r.streak || 0, team: r.team, nick: r.nick })
      };
    });
  }

  function cmpEntries(a, b) {
    if (b.p !== a.p) return b.p - a.p;
    if (b.streak !== a.streak) return b.streak - a.streak;
    if (Math.abs(b.rate - a.rate) > 1e-9) return b.rate - a.rate;
    return a.nick.localeCompare(b.nick);
  }

  /** 순위표 재료 — 실시간이 연결됐으면 서버 행, 아니면 내 기기의 코드 */
  function rankingEntries() {
    if (LIVE.status !== 'ready') return boardEntries();
    var arr = liveEntries();
    var mine = mySeasonEntry();
    if (mine) {
      var found = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].uid === LIVE.uid) {
          found = true;
          if (stronger(mine, arr[i])) { mine.mine = true; mine.uid = LIVE.uid; arr[i] = mine; }
          else arr[i].mine = true;
        }
      }
      if (!found) { mine.mine = true; arr.push(mine); }
    }
    arr.sort(cmpEntries);
    arr.forEach(function (e, i) { e.rank = i + 1; });
    return arr;
  }

  function resultEntry() {
    var r = state.lastResult || { c: 0, tot: 10, p: 0, max: 10, lv: save.diff };
    return {
      nick: sanitizeNick($('nickInput') ? $('nickInput').value : nick()),
      team: state.team || currentTeam() || '무소속',
      season: roomSeason(),
      p: r.p, c: r.c, tot: r.tot, lv: r.lv, streak: streakDays()
    };
  }

  function submitLive(entry, silent) {
    if (LIVE.status !== 'ready' || !LIVE.uid || !LIVE.db) return Promise.resolve(false);
    var ref = LIVE.db.collection('idol_scores').doc(LIVE.uid + '_' + entry.season);
    return ref.get().then(function (doc) {
      var prev = doc.exists ? doc.data() : null;
      var stamp = firebase.firestore.FieldValue.serverTimestamp();
      if (prev && (prev.points || 0) > entry.p) {
        if (prev.nick === entry.nick && prev.team === entry.team) return true;
        return ref.update({ nick: entry.nick, team: entry.team, streak: entry.streak, at: stamp }).then(function () { return true; });
      }
      if (prev && prev.points === entry.p && prev.nick === entry.nick && prev.team === entry.team && prev.streak === entry.streak) return true;
      return ref.set({
        nick: entry.nick, team: entry.team, season: entry.season,
        points: entry.p, correct: entry.c, total: entry.tot, level: entry.lv,
        streak: entry.streak, at: stamp
      }).then(function () { return true; });
    })['catch'](function (err) {
      classifyLiveError(err);
      if (!silent) showToast('온라인 랭킹이 아직 열리지 않아 코드로 올렸어요.');
      return false;
    });
  }

  function renderResultLiveLabel() {
    var el = $('leagueBtnLabel');
    if (!el) return;
    el.textContent = LIVE.status === 'ready'
      ? '🏆 실시간 그룹 순위표에 올리기'
      : '🏆 코드로 그룹 순위표에 올리기';
  }

  /* ---------------- events ---------------- */

  function bindEvents() {
    $('brandLogo').addEventListener('click', function (e) {
      e.preventDefault();
      clearInterval(state.timer);
      showView('home');
      renderHome();
    });

    $('btnDailyPlay').addEventListener('click', function () { requestStart('all', { level: state.level }); });

    $('btnTeamPick').addEventListener('click', function () {
      var p = $('teamPicker');
      p.hidden = !p.hidden;
    });

    $('btnTeamCustom').addEventListener('click', function () {
      var v = $('teamCustomInput').value;
      if (!sanitizeTeam(v)) { showToast('그룹 이름을 입력해 주세요.'); return; }
      $('teamCustomInput').value = '';
      chooseTeam(v, true);
    });

    $('teamCustomInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('btnTeamCustom').click(); }
    });

    var diffBtns = $('diffPick').querySelectorAll('.dp-btn');
    for (var i = 0; i < diffBtns.length; i++) {
      diffBtns[i].addEventListener('click', function () {
        state.level = parseInt(this.getAttribute('data-lv'), 10);
        save.diff = state.level;
        persist();
        renderDiffPicker();
        renderHome();
      });
    }

    ['homeDiffTabs', 'leagueDiffTabs'].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      var btns = box.querySelectorAll('.dt-btn');
      for (var j = 0; j < btns.length; j++) {
        btns[j].addEventListener('click', function () {
          boardDiff = parseInt(this.getAttribute('data-diff'), 10);
          renderHomeBoard();
          if (state.view === 'league') renderLeagueView();
        });
      }
    });

    $('btnAcceptChallenge').addEventListener('click', function () {
      var c = state.challenge;
      if (!c) { requestStart('all'); return; }
      requestStart(c.mode, { dateKey: c.dateKey, challenge: c, level: c.lv });
    });

    $('btnSkipChallenge').addEventListener('click', function () {
      $('challengeBanner').hidden = true;
      $('homeHero').hidden = false;
      state.challenge = null;
    });

    $('btnChallengeRoom').addEventListener('click', function () {
      showView('league');
      renderLeagueView();
    });

    $('btnQuitQuiz').addEventListener('click', function () {
      if (confirm('진행 중인 퀴즈를 종료하고 홈으로 돌아갈까요?')) {
        clearInterval(state.timer);
        showView('home');
        renderHome();
      }
    });

    $('btnNextQ').addEventListener('click', function () { loadQuestion(state.currIdx + 1); });

    $('btnRetryQuiz').addEventListener('click', function () {
      if (state.challenge) {
        startQuiz(state.mode, { dateKey: state.dateKey, challenge: state.challenge, level: state.level });
      } else {
        showView('home');
        renderHome();
      }
    });

    $('btnCopyShare').addEventListener('click', shareChallenge);

    $('btnCopyCode').addEventListener('click', function () {
      copyText(currentCode(), '결과 코드를 복사했어요. 단톡방에 붙여넣어 보세요!');
    });

    $('btnLeague').addEventListener('click', function () {
      var entry = resultEntry();
      addRoomCode(currentCode());
      boardDiff = state.level;
      showView('league');
      renderLeagueView();
      renderHome();
      if (LIVE.status === 'ready') {
        submitLive(entry).then(function (ok) {
          renderLeagueView(ok ? '실시간 그룹 순위표에 올렸어요!' : '코드 순위표에 올렸어요.');
          renderHome();
        });
      } else {
        renderLeagueView('내 코드를 이번 주 그룹 순위표에 올렸어요.');
      }
    });

    $('btnLiveRetry').addEventListener('click', function () { initLive(true); });

    window.addEventListener('online', function () { initLive(true); });
    window.addEventListener('offline', function () { setLive('offline', '오프라인 상태예요 · 코드 순위표로 참여'); });

    $('btnOpenLeague').addEventListener('click', function () {
      showView('league');
      renderLeagueView();
    });

    $('btnLeaguePlayTop').addEventListener('click', function () { requestStart('all', { level: state.level }); });

    $('btnLeagueBack').addEventListener('click', function () {
      showView('home');
      renderHome();
    });

    $('btnBuildBoard').addEventListener('click', buildBoardFromInput);

    $('btnCopyRoom').addEventListener('click', function () {
      copyText(roomUrl(), '순위표 링크를 복사했어요. 단톡방에 붙여넣으세요!');
    });

    var nickInput = $('nickInput');
    var commitNick = function () {
      save.nick = sanitizeNick(nickInput.value);
      nickInput.value = save.nick;
      persist();
      $('myCode').textContent = currentCode();
      if (LIVE.status === 'ready') submitLive(resultEntry(), true);
    };
    nickInput.addEventListener('blur', commitNick);
    nickInput.addEventListener('change', commitNick);
    nickInput.addEventListener('input', function () { $('myCode').textContent = currentCode(); });
    nickInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitNick(); nickInput.blur(); }
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
  }

  /* ---------------- categories ---------------- */

  function renderHomeCategories() {
    if (!DATA || !DATA.categories) return;
    var grid = $('categoryGrid');
    var html = '';
    DATA.categories.forEach(function (cat) {
      var count = (cat.id === 'all')
        ? DATA.questions.length
        : DATA.questions.filter(function (q) { return q.group === cat.id; }).length;
      html += '<div class="cat-item" data-group="' + cat.id + '">' +
        '<div class="cat-info">' +
          '<div class="cat-icon-box" style="background:var(--grad-' + cat.id + ');">' + cat.icon + '</div>' +
          '<div>' +
            '<h4 class="cat-name">' + esc(cat.name) + '</h4>' +
            '<p class="cat-desc">' + count + '문항 풀 중 오늘 ' + Math.min(dailySize(), count) + '문제 · 10초 스피드런</p>' +
          '</div>' +
        '</div>' +
        '<div class="cat-arrow">→</div>' +
      '</div>';
    });
    grid.innerHTML = html;
    var items = grid.querySelectorAll('.cat-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () { requestStart(this.getAttribute('data-group'), { level: state.level }); });
    }
  }

  /* ---------------- fallback ---------------- */

  function getFallbackData() {
    return {
      meta: { version: '2.0', dailySize: 10 },
      categories: [
        { id: 'all', name: '전체 랜덤', icon: '🎲' },
        { id: 'bts', name: 'BTS 방탄 영역', icon: '💜' },
        { id: 'seventeen', name: '세븐틴 캐럿 영역', icon: '💎' },
        { id: 'skz', name: '스트레이 키즈 영역', icon: '⚡' }
      ],
      tiers: [
        { min: 100, name: '👑 신화급 총괄 덕후 (상위 1%)', desc: '숨소리만 들어도 최애를 맞히는 살아있는 K-pop 백과사전!' },
        { min: 80, name: '💎 성골 1등 덕후 (상위 5%)', desc: '모든 앨범과 명장면을 꿰뚫고 있는 진정한 핵심 팬덤!' },
        { min: 60, name: '🎵 프로 음방 출근러 (상위 20%)', desc: '주요 타이틀곡과 명대사를 막힘없이 읊는 든든한 팬!' },
        { min: 40, name: '🌱 입문 3개월차 새싹 덕후', desc: '알고리즘을 타고 본격적인 입덕의 문턱을 넘는 중!' },
        { min: 0, name: '🎧 머글 탈출 도전 중', desc: '이제 막 K-pop의 무한한 매력에 눈을 뜨기 시작했어요!' }
      ],
      questions: [
        {
          id: 'bts-01', group: 'bts', category: '가사 빈칸', level: 1,
          question: 'BTS \'피 땀 눈물\'의 도입부 가사 "내 피 땀 눈물 내 마지막 ___을 다 가져가"의 빈칸은?',
          choices: ['춤', '숨', '꿈', '맘'], answer: 0,
          explain: '\'내 마지막 춤을 다 가져가\'가 맞습니다.'
        }
      ]
    };
  }

  document.addEventListener('DOMContentLoaded', init);
})();
