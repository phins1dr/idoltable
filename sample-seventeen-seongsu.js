/* ============================================================
   Idol Table — sample route page behaviour
   Only three things: answer the sample quiz, copy the route as
   text, share it. No network calls, no storage, no tracking.
   ============================================================ */
(function () {
  'use strict';

  var ROUTE_TEXT = [
    'SEVENTEEN in Seongsu, in half a day — Idol Table (SAMPLE)',
    '',
    '13:00  1. Seongsu Golmok Guksu (성수 골목국수) — lunch, 45 min — verified',
    '       walk 7 min · 450 m',
    '13:52  2. The Printshop Cafe (인쇄소 카페) — coffee, 60 min — verified',
    '       walk 6 min · 380 m',
    '14:58  3. Brick Warehouse Records (벽돌창고 레코드) — albums & goods, 40 min — verified',
    '       walk 5 min + 1 subway stop (4 min) + 4 min walk',
    '15:50  4. Riverside Roastery (강변 로스터리) — coffee, 60 min — single source',
    '16:50  End · 1 stop from Ttukseom Station',
    '',
    '근거 확인 3곳 / 단일 출처 1곳 · 조립 2026-11-12',
    '영업시간은 방문 전에 확인하세요. 근거는 각 장소 카드에 표기했습니다.',
    'Not affiliated with or endorsed by any agency or artist.',
    'Sample data for review — not verified.'
  ].join('\n');

  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
        function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  /* ---------- quiz ---------- */
  var quiz = Array.prototype.slice.call(document.querySelectorAll('.q'));
  var answered = 0;
  var correct = 0;
  var scoreBox = document.getElementById('score');
  var scoreNum = document.getElementById('scoreNum');
  var scoreLine = document.getElementById('scoreLine');

  var LINES = {
    3: 'All three. Every line on this page can be traced to a source or a rule — that is the whole product.',
    2: 'Two of three. The one you missed is usually the rule other route pages leave out.',
    1: 'One of three. The grades are the point: a page that admits “single” is worth more than one that sounds certain.',
    0: 'None this time — but look at the cards again. Nothing here claims to know what is good.'
  };

  function answer(fieldset, btn) {
    if (fieldset.dataset.done) return;
    fieldset.dataset.done = '1';

    var buttons = Array.prototype.slice.call(fieldset.querySelectorAll('.choice'));
    var isRight = btn.getAttribute('data-ok') === '1';
    answered += 1;
    if (isRight) correct += 1;

    buttons.forEach(function (b) {
      b.disabled = true;
      if (b.getAttribute('data-ok') === '1') b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dim');
    });

    var fb = fieldset.querySelector('.q-fb');
    fb.hidden = false;
    fb.classList.add(isRight ? 'ok' : 'bad');
    fb.innerHTML = '';

    var vf = document.createElement('span');
    vf.className = 'vf';
    vf.textContent = isRight ? 'Correct' : 'Not quite';
    fb.appendChild(vf);

    var body = document.createElement('span');
    body.textContent = fieldset.getAttribute('data-explain') || '';
    fb.appendChild(body);

    var src = document.createElement('span');
    src.className = 'fsrc';
    src.textContent = fieldset.getAttribute('data-src') || '';
    fb.appendChild(src);

    if (answered === quiz.length && scoreBox) {
      scoreNum.textContent = String(correct);
      scoreLine.innerHTML = '';
      var en = document.createElement('span');
      en.textContent = LINES[correct] || '';
      var ko = document.createElement('span');
      ko.className = 'ko-line';
      ko.textContent = '이 코스에서 근거 확인 3곳, 단일 출처 1곳 — 이 숫자도 페이지가 스스로 밝히는 값입니다.';
      scoreLine.appendChild(en);
      scoreLine.appendChild(ko);
      scoreBox.hidden = false;
    }
  }

  quiz.forEach(function (fieldset) {
    var buttons = Array.prototype.slice.call(fieldset.querySelectorAll('.choice'));
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { answer(fieldset, btn); });
    });
  });

  /* ---------- copy / share ---------- */
  var copyBtn = document.getElementById('copyRoute');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      copyText(ROUTE_TEXT).then(function (ok) {
        toast(ok ? 'Route copied as text.' : 'Copy is blocked in this browser — select the text on the page instead.');
      });
    });
  }

  var shareBtn = document.getElementById('shareRoute');
  if (shareBtn) {
    shareBtn.addEventListener('click', function () {
      var payload = {
        title: 'SEVENTEEN in Seongsu, in half a day — Idol Table (sample)',
        text: ROUTE_TEXT
      };
      if (navigator.share) {
        navigator.share(payload).catch(function () { /* user cancelled */ });
      } else {
        copyText(ROUTE_TEXT).then(function (ok) {
          toast(ok ? 'No share sheet here — route copied instead.' : 'Sharing is not available here.');
        });
      }
    });
  }
})();
