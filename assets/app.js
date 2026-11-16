/* ===== 인봉뿌 대시보드 ===== */
(() => {
  'use strict';

  const KEY = 'mongle-family-v1';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = (n) => Number(n || 0).toLocaleString('ko-KR') + '원';
  const pad = (n) => String(n).padStart(2, '0');

  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeText = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  const MEMBERS = {
    mom: { av: 'av-mom', cls: 'mom' },
    dad: { av: 'av-dad', cls: 'dad' },
    kid: { av: 'av-kid', cls: 'kid' }
  };
  const avHTML = (k, cls = 'av') => `<svg class="${cls}" aria-hidden="true"><use href="#${MEMBERS[k].av}"></use></svg>`;

  const DEFAULT_SYNC_URL = 'https://inbongppu-default-rtdb.asia-southeast1.firebasedatabase.app';

  const STICKERS = ['🐱', '🐢', '😻', '🥰', '💗', '⭐', '🍒', '🌈', '🎉', '👏', '🍰', '🐣'];
  const PRAISE = ['최고야!', '사랑해', '고마워', '힘내!'];

  /* ---------------- 상태 ---------------- */
  function freshState() {
    return {
      v: 1,
      updatedAt: Date.now(),
      members: { mom: { name: '엄마' }, dad: { name: '아빠' }, kid: { name: '현' } },
      earnItems: [
        { id: uid(), name: '받아쓰기 1장', amount: 100 },
        { id: uid(), name: '수학 문제집', amount: 200 },
        { id: uid(), name: '책 읽기', amount: 100 },
        { id: uid(), name: '일기 쓰기', amount: 150 }
      ],
      history: [],
      todos: [
        { id: uid(), text: '학교 숙제 끝내기', done: false },
        { id: uid(), text: '책 10쪽 읽기', done: false },
        { id: uid(), text: '양치 3번 하기', done: false }
      ],
      todoDay: dateKey(),
      lastHighFive: null,
      chat: [],
      moments: { mom: { text: '', at: 0 }, dad: { text: '', at: 0 }, kid: { text: '', at: 0 } },
      me: 'mom',
      settings: { pinEnabled: false, pinHash: '', sound: true, syncUrl: DEFAULT_SYNC_URL, syncOn: true },
      alarm: { time: '20:30', on: false },
      timer: { minutes: 20 }
    };
  }

  function normalize(raw) {
    const base = freshState();
    if (!raw || typeof raw !== 'object') return base;
    const s = Object.assign(base, raw);
    s.members = Object.assign(base.members, raw.members || {});
    s.settings = Object.assign(base.settings, raw.settings || {});
    // 예전 저장값(동기화 주소 없음)은 기본 가족 동기화 주소로 올려준다.
    if (raw.settings && raw.settings.syncUrl === '' && raw.settings.syncOn !== false) {
      s.settings.syncUrl = DEFAULT_SYNC_URL;
      s.settings.syncOn = true;
    }
    s.alarm = Object.assign(base.alarm, raw.alarm || {});
    s.timer = Object.assign(base.timer, raw.timer || {});
    ['earnItems', 'history', 'todos', 'chat'].forEach((k) => {
      if (!Array.isArray(s[k])) s[k] = base[k];
    });
    s.moments = Object.assign({}, base.moments, raw.moments || {});
    ['mom', 'dad', 'kid'].forEach((k) => {
      s.moments[k] = Object.assign({ text: '', at: 0 }, s.moments[k] || {});
    });
    return s;
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return freshState();
    }
  }

  function persist(push = true) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장 공간 부족 등 */ }
    if (push) schedulePush();
  }

  function save(push = true) {
    state.updatedAt = Date.now();
    persist(push);
  }

  const balance = () => state.history.reduce((sum, h) => sum + (h.type === 'spend' ? -h.amount : h.amount), 0);
  const todayEarned = () => {
    const t = dateKey();
    return state.history
      .filter((h) => h.type !== 'spend' && dateKey(new Date(h.at)) === t)
      .reduce((s, h) => s + h.amount, 0);
  };

  /* ---------------- 날짜 · 인사 ---------------- */
  function renderHero() {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    $('#heroDate').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
    const done = state.todos.filter((t) => t.done).length;
    $('#statToday').textContent = won(todayEarned());
    $('#statTodo').textContent = `${done} / ${state.todos.length}`;
    const filled = ['mom', 'dad', 'kid'].filter((k) => state.moments[k] && state.moments[k].text).length;
    $('#statMoment').textContent = `${filled} / 3`;
  }

  function renderFamily() {
    const kidName = (state.members.kid && state.members.kid.name) || '현';
    ['#walletKidName', '#todoKidName', '#stampKidName'].forEach((sel) => {
      const el = $(sel);
      if (el) el.textContent = kidName;
    });
    const stack = $('#familyStack');
    stack.innerHTML = ['mom', 'dad', 'kid'].map((k) =>
      `<span class="face ${MEMBERS[k].cls}" title="${esc(state.members[k].name)}">${avHTML(k, 'av')}</span>`
    ).join('');
  }

  /* ---------------- 용돈 ---------------- */
  let editingItem = null;
  let editingHistory = null;

  function renderMoney(animate) {
    const el = $('#balanceText');
    const target = balance();
    const prev = Number(el.dataset.value || 0);
    el.dataset.value = target;
    if (animate && prev !== target) countUp(el, prev, target);
    else el.textContent = won(target);
    const spent = state.history.filter((h) => h.type === 'spend').reduce((s, h) => s + h.amount, 0);
    $('#walletSub').textContent = `오늘 +${won(todayEarned())} · 쓴 돈 ${won(spent)}`;
  }

  function countUp(el, from, to) {
    const start = performance.now();
    const dur = 520;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = won(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = won(to);
    };
    requestAnimationFrame(step);
  }

  function renderEarn() {
    const list = $('#earnList');
    list.innerHTML = '';
    state.earnItems.forEach((item) => {
      const card = document.createElement('div');
      if (editingItem === item.id) {
        card.className = 'earn-card earn-edit';
        card.innerHTML = `
          <input class="e-name" value="${esc(item.name)}" maxlength="18" placeholder="항목 이름">
          <input class="e-amt" type="number" min="0" step="10" value="${item.amount}" placeholder="금액">
          <div class="row2">
            <button class="primary save">저장</button>
            <button class="soft danger del">삭제</button>
          </div>`;
        card.dataset.id = item.id;
      } else {
        card.className = 'earn-card';
        card.innerHTML = `
          <button class="earn-main" data-earn="${item.id}">
            <span class="earn-name">${esc(item.name)}</span>
            <span class="earn-amt">+${won(item.amount)}</span>
          </button>
          <button class="amt-edit" data-edit="${item.id}" aria-label="${esc(item.name)} 금액 수정">✎</button>`;
      }
      list.appendChild(card);
    });
    if (!state.earnItems.length) {
      list.innerHTML = '<p class="hint" style="grid-column:1/-1;text-align:center">공부 항목을 추가해 보세요 🐣</p>';
    }
  }

  function earnItem(id, ev, btn) {
    const item = state.earnItems.find((i) => i.id === id);
    if (!item) return;
    state.history.unshift({ id: uid(), type: 'earn', name: item.name, amount: Number(item.amount) || 0, at: Date.now() });
    state.history = state.history.slice(0, 80);
    save();
    renderMoney(true);
    renderHistory();
    renderHero();
    const r = (btn || ev.currentTarget).getBoundingClientRect();
    coinBurst(r.left + r.width / 2, r.top + r.height / 2, `+${won(item.amount)}`);
    playNotes([880, 1174.7, 1568], 'sine', 0.12);
    toast(`${item.name} +${won(item.amount)} 🪙`);
  }

  function renderHistory() {
    const ul = $('#historyList');
    ul.innerHTML = '';
    if (!state.history.length) {
      ul.innerHTML = '<li class="empty">아직 적립 내역이 없어요 🐣</li>';
      return;
    }
    state.history.slice(0, 30).forEach((h) => {
      const li = document.createElement('li');
      const spend = h.type === 'spend';
      if (editingHistory === h.id) {
        li.className = 'editing';
        li.innerHTML = `
          <input class="h-edit-name" value="${esc(h.name)}" maxlength="20" placeholder="내용">
          <div class="row2">
            <input class="h-edit-amt" type="number" min="0" step="10" value="${h.amount}">
            <button class="soft save">저장</button>
            <button class="soft danger del">삭제</button>
          </div>`;
        li.dataset.id = h.id;
      } else {
        li.innerHTML = `
          <span class="h-name">${esc(h.name)}</span>
          <span class="h-time">${timeText(h.at)}</span>
          <strong class="h-amt ${spend ? 'spend' : ''}">${spend ? '−' : '+'}${won(h.amount)}</strong>
          <button class="h-edit" data-h-edit="${h.id}" aria-label="수정">✎</button>`;
        li.dataset.id = h.id;
      }
      ul.appendChild(li);
    });
  }

  /* ---------------- 할 일 ---------------- */
  function renderTodos() {
    const ul = $('#todoList');
    ul.innerHTML = '';
    state.todos.forEach((t) => {
      const li = document.createElement('li');
      li.className = t.done ? 'done' : '';
      li.dataset.id = t.id;
      li.innerHTML = `
        <button class="t-check" data-toggle="${t.id}" aria-label="${t.done ? '완료 취소' : '완료'}">✓</button>
        <span class="t-text">${esc(t.text)}</span>
        <button class="t-del" data-del="${t.id}" aria-label="삭제">✕</button>`;
      ul.appendChild(li);
    });
    if (!state.todos.length) ul.innerHTML = '<li class="empty">오늘의 할 일을 추가해 보세요 🐣</li>';

    const done = state.todos.filter((t) => t.done).length;
    const total = state.todos.length;
    $('#todoPill').textContent = `${done} / ${total}`;
    $('#todoBar').style.width = total ? `${(done / total) * 100}%` : '0%';
    renderHero();
  }

  function toggleTodo(id, ev) {
    const t = state.todos.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    save();
    renderTodos();
    playNotes([t.done ? 740 : 420], 'sine', 0.1);
    if (t.done) {
      const allDone = state.todos.length > 0 && state.todos.every((x) => x.done);
      if (allDone && state.lastHighFive !== dateKey()) {
        state.lastHighFive = dateKey();
        save();
        setTimeout(showHighFive, 260);
      }
    }
  }

  /* ---------------- 채팅 ---------------- */
  function renderWho() {
    const box = $('#whoSwitch');
    box.innerHTML = ['mom', 'dad', 'kid'].map((k) =>
      `<button class="who-btn ${state.me === k ? 'on' : ''}" data-me="${k}">
        ${avHTML(k, 'av')} ${esc(state.members[k].name)}
      </button>`
    ).join('');
  }

  function renderChat() {
    const body = $('#chatBody');
    body.innerHTML = '';
    if (!state.chat.length) {
      body.innerHTML = `<div class="chat-empty">
        <svg aria-hidden="true"><use href="#ch-cat"></use></svg>
        아직 대화가 없어요.<br>먼저 인사를 건네볼까요? 🐱🐢
      </div>`;
      return;
    }
    state.chat.slice(-120).forEach((m) => {
      const who = m.who || 'mom';
      const mine = who === state.me;
      const div = document.createElement('div');
      div.className = `msg ${mine ? 'mine' : ''} ${MEMBERS[who].cls}`;
      const name = state.members[who] ? state.members[who].name : who;
      const isSticker = m.kind === 'sticker';
      const isPraise = m.kind === 'praise';
      div.innerHTML = `
        <span class="avatar">${avHTML(who, 'av')}</span>
        <div class="bubble-wrap">
          ${mine ? '' : `<span class="bubble-name">${esc(name)}</span>`}
          <div class="bubble ${isSticker ? 'sticker' : ''} ${isPraise ? 'praise' : ''}">${esc(m.text)}</div>
          <span class="bubble-time">${timeText(m.at)}</span>
        </div>
        <button class="msg-del" data-del-msg="${m.id}" aria-label="메시지 삭제">✕</button>`;
      body.appendChild(div);
    });
    body.scrollTop = body.scrollHeight;
  }

  function buildStickerTray() {
    const tray = $('#stickerTray');
    tray.innerHTML = STICKERS.map((s) => `<button type="button" data-sticker="${s}">${s}</button>`).join('')
      + PRAISE.map((p) => `<button type="button" class="praise-btn" data-praise="${esc(p)}">${esc(p)} 💗</button>`).join('');
    const hint = document.createElement('p');
    hint.className = 'hint tiny';
    hint.style.gridColumn = '1 / -1';
    hint.style.margin = '2px 0 0';
    hint.textContent = '스티커나 칭찬 한 마디를 골라 보내보세요!';
    tray.appendChild(hint);
  }

  function sendChat(text, kind) {
    const msg = { id: uid(), who: state.me, text, at: Date.now() };
    if (kind) msg.kind = kind;
    state.chat.push(msg);
    if (state.chat.length > 300) state.chat = state.chat.slice(-300);
    save();
    renderChat();
    playNotes(kind === 'sticker' ? [880, 1046] : [660], 'sine', 0.09);
  }

  /* ---------------- 타이머 ---------------- */
  const timer = { minutes: state.timer.minutes || 20, total: (state.timer.minutes || 20) * 60, left: (state.timer.minutes || 20) * 60, running: false, endAt: 0, id: null };
  const RING = 2 * Math.PI * 52;

  function renderTimerStatic() {
    $('#ringFg').style.strokeDasharray = RING.toFixed(1);
    $$('#durRow .dur').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.min) === timer.minutes));
    $('#alarmTime').value = state.alarm.time || '20:30';
    $('#alarmOn').checked = !!state.alarm.on;
    updateTimerUI();
  }

  function updateTimerUI() {
    const mm = Math.floor(timer.left / 60);
    const ss = timer.left % 60;
    $('#timerTime').textContent = `${pad(mm)}:${pad(ss)}`;
    const p = timer.total ? timer.left / timer.total : 0;
    $('#ringFg').style.strokeDashoffset = (RING * (1 - p)).toFixed(1);
    $('#timerState').textContent = timer.running ? '공부 중 🐱' : (timer.left === timer.total ? '준비' : (timer.left === 0 ? '끝!' : '잠시 멈춤'));
    $('#timerStart').textContent = timer.running ? '일시정지' : (timer.left === 0 ? '다시 시작' : '시작');
    $('#timer').classList.toggle('ticking', timer.running);
    $('.timer-ring').classList.toggle('ticking', timer.running);
  }

  function setMinutes(min) {
    if (timer.running) stopTimer();
    timer.minutes = min;
    timer.total = min * 60;
    timer.left = timer.total;
    state.timer.minutes = min;
    save();
    renderTimerStatic();
  }

  function startTimer() {
    if (timer.running) { stopTimer(); return; }
    if (timer.left <= 0) timer.left = timer.total;
    timer.running = true;
    timer.endAt = Date.now() + timer.left * 1000;
    playNotes([660, 880], 'sine', 0.1);
    timer.id = setInterval(() => {
      const left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
      timer.left = left;
      updateTimerUI();
      if (left <= 0) {
        stopTimer(true);
        showRest('timer');
      }
    }, 250);
    updateTimerUI();
  }

  function stopTimer(finished) {
    timer.running = false;
    clearInterval(timer.id);
    timer.id = null;
    if (!finished) updateTimerUI();
    else { timer.left = timer.total; updateTimerUI(); }
  }

  function resetTimer() {
    stopTimer();
    timer.left = timer.total;
    updateTimerUI();
  }

  /* ---------------- 알람 ---------------- */
  let lastAlarmKey = '';

  function checkAlarm() {
    if (!state.alarm.on) return;
    const now = new Date();
    const [h, m] = (state.alarm.time || '20:30').split(':').map(Number);
    const key = `${dateKey(now)} ${h}:${m}`;
    if (now.getHours() === h && now.getMinutes() === m && lastAlarmKey !== key) {
      lastAlarmKey = key;
      showRest('alarm');
    }
  }

  /* ---------------- 사운드 ---------------- */
  let audioCtx = null;
  function audio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playNotes(freqs, type = 'sine', dur = 0.16, gain = 0.16) {
    if (!state.settings.sound) return;
    const ctx = audio();
    if (!ctx) return;
    freqs.forEach((f, i) => {
      const t0 = ctx.currentTime + i * (dur * 0.92);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    });
  }

  function alarmSound() {
    playNotes([880, 0, 880, 0, 880, 0, 1108], 'sine', 0.22, 0.22);
    setTimeout(() => playNotes([784, 988, 1174, 1568], 'sine', 0.2, 0.2), 1900);
  }

  /* ---------------- 효과 ---------------- */
  function coinBurst(x, y, label) {
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('div');
      el.className = 'coin-fly';
      const dx = (Math.random() - 0.5) * 260;
      const dy = -90 - Math.random() * 200;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--dx', dx.toFixed(0) + 'px');
      el.style.setProperty('--dy', dy.toFixed(0) + 'px');
      el.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      el.style.animationDelay = (i * 22) + 'ms';
      el.innerHTML = (i % 4 === 0)
        ? `<svg viewBox="0 0 32 32" width="30" height="30"><use href="#part-star" style="color:#FFC46B"/></svg>`
        : `<svg viewBox="0 0 40 40" width="30" height="30"><use href="#coin"/></svg>`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }
    if (label) {
      const t = document.createElement('div');
      t.className = 'float-text';
      t.textContent = label;
      t.style.left = x + 'px';
      t.style.top = (y - 10) + 'px';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1200);
    }
  }

  function confetti() {
    const box = $('#confetti');
    box.innerHTML = '';
    const colors = ['#FFB6C9', '#FFD971', '#9BD8B6', '#8FCBF5', '#D9C2FF', '#FFC59B'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
      p.style.animationDelay = (Math.random() * 0.7) + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (i % 3 === 0) { p.style.width = '8px'; p.style.height = '8px'; p.style.borderRadius = '50%'; }
      box.appendChild(p);
    }
  }

  let toastTimer = null;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* ---------------- 오버레이 ---------------- */
  function showHighFive() {
    $('#highFive').hidden = false;
    confetti();
    playNotes([523.3, 659.3, 784, 1046.5, 1318.5], 'sine', 0.15, 0.2);
    setTimeout(() => playNotes([1046.5, 1318.5, 1568], 'triangle', 0.12, 0.14), 700);
  }

  function showRest(kind) {
    const isAlarm = kind === 'alarm';
    $('#restKicker').textContent = isAlarm ? '태블릿 끄는 시간' : '공부 타이머 종료';
    $('#restTitle').textContent = isAlarm ? '이제 태블릿 그만! 🐢' : '공부 끝! 🐱';
    $('#restMsg').textContent = isAlarm
      ? '오늘 공부 열심히 했어요. 화면을 끄고 푹 쉬어요 🌙'
      : '눈을 한 번 감고, 물 한 잔 마셔요 💧';
    $('#restModal').hidden = false;
    alarmSound();
    if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {} }
  }

  /* ---------------- PIN ---------------- */
  let pinBuffer = '';
  let pinPurpose = 'unlock';

  async function hashPin(pin) {
    try {
      const data = new TextEncoder().encode('mongle-family:' + pin);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return 'plain:' + pin;
    }
  }

  function buildKeypad() {
    const pad = $('#keypad');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'ok'];
    pad.innerHTML = keys.map((k) => {
      if (k === 'clear') return '<button class="key-fn" data-key="clear">지우기</button>';
      if (k === 'ok') return '<button class="key-fn" data-key="ok">확인</button>';
      return `<button data-key="${k}">${k}</button>`;
    }).join('');
  }

  function updatePinDots() {
    $$('#pinDots i').forEach((dot, i) => dot.classList.toggle('on', i < pinBuffer.length));
  }

  function showLock() {
    pinBuffer = '';
    updatePinDots();
    $('#lockMsg').textContent = '';
    $('#lockScreen').hidden = false;
    $('#app').setAttribute('aria-hidden', 'true');
  }

  function hideLock() {
    $('#lockScreen').hidden = true;
    $('#app').removeAttribute('aria-hidden');
  }

  async function tryUnlock() {
    if (pinBuffer.length !== 4) return;
    const h = await hashPin(pinBuffer);
    if (h === state.settings.pinHash) {
      hideLock();
      playNotes([659, 880], 'sine', 0.1);
    } else {
      $('#lockMsg').textContent = 'PIN이 맞지 않아요 🐢 다시 눌러주세요';
      $('.lock-inner').classList.add('shake');
      setTimeout(() => $('.lock-inner').classList.remove('shake'), 450);
      playNotes([300], 'square', 0.15);
      pinBuffer = '';
      updatePinDots();
    }
  }

  /* ---------------- 설정 ---------------- */
  function openSettings() {
    $('#nameMom').value = state.members.mom.name;
    $('#nameDad').value = state.members.dad.name;
    $('#nameKid').value = state.members.kid.name;
    $('#pinToggle').checked = !!state.settings.pinEnabled;
    $('#pinSet').hidden = !state.settings.pinEnabled;
    $('#pinInput').value = '';
    $('#soundToggle').checked = !!state.settings.sound;
    $('#syncUrl').value = state.settings.syncUrl || '';
    setSyncStatus(state.settings.syncUrl ? '가족 동기화 주소: ' + state.settings.syncUrl : '로컬 저장만 사용 중', state.settings.syncUrl ? 'ok' : '');
    $('#settingsModal').hidden = false;
  }

  function saveNames() {
    state.members.mom.name = ($('#nameMom').value || '엄마').slice(0, 8);
    state.members.dad.name = ($('#nameDad').value || '아빠').slice(0, 8);
    state.members.kid.name = ($('#nameKid').value || '현').slice(0, 8);
    save();
    renderFamily();
    renderWho();
    renderChat();
    renderPhrases();
    toast('이름을 저장했어요 🐾');
  }

  /* ---------------- 동기화 (Firebase Realtime Database) ---------------- */
  const sync = { ref: null, applying: false, timer: null, ready: false };

  function setSyncStatus(text, cls = '') {
    const el = $('#syncStatus');
    el.textContent = text;
    el.className = 'hint tiny ' + cls;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('스크립트를 불러오지 못했어요 (인터넷 연결 확인)'));
      document.head.appendChild(s);
    });
  }

  function unionById(a = [], b = []) {
    const map = new Map();
    [...a, ...b].forEach((x) => { if (x && x.id) map.set(x.id, x); });
    return Array.from(map.values());
  }

  function mergeRemote(remote) {
    const merged = Object.assign({}, state, remote);
    merged.history = unionById(state.history, remote.history).sort((x, y) => y.at - x.at).slice(0, 80);
    merged.chat = unionById(state.chat, remote.chat).sort((x, y) => x.at - y.at).slice(-300);
    merged.settings = state.settings;      // PIN·소리·주소는 이 기기 설정 유지
    merged.members = Object.assign({}, remote.members || state.members);
    merged.moments = {};
    ['mom', 'dad', 'kid'].forEach((k) => {
      const l = (state.moments && state.moments[k]) || { text: '', at: 0 };
      const r = (remote.moments && remote.moments[k]) || { text: '', at: 0 };
      merged.moments[k] = (r.at || 0) > (l.at || 0) ? r : l;
    });
    merged.updatedAt = Math.max(state.updatedAt || 0, remote.updatedAt || 0);
    return merged;
  }

  function hasLocalContent() {
    return !!((state.history && state.history.length) ||
      (state.chat && state.chat.length) ||
      ['mom', 'dad', 'kid'].some((k) => state.moments && state.moments[k] && state.moments[k].text) ||
      (state.todos && state.todos.some((t) => t.done)));
  }

  // 새 기기에서 기본값이 가족 데이터를 덮어쓰지 않도록, 먼저 Firebase에서 기존 데이터를 확인한다.
  async function primeFromRemote() {
    const url = (state.settings.syncUrl || '').trim();
    if (!url) return;
    try {
      const res = await fetch(url.replace(/\/$/, '') + '/mongleFamily/main.json', { cache: 'no-store' });
      if (!res.ok) return;
      const remote = await res.json();
      if (!remote || !remote.updatedAt) return;
      const remoteWins = !hasLocalContent() || (remote.updatedAt || 0) > (state.updatedAt || 0) + 60;
      if (!remoteWins) return;
      sync.applying = true;
      state = normalize(mergeRemote(remote));
      persist(false);
      renderAll();
      sync.applying = false;
      setSyncStatus('가족 데이터를 불러왔어요 🐱', 'ok');
    } catch (e) {
      /* 오프라인이거나 규칙이 막혀 있으면 로컬로 계속 동작 */
    }
  }

  async function connectSync(urlOverride) {
    const url = (urlOverride != null ? urlOverride : ($('#syncUrl').value || '')).trim();
    state.settings.syncUrl = url;
    state.settings.syncOn = !!url;
    save();
    if (sync.ref) { try { sync.ref.off(); } catch (e) {} sync.ref = null; }
    if (!url) { setSyncStatus('로컬 저장만 사용 중', ''); toast('동기화를 끄고 이 기기에만 저장해요 🐢'); return; }
    setSyncStatus('연결하는 중…', '');
    try {
      if (!window.firebase) {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
      }
      // 주소가 실제로 존재하는지 먼저 확인 (없으면 안내)
      let reachable = true;
      try {
        const probe = await fetch(url.replace(/\/$/, '') + '/mongleFamily/main.json', { cache: 'no-store' });
        if (probe.status === 404) {
          reachable = false;
          setSyncStatus('동기화 주소를 찾지 못했어요 — Firebase에서 Realtime Database를 먼저 만들어 주세요', 'err');
        }
      } catch (e) {
        setSyncStatus('동기화 주소를 확인하지 못했어요 (인터넷 연결 확인)', 'err');
      }
      if (!firebase.apps.length) firebase.initializeApp({ databaseURL: url });
      sync.ref = firebase.database().ref('mongleFamily/main');
      sync.ready = true;
      sync.ref.on('value', (snap) => {
        const remote = snap.val();
        if (!reachable) return;
        if (!remote || !remote.updatedAt) { pushNow(); setSyncStatus('실시간 동기화 연결됨 🐱', 'ok'); return; }
        if ((remote.updatedAt || 0) > (state.updatedAt || 0) + 60) {
          try {
            sync.applying = true;
            state = normalize(mergeRemote(remote));
            persist(false);
            renderAll();
          } finally {
            sync.applying = false;
          }
        }
        setSyncStatus('실시간 동기화 연결됨 🐱', 'ok');
      }, (err) => {
        setSyncStatus('동기화 오류: ' + err.message, 'err');
      });
    } catch (e) {
      sync.ref = null;
      setSyncStatus('연결 실패: ' + e.message, 'err');
      console.warn('[sync]', e);
      toast('동기화 연결에 실패했어요. 주소와 규칙을 확인해 주세요.');
    }
  }

  function schedulePush() {
    if (!sync.ref || sync.applying) return;
    clearTimeout(sync.timer);
    sync.timer = setTimeout(pushNow, 500);
  }

  function pushNow() {
    if (!sync.ref || sync.applying) return;
    try {
      sync.ref.set(JSON.parse(JSON.stringify(state))).catch(() => {
        setSyncStatus('동기화 쓰기 실패 — Firebase 규칙(쓰기 허용)을 확인해 주세요', 'err');
      });
    } catch (e) {
      setSyncStatus('동기화 실패: ' + e.message, 'err');
    }
  }

  /* ---------------- 오늘의 한마디 ---------------- */
  function phraseRow(who) { return $(`.phrase-row[data-who="${who}"]`); }

  function setPhraseStatus(text) {
    const el = $('#phraseStatus');
    if (el) el.textContent = text;
  }

  function renderPhrases() {
    ['mom', 'dad', 'kid'].forEach((k) => {
      const row = phraseRow(k);
      if (!row) return;
      const m = (state.moments && state.moments[k]) || { text: '', at: 0 };
      const input = $('.p-input', row);
      if (input && document.activeElement !== input) input.value = m.text || '';
      const name = $('.p-name', row);
      if (name && state.members[k]) name.textContent = state.members[k].name;
      const ph = $('.p-input', row);
      if (ph) ph.placeholder = `오늘 ${(state.members[k] && state.members[k].name) || ''}의 한마디`;
    });
  }

  function savePhrase(who, text, notify) {
    const clean = String(text || '').trim().slice(0, 80);
    const prev = state.moments[who] || { text: '', at: 0 };
    if (prev.text === clean && prev.at && notify) {
      setPhraseStatus('이미 저장되어 있어요 🐾');
      return;
    }
    state.moments[who] = { text: clean, at: Date.now() };
    save();
    renderHero();
    const row = phraseRow(who);
    if (row) {
      row.classList.remove('saved');
      void row.offsetWidth;
      row.classList.add('saved');
    }
    const name = (state.members[who] && state.members[who].name) || who;
    if (notify) {
      playNotes([740, 988], 'sine', 0.09);
      setPhraseStatus(clean ? `${name} 한마디를 저장했어요 · ${timeText(Date.now())}` : `${name} 칸을 비웠어요`);
    } else {
      setPhraseStatus(`${name} 한마디를 저장했어요 · ${timeText(Date.now())}`);
    }
  }

  function deletePhrase(who) {
    state.moments[who] = { text: '', at: Date.now() };
    save();
    renderHero();
    const row = phraseRow(who);
    if (row) {
      const input = $('.p-input', row);
      if (input) input.value = '';
    }
    playNotes([420], 'sine', 0.09);
    const name = (state.members[who] && state.members[who].name) || who;
    setPhraseStatus(`${name} 칸을 지웠어요 🐢`);
  }

  /* ---------------- 렌더 ---------------- */
  function renderAll() {
    renderHero();
    renderFamily();
    renderMoney();
    renderEarn();
    renderHistory();
    renderTodos();
    renderWho();
    renderChat();
    renderPhrases();
    renderTimerStatic();
  }

  /* ---------------- 이벤트 ---------------- */
  function bind() {
    // 용돈
    $('#earnList').addEventListener('click', (e) => {
      const earnBtn = e.target.closest('[data-earn]');
      if (earnBtn) { earnItem(earnBtn.dataset.earn, e, earnBtn); return; }
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) { editingItem = editBtn.dataset.edit; renderEarn(); return; }
      const card = e.target.closest('.earn-card');
      if (card && card.classList.contains('earn-edit')) {
        const id = card.dataset.id;
        const item = state.earnItems.find((i) => i.id === id);
        if (!item) return;
        if (e.target.closest('.save')) {
          const name = $('.e-name', card).value.trim() || item.name;
          const amount = Math.max(0, Number($('.e-amt', card).value) || 0);
          item.name = name;
          item.amount = amount;
          editingItem = null;
          save();
          renderEarn();
          toast('항목을 저장했어요 ✎');
        } else if (e.target.closest('.del')) {
          state.earnItems = state.earnItems.filter((i) => i.id !== id);
          editingItem = null;
          save();
          renderEarn();
        }
      }
    });

    $('#addItemBtn').addEventListener('click', () => {
      const item = { id: uid(), name: '새 공부 항목', amount: 100 };
      state.earnItems.push(item);
      editingItem = item.id;
      save();
      renderEarn();
      const card = $('#earnList .earn-edit:last-child');
      if (card) { $('.e-name', card).focus(); $('.e-name', card).select(); }
    });

    $('#spendBtn').addEventListener('click', () => {
      const input = prompt('쓴 금액을 적어주세요 (예: 500)\n취소를 누르면 그대로 둬요.', '500');
      if (input === null) return;
      const amount = Math.max(0, Number(String(input).replace(/[^0-9]/g, '')) || 0);
      if (!amount) { toast('금액을 숫자로 적어주세요 🐢'); return; }
      const memo = prompt('무엇에 썼나요? (예: 문구점)', '간식') || '사용';
      state.history.unshift({ id: uid(), type: 'spend', name: memo, amount, at: Date.now() });
      save();
      renderMoney(true);
      renderHistory();
      renderHero();
      playNotes([520, 400], 'sine', 0.1);
      toast(`−${won(amount)} 기록했어요`);
    });

    // 내역 수정
    $('#historyList').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-h-edit]');
      if (editBtn) { editingHistory = editBtn.dataset.hEdit; renderHistory(); return; }
      const li = e.target.closest('li.editing');
      if (!li) return;
      const h = state.history.find((x) => x.id === li.dataset.id);
      if (!h) return;
      if (e.target.closest('.save')) {
        h.name = $('.h-edit-name', li).value.trim() || h.name;
        h.amount = Math.max(0, Number($('.h-edit-amt', li).value) || 0);
        editingHistory = null;
        save();
        renderMoney(true);
        renderHistory();
        renderHero();
      } else if (e.target.closest('.del')) {
        state.history = state.history.filter((x) => x.id !== h.id);
        editingHistory = null;
        save();
        renderMoney(true);
        renderHistory();
        renderHero();
      }
    });

    // 할 일
    $('#todoList').addEventListener('click', (e) => {
      const t = e.target.closest('[data-toggle]');
      if (t) { toggleTodo(t.dataset.toggle, e); return; }
      const d = e.target.closest('[data-del]');
      if (d) {
        state.todos = state.todos.filter((x) => x.id !== d.dataset.del);
        save();
        renderTodos();
      }
    });

    $('#todoForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#todoInput');
      const text = input.value.trim();
      if (!text) return;
      state.todos.push({ id: uid(), text, done: false });
      input.value = '';
      save();
      renderTodos();
      playNotes([700], 'sine', 0.08);
    });

    // 오늘의 한마디 (한 줄 입력 · 저장 · 삭제)
    const phraseList = $('#phraseList');
    phraseList.addEventListener('click', (e) => {
      const row = e.target.closest('.phrase-row');
      if (!row) return;
      const who = row.dataset.who;
      if (e.target.closest('.p-save')) {
        savePhrase(who, $('.p-input', row).value, true);
        return;
      }
      if (e.target.closest('.p-del')) deletePhrase(who);
    });
    phraseList.addEventListener('keydown', (e) => {
      const input = e.target.closest('.p-input');
      if (!input) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const who = input.closest('.phrase-row').dataset.who;
        savePhrase(who, input.value, true);
        input.blur();
      }
    });

    // 채팅
    $('#whoSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('[data-me]');
      if (!b) return;
      state.me = b.dataset.me;
      save();
      renderWho();
      renderChat();
    });
    $('#stickerBtn').addEventListener('click', () => {
      const tray = $('#stickerTray');
      tray.hidden = !tray.hidden;
      if (!tray.hidden) tray.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('#stickerTray').addEventListener('click', (e) => {
      const s = e.target.closest('[data-sticker]');
      if (s) { sendChat(s.dataset.sticker, 'sticker'); return; }
      const p = e.target.closest('[data-praise]');
      if (p) { sendChat(p.dataset.praise, 'praise'); }
    });
    $('#chatBody').addEventListener('click', (e) => {
      const b = e.target.closest('[data-del-msg]');
      if (!b) return;
      const id = b.dataset.delMsg;
      state.chat = state.chat.filter((m) => m.id !== id);
      save();
      renderChat();
      playNotes([420], 'sine', 0.08);
      toast('메시지를 지웠어요 🐱');
    });
    $('#clearChat').addEventListener('click', () => {
      if (!state.chat.length) { toast('지울 대화가 없어요 🐢'); return; }
      if (!confirm('가족 채팅 내역을 모두 지울까요? (되돌릴 수 없어요)')) return;
      state.chat = [];
      save();
      renderChat();
      playNotes([520, 400], 'sine', 0.1);
      toast('채팅방을 비웠어요 🐢');
    });
    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendChat(text, 'text');
    });

    // 타이머
    $('#durRow').addEventListener('click', (e) => {
      const b = e.target.closest('.dur');
      if (!b) return;
      if (b.dataset.min === 'custom') {
        $('#durCustom').hidden = false;
        $('#customMin').focus();
        $$('#durRow .dur').forEach((x) => x.classList.remove('is-on'));
        b.classList.add('is-on');
        return;
      }
      $('#durCustom').hidden = true;
      setMinutes(Number(b.dataset.min));
    });
    $('#customApply').addEventListener('click', () => {
      const v = Math.min(180, Math.max(1, Number($('#customMin').value) || 0));
      if (!v) { toast('분을 적어주세요 🐢'); return; }
      $('#durCustom').hidden = true;
      setMinutes(v);
      toast(`${v}분으로 맞췄어요 ⏰`);
    });
    $('#timerStart').addEventListener('click', startTimer);
    $('#timerReset').addEventListener('click', resetTimer);

    $('#alarmTime').addEventListener('change', () => {
      state.alarm.time = $('#alarmTime').value || '20:30';
      lastAlarmKey = '';
      save();
      updateAlarmHint();
    });
    $('#alarmOn').addEventListener('change', () => {
      state.alarm.on = $('#alarmOn').checked;
      lastAlarmKey = '';
      save();
      updateAlarmHint();
      if (state.alarm.on) {
        playNotes([784, 988], 'sine', 0.12);
        toast(`매일 ${state.alarm.time}에 태블릿 종료 알람이 떠요 ⏰`);
      }
    });
    $('#alarmTest').addEventListener('click', () => showRest('alarm'));

    // 오버레이 닫기
    $('#hfClose').addEventListener('click', () => { $('#highFive').hidden = true; });
    $('#restClose').addEventListener('click', () => { $('#restModal').hidden = true; });

    // 설정
    $('#settingsBtn').addEventListener('click', openSettings);
    $('#settingsClose').addEventListener('click', () => { $('#settingsModal').hidden = true; });
    $('#settingsModal').addEventListener('click', (e) => {
      if (e.target === $('#settingsModal')) $('#settingsModal').hidden = true;
    });
    ['nameMom', 'nameDad', 'nameKid'].forEach((id) => {
      $('#' + id).addEventListener('change', saveNames);
    });
    $('#pinToggle').addEventListener('change', () => {
      const on = $('#pinToggle').checked;
      $('#pinSet').hidden = !on;
      if (on) {
        $('#pinInput').focus();
        return;
      }
      state.settings.pinEnabled = false;
      state.settings.pinHash = '';
      save();
      toast('PIN 잠금을 껐어요');
    });
    $('#pinSave').addEventListener('click', async () => {
      const pin = ($('#pinInput').value || '').replace(/[^0-9]/g, '');
      if (pin.length !== 4) { toast('숫자 4자리를 입력해 주세요 🐢'); return; }
      state.settings.pinHash = await hashPin(pin);
      state.settings.pinEnabled = true;
      $('#pinToggle').checked = true;
      save();
      $('#pinInput').value = '';
      toast('가족 PIN을 저장했어요 🔒');
    });
    $('#soundToggle').addEventListener('change', () => {
      state.settings.sound = $('#soundToggle').checked;
      save();
      if (state.settings.sound) playNotes([660, 880], 'sine', 0.1);
    });
    $('#syncSave').addEventListener('click', connectSync);
    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mongle-family-backup-${dateKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('정말 모든 기록을 지우고 처음 상태로 돌아갈까요?')) return;
      localStorage.removeItem(KEY);
      location.reload();
    });

    // 잠금
    $('#lockBtn').addEventListener('click', () => {
      if (!state.settings.pinEnabled || !state.settings.pinHash) {
        toast('설정에서 가족 PIN을 먼저 켜주세요 🔒');
        return;
      }
      showLock();
    });
    $('#keypad').addEventListener('click', (e) => {
      const b = e.target.closest('[data-key]');
      if (!b) return;
      const k = b.dataset.key;
      if (k === 'clear') { pinBuffer = ''; updatePinDots(); return; }
      if (k === 'ok') { tryUnlock(); return; }
      if (pinBuffer.length < 4) {
        pinBuffer += k;
        updatePinDots();
        playNotes([720 + pinBuffer.length * 90], 'sine', 0.06, 0.1);
        if (pinBuffer.length === 4) setTimeout(tryUnlock, 160);
      }
    });

    // 메뉴 활성 표시
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        $$('.chip').forEach((c) => c.classList.toggle('on', c.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => obs.observe(s));

    // 첫 사용자 동작에서 오디오 활성화
    const unlockAudio = () => { audio(); document.removeEventListener('pointerdown', unlockAudio); };
    document.addEventListener('pointerdown', unlockAudio, { once: true });

    window.addEventListener('beforeunload', () => { if (sync.ref) pushNow(); });
  }

  function updateAlarmHint() {
    const on = state.alarm.on;
    $('#alarmHint').textContent = on
      ? `켜짐 · 매일 ${state.alarm.time}에 화면 가득 종료 안내가 떠요 (이 화면을 켜둔 동안)`
      : '알람을 켜두면 그 시각에 화면 가득 종료 안내가 떠요.';
  }

  /* ---------------- 시작 ---------------- */
  function boot() {
    // 날짜가 바뀌면 할 일·오늘 미션은 새로 시작
    const t = dateKey();
    if (state.todoDay !== t) {
      state.todos.forEach((x) => { x.done = false; });
      state.todoDay = t;
      state.lastHighFive = null;
      save();
    }

    buildKeypad();
    buildStickerTray();
    renderAll();
    updateAlarmHint();
    bind();
    setInterval(checkAlarm, 1000);
    setPhraseStatus('각 칸에 한 줄씩 적고 저장을 눌러보세요 🐾');

    if (state.settings.pinEnabled && state.settings.pinHash) showLock();

    if (state.settings.syncUrl) {
      $('#syncUrl').value = state.settings.syncUrl;
      setSyncStatus('동기화 다시 연결하는 중…');
      primeFromRemote().then(() => connectSync(state.settings.syncUrl));
    }
  }

  boot();
})();
