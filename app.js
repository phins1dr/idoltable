/* ============================================================
   Idol Quiz — K-pop Speed Trivia Engine
   Pure Vanilla JS (No build, No CDN, No framework)
   ============================================================ */

(function () {
  'use strict';

  var DATA = null;
  var state = {
    view: 'home',
    mode: 'all',
    questions: [],
    currIdx: 0,
    score: 0,
    correctCount: 0,
    timer: null,
    timeLeft: 10,
    startTime: 0,
    totalTimeSpent: 0,
    streak: 1,
    history: {}
  };

  var $ = function (id) { return document.getElementById(id); };

  // Local storage helpers
  var STORAGE_KEY = 'idolquiz_v2_save';
  function loadSaved() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (d) {
        state.streak = d.streak || 1;
        state.history = d.history || {};
      }
    } catch (e) {}
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        streak: state.streak,
        history: state.history,
        lastDate: new Date().toISOString().slice(0, 10)
      }));
    } catch (e) {}
  }

  // Shuffle helper
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Escape HTML
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Switch View
  function showView(viewId) {
    state.view = viewId;
    ['home', 'quiz', 'result'].forEach(function (v) {
      var el = $('view-' + v);
      if (el) el.hidden = (v !== viewId);
    });
    window.scrollTo(0, 0);
  }

  // Load Question Bank
  function init() {
    loadSaved();
    updateHeaderStats();

    fetch('data/kpop_questions.json')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        DATA = json;
        renderHomeCategories();
      })
      .catch(function (err) {
        console.error('Failed to load JSON, using fallback data', err);
        // Fallback embedded if fetch fails
        DATA = getFallbackData();
        renderHomeCategories();
      });

    bindEvents();
  }

  function updateHeaderStats() {
    $('streakVal').textContent = state.streak + '일차';
    var maxScore = 0;
    Object.keys(state.history).forEach(function (k) {
      if (state.history[k] > maxScore) maxScore = state.history[k];
    });
    if (maxScore >= 90) $('badgeVal').textContent = '👑 성골';
    else if (maxScore >= 60) $('badgeVal').textContent = '🎵 프로';
    else $('badgeVal').textContent = '🌱 새싹';
  }

  // Render Home
  function renderHomeCategories() {
    if (!DATA || !DATA.categories) return;

    var grid = $('categoryGrid');
    var html = '';

    DATA.categories.forEach(function (cat) {
      var count = (cat.id === 'all')
        ? DATA.questions.length
        : DATA.questions.filter(function (q) { return q.group === cat.id; }).length;

      var grad = 'var(--grad-' + cat.id + ')';

      html += '<div class="cat-item" data-group="' + cat.id + '">' +
        '<div class="cat-info">' +
          '<div class="cat-icon-box" style="background:' + grad + ';">' + cat.icon + '</div>' +
          '<div>' +
            '<h4 class="cat-name">' + esc(cat.name) + '</h4>' +
            '<p class="cat-desc">' + count + '문항 준비됨 · 10초 스피드런</p>' +
          '</div>' +
        '</div>' +
        '<div class="cat-arrow">→</div>' +
      '</div>';
    });

    grid.innerHTML = html;

    // Attach click
    var items = grid.querySelectorAll('.cat-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        var g = this.getAttribute('data-group');
        startQuiz(g);
      });
    }
  }

  // Start Quiz Run
  function startQuiz(mode) {
    state.mode = mode;
    state.currIdx = 0;
    state.score = 0;
    state.correctCount = 0;
    state.totalTimeSpent = 0;

    // Select questions
    var pool = (mode === 'all')
      ? DATA.questions.slice()
      : DATA.questions.filter(function (q) { return q.group === mode; });

    if (pool.length === 0) pool = DATA.questions.slice();

    state.questions = shuffle(pool).slice(0, Math.min(10, pool.length));

    // Update group tag
    var cat = DATA.categories.filter(function (c) { return c.id === mode; })[0];
    $('qGroupTag').textContent = cat ? (cat.icon + ' ' + cat.name) : '⚡ 올스타 영역';

    showView('quiz');
    loadQuestion(0);
  }

  // Load single question
  function loadQuestion(idx) {
    state.currIdx = idx;
    var q = state.questions[idx];
    if (!q) {
      finishQuiz();
      return;
    }

    $('qCounter').textContent = '문제 ' + (idx + 1) + ' / ' + state.questions.length;
    var pct = Math.round(((idx + 1) / state.questions.length) * 100);
    $('progressFill').style.width = pct + '%';

    $('qCategoryPill').textContent = q.category || '스피드 퀴즈';
    $('qText').textContent = q.question;

    // Prepare randomized choices with correct index tracking
    var originalChoices = q.choices.map(function (c, i) {
      return { text: c, isCorrect: i === q.answer };
    });
    var shuffled = shuffle(originalChoices);

    var list = $('choicesList');
    var letters = ['A', 'B', 'C', 'D'];
    list.innerHTML = '';

    shuffled.forEach(function (item, i) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.type = 'button';
      btn.innerHTML = '<span class="choice-mark">' + letters[i] + '</span><span class="choice-text">' + esc(item.text) + '</span>';
      btn.addEventListener('click', function () {
        submitAnswer(item.isCorrect, btn, shuffled);
      });
      list.appendChild(btn);
    });

    $('feedbackCard').hidden = true;

    // Timer reset & start
    startTimer();
  }

  function startTimer() {
    clearInterval(state.timer);
    state.timeLeft = 10;
    var badge = $('timerBadge');
    var sec = $('timerSec');
    badge.classList.remove('urgent');
    sec.textContent = '10';
    state.startTime = Date.now();

    state.timer = setInterval(function () {
      state.timeLeft--;
      sec.textContent = state.timeLeft;
      if (state.timeLeft <= 3) {
        badge.classList.add('urgent');
      }
      if (state.timeLeft <= 0) {
        clearInterval(state.timer);
        timeOut();
      }
    }, 1000);
  }

  function timeOut() {
    var btns = $('choicesList').querySelectorAll('.choice-btn');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
    showFeedback(false, '시간 초과! 아쉽네요. 다음엔 더 빠르게!');
  }

  function submitAnswer(isCorrect, clickedBtn, choices) {
    clearInterval(state.timer);
    var elapsed = Math.round((Date.now() - state.startTime) / 1000);
    state.totalTimeSpent += elapsed;

    var btns = $('choicesList').querySelectorAll('.choice-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      if (choices[i].isCorrect) {
        btns[i].classList.add('correct');
      }
    }

    if (isCorrect) {
      clickedBtn.classList.add('correct');
      state.score += 10;
      state.correctCount++;
      showFeedback(true, '정답입니다! (+10점)');
    } else {
      clickedBtn.classList.add('wrong');
      showFeedback(false, '아쉽게도 틀렸습니다!');
    }
  }

  function showFeedback(isCorrect, title) {
    var fb = $('feedbackCard');
    var icon = $('verdictIcon');
    var text = $('verdictText');
    var exp = $('explainText');
    var q = state.questions[state.currIdx];

    icon.textContent = isCorrect ? '✓' : '✕';
    icon.parentElement.className = 'verdict-row ' + (isCorrect ? 'ok' : 'bad');
    text.textContent = title;
    exp.textContent = '💡 해설: ' + (q.explain || '정답을 확인하세요.');

    fb.hidden = false;
  }

  function finishQuiz() {
    clearInterval(state.timer);

    // Save score
    state.history[state.mode] = Math.max(state.history[state.mode] || 0, state.score);
    persist();
    updateHeaderStats();

    // Calculate Tier
    var tier = DATA.tiers.filter(function (t) { return state.score >= t.min; })[0] || DATA.tiers[DATA.tiers.length - 1];

    var cat = DATA.categories.filter(function (c) { return c.id === state.mode; })[0];
    $('resTargetGroup').textContent = cat ? (cat.icon + ' ' + cat.name) : '⚡ 올스타 영역';

    $('resTierIcon').textContent = tier.name.split(' ')[0] || '👑';
    $('resTierName').textContent = tier.name.replace(/^[^\s]+\s*/, '');
    $('resTierDesc').textContent = tier.desc;

    $('resScoreNum').textContent = state.score;
    $('resCorrectCount').textContent = state.correctCount + ' / ' + state.questions.length;
    $('resTimeUsed').textContent = state.totalTimeSpent + '초';

    var code = 'IDOL2026.' + state.mode.toUpperCase() + '.' + state.score;
    $('resCodeHash').textContent = code;

    showView('result');
  }

  // Bind UI Events
  function bindEvents() {
    $('brandLogo').addEventListener('click', function (e) {
      e.preventDefault();
      clearInterval(state.timer);
      showView('home');
    });

    $('btnDailyPlay').addEventListener('click', function () {
      startQuiz('all');
    });

    $('btnQuitQuiz').addEventListener('click', function () {
      if (confirm('진행 중인 퀴즈를 종료하고 홈으로 돌아갈까요?')) {
        clearInterval(state.timer);
        showView('home');
      }
    });

    $('btnNextQ').addEventListener('click', function () {
      loadQuestion(state.currIdx + 1);
    });

    $('btnRetryQuiz').addEventListener('click', function () {
      showView('home');
    });

    $('btnCopyShare').addEventListener('click', function () {
      copyShareText();
    });
  }

  function copyShareText() {
    var cat = DATA.categories.filter(function (c) { return c.id === state.mode; })[0];
    var groupName = cat ? cat.name : '올스타 영역';
    var tier = DATA.tiers.filter(function (t) { return state.score >= t.min; })[0] || DATA.tiers[0];

    var text = '⚡ [Idol Quiz K-pop 덕력고사]\n' +
      '🏆 내 등급: ' + tier.name + '\n' +
      '🎯 내 점수: ' + state.score + '점 (' + state.correctCount + '/' + state.questions.length + ' 정답, ' + state.totalTimeSpent + '초)\n' +
      '💜 도전 영역: ' + groupName + '\n' +
      '🔥 너 나 이길 수 있어? 지금 바로 도전해봐!\n' +
      '👉 https://phins1dr.github.io/idoltable/';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showToast);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast();
    }
  }

  function showToast() {
    var t = $('toastPopup');
    t.hidden = false;
    setTimeout(function () { t.hidden = true; }, 2500);
  }

  // Fallback data
  function getFallbackData() {
    return {
      categories: [
        { id: "all", name: "전체 올스타 랜덤", icon: "🎲" },
        { id: "bts", name: "BTS 방탄 영역", icon: "💜" },
        { id: "seventeen", name: "세븐틴 캐럿 영역", icon: "💎" },
        { id: "skz", name: "스트레이 키즈 영역", icon: "⚡" }
      ],
      tiers: [
        { min: 100, name: "👑 신화급 총괄 덕후 (상위 1%)", desc: "숨소리만 들어도 최애를 맞히는 살아있는 K-pop 백과사전!" },
        { min: 80, name: "💎 성골 1등 덕후 (상위 5%)", desc: "모든 앨범과 명장면을 꿰뚫고 있는 진정한 핵심 팬덤!" },
        { min: 60, name: "🎵 프로 음방 출근러 (상위 20%)", desc: "주요 타이틀곡과 명대사는 막힘없이 읊는 든든한 팬!" },
        { min: 40, name: "🌱 입문 3개월차 새싹 덕후", desc: "알고리즘을 타고 본격적인 입덕의 문턱을 넘는 중!" },
        { min: 0, name: "🎧 머글 탈출 도전 중", desc: "이제 막 K-pop의 무한한 매력에 눈을 뜨기 시작했어요!" }
      ],
      questions: [
        {
          id: "bts-01", group: "bts", category: "가사 빈칸",
          question: "BTS '피 땀 눈물'의 도입부 가사 \"내 피 땀 눈물 내 마지막 ___을 다 가져가\"의 빈칸은?",
          choices: ["춤", "숨", "꿈", "맘"], answer: 0,
          explain: "'내 마지막 춤을 다 가져가'가 맞습니다."
        }
      ]
    };
  }

  document.addEventListener('DOMContentLoaded', init);
})();
