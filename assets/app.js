/* ===== 몽글 가족 대시보드 ===== */
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
    mom: { emoji: '🐱', cls: 'mom' },
    dad: { emoji: '🐢', cls: 'dad' },
    kid: { emoji: '🐰', cls: 'kid' }
  };

  const DEFAULT_MISSIONS = [
    '가족이랑 사진 한 장 찍기 📸',
    '엄마·아빠에게 사랑한다고 말하기 💗',
    '책 5쪽 소리 내어 읽기 📖',
    '오늘 기분 한 줄 일기 쓰기 ✏️',
    '가족 중 한 명 도와주기 🤝',
    '10분 동안 스트레칭 하기 🧘',
    '산책 15분 다녀오기 🐾',
    '노래 한 곡 같이 부르기 🎵',
    '설거지 하나 돕기 🍽️',
    '오늘 고마운 일 하나 말하기 🌼'
  ];

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
      missions: DEFAULT_MISSIONS.map((text) => ({ id: uid(), text })),
      todayMission: null,
      stamps: [],
      chat: [],
      me: 'mom',
      settings: { pinEnabled: false, pinHash: '', sound: true, syncUrl: '' },
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
    s.alarm = Object.assign(base.alarm, raw.alarm || {});
    s.timer = Object.assign(base.timer, raw.timer || {});
    ['earnItems', 'history', 'todos', 'missions', 'stamps', 'chat'].forEach((k) => {
      if (!Array.isArray(s[k])) s[k] = base[k];
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
  function greet() {
    const h = new Date().getHours();
    if (h < 6) return '늦은 밤에도 반가워요 🌙';
    if (h < 11) return '좋은 아침이에요 ☀️';
    if (h < 17) return '몽글몽글한 오후예요 🍰';
    if (h < 22) return '오늘도 수고 많았어요 🌷';
    return '내일도 같이 해요 🌙';
  }

  function renderHero() {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    $('#heroDate').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
    $('#heroSub').textContent = `${(state.members.kid && state.members.kid.name) || '현'}, ${greet()}`;
    const done = state.todos.filter((t) => t.done).length;
    $('#statToday').textContent = won(todayEarned());
    $('#statTodo').textContent = `${done} / ${state.todos.length}`;
    $('#statStamp').textContent = `${state.stamps.length}개`;
  }

  function renderFamily() {
    const kidName = (state.members.kid && state.members.kid.name) || '현';
    ['#walletKidName', '#todoKidName', '#moneyKidName', '#stampKidName', '#heroKidName'].forEach((sel) => {
      const el = $(sel);
      if (el) el.textContent = kidName;
    });
    const stack = $('#familyStack');
    stack.innerHTML = ['mom', 'dad', 'kid'].map((k) =>
      `<span class="face ${MEMBERS[k].cls}" title="${esc(state.members[k].name)}">${MEMBERS[k].emoji}</span>`
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

  /* ---------------- 미션 ---------------- */
  let rolling = false;

  function renderMission() {
    const m = state.todayMission;
    const box = $('#missionBox');
    const text = $('#missionText');
    const doneBtn = $('#doneMissionBtn');
    const drawBtn = $('#drawBtn');
    const pill = $('#missionPill');

    if (m) {
      text.textContent = m.text;
      box.classList.toggle('done', !!m.done);
      doneBtn.hidden = !!m.done;
      drawBtn.textContent = '다른 미션 뽑기';
      pill.textContent = m.done ? '완료 🐾' : '진행 중';
      pill.classList.toggle('soft', !m.done);
    } else {
      text.textContent = '뽑기 버튼을 눌러 오늘의 미션을 골라봐요!';
      box.classList.remove('done');
      doneBtn.hidden = true;
      drawBtn.textContent = '오늘 미션 뽑기';
      pill.textContent = '대기';
      pill.classList.add('soft');
    }

    const ul = $('#missionPool');
    ul.innerHTML = state.missions.map((x) =>
      `<li><span>${esc(x.text)}</span><button data-m-del="${x.id}" aria-label="미션 삭제">✕</button></li>`
    ).join('') || '<li><span>미션이 없어요</span></li>';
    $('#poolCount').textContent = `(${state.missions.length})`;
  }

  function drawMission() {
    if (rolling) return;
    const pool = state.missions;
    if (!pool.length) { toast('미션을 먼저 추가해 주세요 🐢'); return; }
    rolling = true;
    const text = $('#missionText');
    text.classList.add('rolling');
    let ticks = 0;
    const spin = setInterval(() => {
      text.textContent = pool[Math.floor(Math.random() * pool.length)].text;
      playNotes([520 + Math.random() * 300], 'triangle', 0.03);
      ticks += 1;
      if (ticks > 14) {
        clearInterval(spin);
        rolling = false;
        text.classList.remove('rolling');
        const pick = pool[Math.floor(Math.random() * pool.length)];
        state.todayMission = { id: pick.id, text: pick.text, at: Date.now(), done: false };
        save();
        renderMission();
        text.classList.add('pop');
        setTimeout(() => text.classList.remove('pop'), 500);
        playNotes([659, 880], 'sine', 0.12);
        toast('오늘의 미션은… ' + pick.text);
      }
    }, 90);
  }

  function completeMission() {
    const m = state.todayMission;
    if (!m || m.done) return;
    m.done = true;
    m.doneAt = Date.now();
    const char = state.stamps.length % 2 === 0 ? 'cat' : 'turtle';
    state.stamps.push({ id: uid(), char, at: Date.now(), text: m.text });
    save();
    renderMission();
    renderStamps(true);
    renderHero();
    playNotes([392, 523.3, 659.3], 'square', 0.1);
    toast('미션 완료! 도장이 쾅 찍혔어요 🐾');
    setTimeout(() => {
      $('#stamp').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#stampBoard').classList.add('glow');
      setTimeout(() => $('#stampBoard').classList.remove('glow'), 900);
    }, 300);
  }

  /* ---------------- 도장판 ---------------- */
  function renderStamps(animateLast) {
    const board = $('#stampBoard');
    board.innerHTML = '';
    const total = state.stamps.length;
    const page = Math.floor(total / 20);
    const items = state.stamps.slice(page * 20, page * 20 + 20);

    for (let i = 0; i < 20; i++) {
      const slot = document.createElement('div');
      slot.className = 'stamp-slot';
      const st = items[i];
      if (st) {
        slot.classList.add('filled');
        if (st.char === 'turtle') slot.classList.add('turtle');
        slot.innerHTML = `<svg aria-hidden="true"><use href="#stamp-${st.char === 'turtle' ? 'turtle' : 'cat'}"></use></svg>`;
        if (animateLast && i === items.length - 1) {
          slot.classList.add('bang');
        }
      } else {
        slot.innerHTML = `<span class="slot-num">${page * 20 + i + 1}</span>`;
      }
      board.appendChild(slot);
    }

    const inPage = items.length;
    $('#stampPill').textContent = `${total}개`;
    const note = $('#stampNote');
    if (total === 0) note.innerHTML = '한 칸씩 채워보자! 첫 도장을 기다리는 중 🐾';
    else if (inPage === 20) note.innerHTML = `<b>도장판 ${page + 1}장 완성!</b> 🎉 다음 판이 새로 시작돼요.`;
    else if (inPage >= 15) note.innerHTML = `도장 <b>${inPage}/20</b> — 얼마 안 남았어요! ✨`;
    else note.innerHTML = `이번 판 <b>${inPage}/20</b> · 지금까지 <b>${total}개</b>`;
  }

  /* ---------------- 채팅 ---------------- */
  function renderWho() {
    const box = $('#whoSwitch');
    box.innerHTML = ['mom', 'dad', 'kid'].map((k) =>
      `<button class="who-btn ${state.me === k ? 'on' : ''}" data-me="${k}">
        <span class="w-emoji">${MEMBERS[k].emoji}</span> ${esc(state.members[k].name)}
      </button>`
    ).join('');
  }

  function renderChat() {
    const body = $('#chatBody');
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
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
        <span class="avatar">${MEMBERS[who].emoji}</span>
        <div class="bubble-wrap">
          ${mine ? '' : `<span class="bubble-name">${esc(name)}</span>`}
          <div class="bubble ${isSticker ? 'sticker' : ''} ${isPraise ? 'praise' : ''}">${esc(m.text)}</div>
          <span class="bubble-time">${timeText(m.at)}</span>
        </div>`;
      body.appendChild(div);
    });
    if (nearBottom || true) body.scrollTop = body.scrollHeight;
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
    setSyncStatus(sync.ref ? '실시간 동기화 연결됨 🐱' : '로컬 저장만 사용 중', sync.ref ? 'ok' : '');
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
    merged.stamps = unionById(state.stamps, remote.stamps).sort((x, y) => x.at - y.at);
    merged.settings = state.settings;      // PIN·소리·주소는 이 기기 설정 유지
    merged.members = Object.assign({}, remote.members || state.members);
    merged.updatedAt = Math.max(state.updatedAt || 0, remote.updatedAt || 0);
    return merged;
  }

  async function connectSync() {
    const url = ($('#syncUrl').value || '').trim();
    state.settings.syncUrl = url;
    save();
    if (sync.ref) { try { sync.ref.off(); } catch (e) {} sync.ref = null; }
    if (!url) { setSyncStatus('로컬 저장만 사용 중', ''); toast('동기화를 끄고 이 기기에만 저장해요 🐢'); return; }
    setSyncStatus('연결하는 중…', '');
    try {
      if (!window.firebase) {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
      }
      if (!firebase.apps.length) firebase.initializeApp({ databaseURL: url });
      sync.ref = firebase.database().ref('mongleFamily/main');
      sync.ready = true;
      sync.ref.on('value', (snap) => {
        const remote = snap.val();
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

  /* ---------------- 렌더 ---------------- */
  function renderAll() {
    renderHero();
    renderFamily();
    renderMoney();
    renderEarn();
    renderHistory();
    renderTodos();
    renderMission();
    renderStamps();
    renderWho();
    renderChat();
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

    // 미션
    $('#drawBtn').addEventListener('click', drawMission);
    $('#doneMissionBtn').addEventListener('click', completeMission);
    $('#missionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#missionInput');
      const text = input.value.trim();
      if (!text) return;
      state.missions.push({ id: uid(), text });
      input.value = '';
      save();
      renderMission();
      toast('미션을 추가했어요 🎲');
    });
    $('#missionPool').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-m-del]');
      if (!btn) return;
      state.missions = state.missions.filter((m) => m.id !== btn.dataset.mDel);
      save();
      renderMission();
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
      state.settings.pinEnabled = $('#pinToggle').checked;
      $('#pinSet').hidden = !state.settings.pinEnabled;
      if (!state.settings.pinEnabled) {
        state.settings.pinHash = '';
        save();
        toast('PIN 잠금을 껐어요');
      } else {
        $('#pinInput').focus();
      }
    });
    $('#pinSave').addEventListener('click', async () => {
      const pin = ($('#pinInput').value || '').replace(/[^0-9]/g, '');
      if (pin.length !== 4) { toast('숫자 4자리를 입력해 주세요 🐢'); return; }
      state.settings.pinHash = await hashPin(pin);
      state.settings.pinEnabled = true;
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
      state.todayMission = null;
      save();
    }

    buildKeypad();
    buildStickerTray();
    renderAll();
    updateAlarmHint();
    bind();
    setInterval(checkAlarm, 1000);

    if (state.settings.pinEnabled && state.settings.pinHash) showLock();

    if (state.settings.syncUrl) {
      $('#syncUrl').value = state.settings.syncUrl;
      setSyncStatus('동기화 다시 연결하는 중…');
      connectSync();
    }
  }

  boot();
})();
