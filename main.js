/* ═══════════════════════════════════════════════════
   3bySOUND — main.js
   Menu · Game · Recorder
═══════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════
   SCREEN NAVIGATION
══════════════════════════════════════════ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

// Wire up all [data-target] nav items and back buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-target]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.target));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showScreen(el.dataset.target); } });
  });

  // Main nav items
  document.querySelectorAll('.nav-item[data-target]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.target));
  });

  // Play sub-items
  document.getElementById('btnOfficialLevels').addEventListener('click', () => showScreen('screen-official-levels'));
  document.getElementById('btnOfficialLevels').addEventListener('keydown', e => { if (e.key === 'Enter') showScreen('screen-official-levels'); });
  document.getElementById('btnCustomLevels').addEventListener('click', () => enterGame('CUSTOM'));
  document.getElementById('btnCustomLevels').addEventListener('keydown', e => { if (e.key === 'Enter') enterGame('CUSTOM'); });

  // Create sub-items
  document.getElementById('btnRecordLevel').addEventListener('click', () => showScreen('screen-recorder'));
  document.getElementById('btnRecordLevel').addEventListener('keydown', e => { if (e.key === 'Enter') showScreen('screen-recorder'); });

  // Game back button
  document.getElementById('btnGameBack').addEventListener('click', () => {
    pauseGameForMenu();
    showScreen('screen-play');
  });

  // Settings sliders
  document.getElementById('settingVolume').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('settingVolumeVal').textContent = Math.round(v * 100) + '%';
    gameVolume = v;
    if (audioPlayer) audioPlayer.volume = v;
  });

  document.getElementById('settingLeadTime').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('settingLeadTimeVal').textContent = v.toFixed(1) + 's';
    approachTime = v;
    const slider = document.getElementById('speedSlider');
    if (slider) slider.value = v;
    document.getElementById('speedLabel').textContent = `LEAD TIME: ${v.toFixed(1)}s`;
  });

  document.getElementById('settingHitWindow').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('settingHitWindowVal').textContent = v.toFixed(2) + 's';
    hitWindow = v;
  });

  initKeybinds();
  initSplash();
  initGame();
  initGuideLines();
  initRecorder();
  initTicker();
});

/* ══════════════════════════════════════════
   SPLASH
══════════════════════════════════════════ */
function initSplash() {
  const splash = document.getElementById('screen-splash');
  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    splash.style.transition = 'opacity 0.8s ease';
    splash.style.opacity = '0';
    setTimeout(() => showScreen('screen-menu'), 800);
  };

  // Auto-dismiss after 3.5s
  setTimeout(dismiss, 3500);
  document.addEventListener('keydown', dismiss, { once: true });
  splash.addEventListener('click', dismiss, { once: true });
}

/* ══════════════════════════════════════════
   TICKER ANIMATION
══════════════════════════════════════════ */
function initTicker() {
  const ticker = document.querySelector('.menu-ticker');
  if (!ticker) return;
  const text = ticker.textContent + ' ';
  ticker.textContent = '';
  // Create two copies for seamless scroll
  const span1 = document.createElement('span');
  const span2 = document.createElement('span');
  span1.textContent = text.repeat(4);
  span2.textContent = text.repeat(4);
  span1.style.display = 'inline-block';
  span2.style.display = 'inline-block';
  span1.style.animation = 'ticker 28s linear infinite';
  span2.style.animation = 'ticker 28s linear infinite';
  span2.style.animationDelay = '14s';
  ticker.appendChild(span1);
  ticker.appendChild(span2);
}

/* ══════════════════════════════════════════
   GAME ENGINE
══════════════════════════════════════════ */
const DEFAULT_KEY_MAP = { 'q': 'tl', 'w': 'tc', 'e': 'tr', 'a': 'ml', 'd': 'mr', 'z': 'bl', 'x': 'bc', 'c': 'br' };
let KEY_MAP = { ...DEFAULT_KEY_MAP };

const CELLS = [
  { id: 'tl', k: 'Q' }, { id: 'tc', k: 'W' }, { id: 'tr', k: 'E' },
  { id: 'ml', k: 'A' }, { id: 'center', k: null }, { id: 'mr', k: 'D' },
  { id: 'bl', k: 'Z' }, { id: 'bc', k: 'X' }, { id: 'br', k: 'C' }
];

let approachTime = 2.5;
let hitWindow = 0.25;
let gameVolume = 1.0;
const OFFSET = 800;

let beats = [];
let activeNotes = [];
let score = 0;
let hits300 = 0;
let hits100 = 0;
let hits50 = 0;
let missCount = 0;
let isPlaying = false;
let audioReady = false;
let chartReady = false;

const MAX_MISSES = 15; // fail threshold

const audioPlayer = document.getElementById('gameAudio');
const btnPlay = document.getElementById('btnPlay');
const btnRestart = document.getElementById('btnRestart');
const statusBar = document.getElementById('statusBar');
const confirmOverlay = document.getElementById('confirmOverlay');

function enterGame(mode) {
  document.getElementById('gameModeLabel').textContent = mode;

  // Reset game state for a fresh load
  audioPlayer.pause();
  audioPlayer.src = '';
  audioReady = false;
  chartReady = false;
  isPlaying = false;
  score = 0;
  hits300 = 0;
  hits100 = 0;
  hits50 = 0;
  missCount = 0;
  beats = [];
  activeNotes.forEach(n => n.el && n.el.remove());
  activeNotes = [];
  document.getElementById('score').textContent = '000000';
  btnPlay.disabled = true;
  btnPlay.textContent = 'WAITING FOR FILES...';
  btnRestart.disabled = true;

  const importZone = document.getElementById('importZone');

  if (mode === 'OFFICIAL' && window.selectedOfficialLevel) {
    const lvl = window.selectedOfficialLevel;

    // Hide the manual file-picker zone — files are loaded automatically
    importZone.style.display = 'none';

    document.getElementById('audioName').textContent = '—';
    document.getElementById('chartName').textContent = '—';
    statusBar.innerHTML = `loading <span>${lvl.song_name}</span>…`;

    // Show now-playing bar with song info
    const npBar = document.getElementById('nowPlayingBar');
    const npText = document.getElementById('nowPlayingText');
    if (npBar && npText) {
      npText.textContent = lvl.song_name + (lvl.artist ? '  —  ' + lvl.artist : '');
      npBar.style.display = 'flex';
    }

    showScreen('screen-game');

    loadOfficialLevel(lvl);
  } else {
    // Custom mode — show the import zone
    importZone.style.display = '';
    statusBar.innerHTML = 'load an mp3 and a json chart to begin';
    // Hide now-playing bar for custom mode
    const npBar = document.getElementById('nowPlayingBar');
    if (npBar) npBar.style.display = 'none';
    showScreen('screen-game');
  }
}

async function loadOfficialLevel(lvl) {
  try {
    // ── 1. Fetch the audio file ──────────────────────────────────────────
    statusBar.innerHTML = `fetching audio… <span>${lvl.song_name}</span>`;
    const audioRes = await fetch(lvl.song_file);
    if (!audioRes.ok) throw new Error(`Audio fetch failed: HTTP ${audioRes.status} for "${lvl.song_file}"`);
    const audioBlob = await audioRes.blob();
    audioPlayer.src = URL.createObjectURL(audioBlob);
    audioPlayer.volume = gameVolume;
    document.getElementById('audioName').textContent = lvl.song_name + ' — ' + lvl.artist;
    audioReady = true;

    // ── 2. Fetch the chart JSON ──────────────────────────────────────────
    statusBar.innerHTML = `fetching chart… <span>${lvl.song_name}</span>`;
    const chartRes = await fetch(lvl.beat_config_file);
    if (!chartRes.ok) throw new Error(`Chart fetch failed: HTTP ${chartRes.status} for "${lvl.beat_config_file}"`);
    const data = await chartRes.json();
    const rawBeats = data.recordedBeats || data.RECORDED_BEATS;
    if (!rawBeats || !Array.isArray(rawBeats)) {
      statusBar.innerHTML = '<span class="err">JSON error: no recordedBeats array found in chart</span>';
      return;
    }
    beats = rawBeats.map(b => ({ box: b.box, time: b.time, spawned: false, hit: false }));
    document.getElementById('chartName').textContent = lvl.song_name + ' (' + beats.length + ' beats)';
    chartReady = true;

    // ── 3. Both loaded — enable play ────────────────────────────────────
    checkReady();
    // Auto-start: begin the countdown immediately for official levels
    setTimeout(() => startGameWithCountdown(), 80);
  } catch (err) {
    statusBar.innerHTML = `<span class="err">Failed to load level: ${err.message}</span>`;
    btnPlay.disabled = true;
    btnRestart.disabled = true;
  }
}

function pauseGameForMenu() {
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    if (btnPlay) btnPlay.textContent = 'RESUME';
  }
  // Hide result overlays if present
  const fo = document.getElementById('failOverlay');
  const wo = document.getElementById('winOverlay');
  if (fo) fo.classList.remove('visible');
  if (wo) wo.classList.remove('visible');
  const missBarEl = document.getElementById('missBar');
  if (missBarEl) missBarEl.remove();
}

function initGame() {
  const gridEl = document.getElementById('grid');
  CELLS.forEach(c => {
    const cell = document.createElement('div');
    if (c.id === 'center') {
      cell.className = 'cell center-placeholder';
    } else {
      cell.className = 'cell';
      cell.id = `cell-${c.id}`;
      cell.innerHTML = `<span class="cell-key">${c.k}</span>`;
    }
    gridEl.appendChild(cell);
  });

  document.getElementById('audioInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    audioPlayer.src = URL.createObjectURL(file);
    audioPlayer.volume = gameVolume;
    document.getElementById('audioName').textContent = file.name;
    audioReady = true;
    checkReady();
  };

  document.getElementById('chartInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const rawBeats = data.recordedBeats || data.RECORDED_BEATS;
        if (!rawBeats || !Array.isArray(rawBeats)) {
          statusBar.innerHTML = '<span class="err">JSON error: no recordedBeats array found</span>';
          return;
        }
        beats = rawBeats.map(b => ({ box: b.box, time: b.time, spawned: false, hit: false }));
        document.getElementById('chartName').textContent = file.name + ' (' + beats.length + ' beats)';
        chartReady = true;
        checkReady();
      } catch (err) {
        statusBar.innerHTML = '<span class="err">JSON parse error: ' + err.message + '</span>';
      }
    };
    reader.readAsText(file);
  };

  document.getElementById('speedSlider').oninput = (e) => {
    approachTime = parseFloat(e.target.value);
    document.getElementById('speedLabel').textContent = `LEAD TIME: ${approachTime.toFixed(1)}s`;
    document.getElementById('settingLeadTime').value = approachTime;
    document.getElementById('settingLeadTimeVal').textContent = approachTime.toFixed(1) + 's';
  };

  // Keyboard input — only when game screen is active
  window.addEventListener('keydown', e => {
    if (!document.getElementById('screen-game').classList.contains('active')) return;
    if (e.repeat) return;
    const cid = KEY_MAP[e.key.toLowerCase()];
    if (cid) {
      const cellEl = document.getElementById(`cell-${cid}`);
      if (cellEl) cellEl.classList.add('pressed');
      checkHit(cid);
    }
  });

  window.addEventListener('keyup', e => {
    const cid = KEY_MAP[e.key.toLowerCase()];
    if (cid) {
      const cellEl = document.getElementById(`cell-${cid}`);
      if (cellEl) cellEl.classList.remove('pressed');
    }
  });

  confirmOverlay.addEventListener('click', function (e) {
    if (e.target === this) cancelRestart();
  });

  audioPlayer.addEventListener('ended', () => {
    isPlaying = false;
    audioPlayer.currentTime = 0;
    beats.forEach(b => { b.spawned = false; b.hit = false; });
    activeNotes.forEach(n => n.el.remove());
    activeNotes = [];
    showWinScreen();
  });
}

function checkReady() {
  if (audioReady && chartReady) {
    btnPlay.disabled = false;
    btnPlay.textContent = 'START GAME';
    btnRestart.disabled = false;
    statusBar.innerHTML = 'ready — <span>' + beats.length + ' beats</span> loaded';
  } else if (audioReady) {
    statusBar.innerHTML = 'audio loaded — <span>waiting for chart json</span>';
  } else if (chartReady) {
    statusBar.innerHTML = 'chart loaded — <span>waiting for audio</span>';
  }
}

function togglePlay() {
  if (!isPlaying) {
    const isFreshStart = audioPlayer.currentTime === 0 || audioPlayer.ended;
    if (isFreshStart) {
      beats.forEach(b => { b.spawned = false; b.hit = false; });
      activeNotes.forEach(n => n.el.remove());
      activeNotes = [];
      score = 0;
      document.getElementById('score').textContent = '000000';
      // Run 3-second countdown before starting
      startGameWithCountdown();
    } else {
      // Resuming from pause — no countdown
      audioPlayer.volume = gameVolume;
      audioPlayer.play();
      isPlaying = true;
      btnPlay.textContent = 'PAUSE';
      statusBar.innerHTML = '<span>playing</span>';
      gameLoop();
    }
  } else {
    audioPlayer.pause();
    isPlaying = false;
    btnPlay.textContent = 'RESUME';
    statusBar.innerHTML = 'paused';
  }
}

function startGameWithCountdown() {
  btnPlay.disabled = true;
  btnRestart.disabled = true;

  let count = 3;
  showGameCountdown(count);
  statusBar.innerHTML = 'get ready… <span>' + count + '</span>';

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      showGameCountdown(count);
      statusBar.innerHTML = 'get ready… <span>' + count + '</span>';
    } else {
      clearInterval(interval);
      hideGameCountdown();
      btnPlay.disabled = false;
      btnRestart.disabled = false;

      audioPlayer.volume = gameVolume;
      audioPlayer.play();
      isPlaying = true;
      btnPlay.textContent = 'PAUSE';
      statusBar.innerHTML = '<span>playing</span>';
      gameLoop();
    }
  }, 1000);
}

function showGameCountdown(n) {
  let overlay = document.getElementById('gameCountdownOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gameCountdownOverlay';
    overlay.className = 'rec-countdown-overlay';
    document.getElementById('screen-game').appendChild(overlay);
  }
  overlay.innerHTML = '<span class="rec-countdown-num">' + n + '</span>';
  overlay.classList.add('visible');
  const numEl = overlay.querySelector('.rec-countdown-num');
  numEl.classList.remove('pop');
  void numEl.offsetWidth; // reflow to restart animation
  numEl.classList.add('pop');
}

function hideGameCountdown() {
  const overlay = document.getElementById('gameCountdownOverlay');
  if (overlay) overlay.classList.remove('visible');
}

function gameLoop() {
  if (!isPlaying) return;
  const now = audioPlayer.currentTime;
  beats.forEach(b => {
    if (!b.spawned && b.time - approachTime <= now) {
      const el = document.createElement('div');
      el.className = 'note';
      document.getElementById('gameArea').appendChild(el);
      activeNotes.push({ ...b, el, currentApproach: approachTime });
      b.spawned = true;
    }
  });
  updateNotes(now);
  requestAnimationFrame(gameLoop);
}

function updateNotes(now) {
  for (let i = activeNotes.length - 1; i >= 0; i--) {
    const n = activeNotes[i];
    const progress = (now - (n.time - n.currentApproach)) / n.currentApproach;

    if (progress > 1.1) {
      n.el.classList.add('missed');
      setTimeout(() => n.el.remove(), 300);
      activeNotes.splice(i, 1);
      missCount++;
      updateMissDisplay();
      if (missCount >= MAX_MISSES) {
        triggerFail();
        return;
      }
      continue;
    }

    const target = document.getElementById(`cell-${n.box}`);
    if (!target) { activeNotes.splice(i, 1); continue; }

    const rect = target.getBoundingClientRect();
    const areaRect = document.getElementById('gameArea').getBoundingClientRect();

    const tx = rect.left - areaRect.left + (rect.width / 2) - 22;
    const ty = rect.top - areaRect.top + (rect.height / 2) - 22;

    let sx = tx, sy = ty;
    if (n.box.includes('t')) sy -= OFFSET;
    if (n.box.includes('b')) sy += OFFSET;
    if (n.box.includes('l')) sx -= OFFSET;
    if (n.box.includes('r')) sx += OFFSET;

    const p = Math.max(0, progress);
    n.el.style.left = (sx + (tx - sx) * p) + 'px';
    n.el.style.top = (sy + (ty - sy) * p) + 'px';
    n.el.style.transform = `scale(${0.5 + Math.min(p, 1) * 0.5})`;
  }
}

function getTier(delta) {
  if (delta <= 0.08) return { points: 300, tierClass: 't300', ringColor: '#50fa7b', particleColors: ['#50fa7b', '#b8ffcc', '#ffffff', '#50fa7b', '#b8ffcc', '#ffffff', '#50fa7b', '#b8ffcc'] };
  if (delta <= 0.15) return { points: 100, tierClass: 't100', ringColor: '#f1fa8c', particleColors: ['#f1fa8c', '#fffab0', '#ffffff', '#f1fa8c', '#fffab0', '#ffffff', '#f1fa8c', '#fffab0'] };
  return { points: 50, tierClass: 't50', ringColor: '#ffb86c', particleColors: ['#ffb86c', '#ffd4a8', '#ffffff', '#ffb86c', '#ffd4a8', '#ffffff', '#ffb86c', '#ffd4a8'] };
}

function spawnBurst(x, y, ringColor, particleColors) {
  const area = document.getElementById('gameArea');
  for (let r = 0; r < 2; r++) {
    const ring = document.createElement('div');
    ring.className = 'pop-ring' + (r === 1 ? ' ring2' : '');
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.borderColor = ringColor;
    area.appendChild(ring);
    setTimeout(() => ring.remove(), 550);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 28 + Math.random() * 20;
    const p = document.createElement('div');
    p.className = 'pop-particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = particleColors[i];
    p.style.setProperty('--dx0', '0px');
    p.style.setProperty('--dy0', '0px');
    p.style.setProperty('--dx1', (Math.cos(angle) * dist) + 'px');
    p.style.setProperty('--dy1', (Math.sin(angle) * dist) + 'px');
    area.appendChild(p);
    setTimeout(() => p.remove(), 500);
  }
}

function spawnScorePopup(x, y, points, tierClass) {
  const area = document.getElementById('gameArea');
  const el = document.createElement('div');
  el.className = 'pop-score ' + tierClass;
  el.textContent = '+' + points;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  area.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function checkHit(cid) {
  if (!isPlaying) return;
  const now = audioPlayer.currentTime;

  const candidates = activeNotes
    .map((n, i) => ({ n, i, delta: Math.abs(n.time - now) }))
    .filter(({ n, delta }) => n.box === cid && delta < hitWindow);

  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.n.time - b.n.time);
  const { n, i: idx } = candidates[0];

  const delta = Math.abs(n.time - now);
  const tier = getTier(delta);

  score += tier.points;
  if (tier.points === 300) hits300++;
  else if (tier.points === 100) hits100++;
  else hits50++;
  document.getElementById('score').textContent = score.toString().padStart(6, '0');

  const noteRect = n.el.getBoundingClientRect();
  const areaRect = document.getElementById('gameArea').getBoundingClientRect();
  const bx = noteRect.left - areaRect.left + noteRect.width / 2;
  const by = noteRect.top - areaRect.top + noteRect.height / 2;

  n.el.remove();
  activeNotes.splice(idx, 1);

  spawnBurst(bx, by, tier.ringColor, tier.particleColors);
  spawnScorePopup(bx, by, tier.points, tier.tierClass);

  const cell = document.getElementById(`cell-${cid}`);
  cell.style.borderColor = tier.ringColor;
  cell.style.boxShadow = `0 0 12px ${tier.ringColor}`;
  setTimeout(() => { cell.style.borderColor = ''; cell.style.boxShadow = ''; }, 150);
}

function updateMissDisplay() {
  let bar = document.getElementById('missBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'missBar';
    bar.className = 'miss-bar';
    document.getElementById('screen-game').appendChild(bar);
  }
  const pct = Math.min(missCount / MAX_MISSES, 1);
  bar.innerHTML = `
    <div class="miss-bar-label">MISSES <span class="miss-count">${missCount}/${MAX_MISSES}</span></div>
    <div class="miss-bar-track"><div class="miss-bar-fill" style="width:${pct * 100}%"></div></div>`;
}

function getrank(s300, s100, s50, misses) {
  const total = s300 + s100 + s50 + misses;
  if (total === 0) return 'SS';
  const pct300 = s300 / total;
  if (misses === 0 && s50 === 0 && s100 === 0) return 'SS';
  if (misses === 0 && pct300 >= 0.9) return 'S';
  if (pct300 >= 0.8 && misses / total < 0.05) return 'A';
  if (pct300 >= 0.6 && misses / total < 0.1) return 'B';
  if (pct300 >= 0.4) return 'C';
  if (pct300 >= 0.2) return 'D';
  return 'D';
}

function triggerFail() {
  audioPlayer.pause();
  isPlaying = false;

  // Remove miss bar
  const bar = document.getElementById('missBar');
  if (bar) bar.remove();

  // Remove countdown if shown
  hideGameCountdown();

  let overlay = document.getElementById('failOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'failOverlay';
    overlay.className = 'result-overlay fail-overlay';
    document.getElementById('screen-game').appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="result-box">
      <div class="result-icon fail-icon">✕</div>
      <div class="result-title fail-title">FAILED</div>
      <div class="result-sub">you missed too many notes</div>
      <div class="result-score-row">
        <span class="result-score-label">SCORE</span>
        <span class="result-score-val">${score.toString().padStart(6, '0')}</span>
      </div>
      <div class="result-hits">
        <div class="result-hit-item t300"><span class="rh-label">300</span><span class="rh-count">${hits300}</span></div>
        <div class="result-hit-item t100"><span class="rh-label">100</span><span class="rh-count">${hits100}</span></div>
        <div class="result-hit-item t50"><span class="rh-label">50</span><span class="rh-count">${hits50}</span></div>
        <div class="result-hit-item tmiss"><span class="rh-label">MISS</span><span class="rh-count">${missCount}</span></div>
      </div>
      <div class="result-actions">
        <button class="btn danger" onclick="retryFromResult()">↺ RETRY</button>
        <button class="btn" onclick="exitToMenuFromResult()">← MENU</button>
      </div>
    </div>`;
  overlay.classList.add('visible');
}

function showWinScreen() {
  // Remove miss bar
  const bar = document.getElementById('missBar');
  if (bar) bar.remove();

  const rank = getrank(hits300, hits100, hits50, missCount);
  const rankColors = { SS: '#f1fa8c', S: '#50fa7b', A: '#8be9fd', B: '#7c6fff', C: '#ffb86c', D: '#ff5555' };
  const rankColor = rankColors[rank] || '#e0deff';

  let overlay = document.getElementById('winOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'winOverlay';
    overlay.className = 'result-overlay win-overlay';
    document.getElementById('screen-game').appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="result-box">
      <div class="result-rank" style="color:${rankColor};text-shadow:0 0 24px ${rankColor}88;">${rank}</div>
      <div class="result-title win-title">CLEARED!</div>
      <div class="result-score-row">
        <span class="result-score-label">SCORE</span>
        <span class="result-score-val">${score.toString().padStart(6, '0')}</span>
      </div>
      <div class="result-hits">
        <div class="result-hit-item t300"><span class="rh-label">300</span><span class="rh-count">${hits300}</span></div>
        <div class="result-hit-item t100"><span class="rh-label">100</span><span class="rh-count">${hits100}</span></div>
        <div class="result-hit-item t50"><span class="rh-label">50</span><span class="rh-count">${hits50}</span></div>
        <div class="result-hit-item tmiss"><span class="rh-label">MISS</span><span class="rh-count">${missCount}</span></div>
      </div>
      <div class="result-actions">
        <button class="btn" onclick="retryFromResult()">↺ RETRY</button>
        <button class="btn" onclick="exitToMenuFromResult()">← MENU</button>
      </div>
    </div>`;
  overlay.classList.add('visible');
}

function retryFromResult() {
  // Hide result overlays
  const fo = document.getElementById('failOverlay');
  const wo = document.getElementById('winOverlay');
  if (fo) fo.classList.remove('visible');
  if (wo) wo.classList.remove('visible');
  // Full restart
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  isPlaying = false;
  score = 0;
  hits300 = 0;
  hits100 = 0;
  hits50 = 0;
  missCount = 0;
  document.getElementById('score').textContent = '000000';
  beats.forEach(b => { b.spawned = false; b.hit = false; });
  activeNotes.forEach(n => n.el.remove());
  activeNotes = [];
  startGameWithCountdown();
}

function exitToMenuFromResult() {
  const fo = document.getElementById('failOverlay');
  const wo = document.getElementById('winOverlay');
  if (fo) fo.classList.remove('visible');
  if (wo) wo.classList.remove('visible');
  const bar = document.getElementById('missBar');
  if (bar) bar.remove();
  audioPlayer.pause();
  isPlaying = false;
  showScreen('screen-play');
}

function askRestart() {
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
    btnPlay.textContent = 'RESUME';
  }
  confirmOverlay.classList.add('visible');
}

function cancelRestart() {
  confirmOverlay.classList.remove('visible');
}

function confirmRestart() {
  confirmOverlay.classList.remove('visible');
  // Hide any result screens
  const fo = document.getElementById('failOverlay');
  const wo = document.getElementById('winOverlay');
  if (fo) fo.classList.remove('visible');
  if (wo) wo.classList.remove('visible');
  const missBarEl = document.getElementById('missBar');
  if (missBarEl) missBarEl.remove();
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  isPlaying = false;
  score = 0;
  hits300 = 0;
  hits100 = 0;
  hits50 = 0;
  missCount = 0;
  document.getElementById('score').textContent = '000000';
  beats.forEach(b => { b.spawned = false; b.hit = false; });
  activeNotes.forEach(n => n.el.remove());
  activeNotes = [];
  btnPlay.textContent = 'START GAME';
  statusBar.innerHTML = 'restarted — <span>' + beats.length + ' beats</span> loaded';
  startGameWithCountdown();
}

/* ══════════════════════════════════════════
   RECORDER
══════════════════════════════════════════ */

const REC_CELLS = [
  { id: 'tl', label: 'TOP-LEFT' }, { id: 'tc', label: 'TOP' }, { id: 'tr', label: 'TOP-RIGHT' },
  { id: 'ml', label: 'LEFT' }, { id: 'center', label: 'SHOOTER' }, { id: 'mr', label: 'RIGHT' },
  { id: 'bl', label: 'BOTTOM-LEFT' }, { id: 'bc', label: 'BOTTOM' }, { id: 'br', label: 'BOTTOM-RIGHT' },
];

const REC_DIRS = REC_CELLS.filter(c => c.id !== 'center');

const REC_KEY_MAP = {
  KeyQ: 'tl', KeyW: 'tc', KeyE: 'tr',
  KeyA: 'ml', KeyD: 'mr',
  KeyZ: 'bl', KeyX: 'bc', KeyC: 'br',
};

const REC_KEY_DISPLAY = { tl: 'Q', tc: 'W', tr: 'E', ml: 'A', mr: 'D', bl: 'Z', bc: 'X', br: 'C' };

const BOX_COLORS = {
  tl: '#7c6fff', tc: '#ff6b9d', tr: '#6bffda',
  ml: '#ffb86c', mr: '#ff5555',
  bl: '#50fa7b', bc: '#f1fa8c', br: '#8be9fd',
};

const recBoxState = {};
REC_DIRS.forEach(c => { recBoxState[c.id] = { spawnTime: 0 }; });

let recBeats = [];
let recActiveId = null;
let recAudio = null;
let recAudioDur = 0;
let recIsRecording = false;
let recRafId = null;
let recLastJson = '';

function initRecorder() {
  const recGrid = document.getElementById('recGrid');

  // Build grid
  REC_CELLS.forEach(c => {
    const cell = document.createElement('div');
    cell.className = 'cell' + (c.id === 'center' ? ' center' : '');
    cell.id = 'reccell-' + c.id;

    if (c.id !== 'center') {
      const hint = document.createElement('div');
      hint.className = 'key-hint';
      hint.id = 'reckeyhint-' + c.id;
      hint.textContent = REC_KEY_DISPLAY[c.id];
      cell.appendChild(hint);
    }

    const lbl = document.createElement('div');
    lbl.className = 'cell-label';
    lbl.id = 'reclabel-' + c.id;
    lbl.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10" y1="5.5" x2="10" y2="14.5" stroke="currentColor" stroke-width="1.2"/>
      <line x1="5.5" y1="10" x2="14.5" y2="10" stroke="currentColor" stroke-width="1.2"/>
    </svg><span>${c.label}</span>`;
    cell.appendChild(lbl);

    if (c.id !== 'center') {
      cell.addEventListener('click', () => recHandleCellClick(c));
    }
    recGrid.appendChild(cell);
  });


  // Key legend
  const legendBody = document.getElementById('keyLegendBody');
  REC_DIRS.forEach(c => {
    const item = document.createElement('div');
    item.className = 'key-legend-item';
    item.id = 'reclegend-' + c.id;
    item.innerHTML = `
      <span class="key-badge" id="reckbadge-${c.id}">${REC_KEY_DISPLAY[c.id]}</span>
      <span class="dot" style="background:${BOX_COLORS[c.id]}"></span>
      <span>${c.label}</span>`;
    legendBody.appendChild(item);
  });



  // Timing rows
  REC_DIRS.forEach(c => {
    const row = document.createElement('div');
    row.className = 'timing-row';
    row.id = 'recrow-' + c.id;
    row.innerHTML = `
      <div class="row-id">
        <div class="row-dot" id="recdot-${c.id}" style="background:${BOX_COLORS[c.id]}33;border:1px solid ${BOX_COLORS[c.id]}88;"></div>
        <span>${c.label.split('-')[0]}</span>
      </div>
      <div class="timing-input-wrap">
        <input type="range" id="recslider-${c.id}" min="0" max="300" step="0.1" value="0">
      </div>
      <div class="timing-val" id="recval-${c.id}">0.0s</div>`;
    document.getElementById('timingRows').appendChild(row);

    document.getElementById('recslider-' + c.id).addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      recBoxState[c.id].spawnTime = v;
      document.getElementById('recval-' + c.id).textContent = v.toFixed(1) + 's';
    });
  });

  // MP3 upload
  document.getElementById('mp3Input').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    if (recAudio) { recAudio.pause(); recAudio = null; }
    cancelAnimationFrame(recRafId);
    recIsRecording = false;
    document.body.classList.remove('recording');
    recUpdateRecordBtn();
    recUpdateProgress(0);
    recSetStatus('loading <span>' + file.name + '</span>...');

    recAudio = new Audio();
    recAudio.preload = 'auto';

    recAudio.addEventListener('loadedmetadata', () => {
      recAudioDur = recAudio.duration;
      document.getElementById('audioHeaderTime').textContent = recFormatTime(recAudioDur);
      document.getElementById('recBtnPlay').disabled = false;
      document.getElementById('recBtnStop').disabled = false;
      document.getElementById('recBtnRecord').disabled = false;
      const fn = document.getElementById('audioFilename');
      fn.textContent = file.name;
      fn.classList.add('loaded');
      REC_DIRS.forEach(c => { document.getElementById('recslider-' + c.id).max = Math.ceil(recAudioDur); });
      recSetStatus('loaded <span>' + file.name + '</span> — press ▶ play, then ● record');
      recRenderBeatMarkers();
    });

    recAudio.addEventListener('error', () => {
      recSetStatus('<span style="color:var(--accent3)">could not load this file</span>');
    });

    recAudio.addEventListener('ended', () => {
      if (recIsRecording) { recIsRecording = false; document.body.classList.remove('recording'); recUpdateRecordBtn(); }
      recUpdatePlayBtn(); cancelAnimationFrame(recRafId);
    });

    recAudio.src = URL.createObjectURL(file);
    recAudio.load();
  });


  // Progress bar click
  document.getElementById('progressWrap').addEventListener('click', function (e) {
    if (!recAudio || !recAudioDur) return;
    const r = this.getBoundingClientRect();
    recAudio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * recAudioDur;
    recUpdateProgress(recAudio.currentTime);
  });

  // Keyboard for recorder
  document.addEventListener('keydown', e => {
    if (!document.getElementById('screen-recorder').classList.contains('active')) return;
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') { e.preventDefault(); recTogglePlay(); return; }
    if (e.code === 'KeyR') { e.preventDefault(); recToggleRecord(); return; }

    if (recIsRecording && recAudio && !recAudio.paused && REC_KEY_MAP[e.code]) {
      e.preventDefault();
      recCaptureBeat(REC_KEY_MAP[e.code]);
      return;
    }

    if (!recIsRecording && REC_KEY_MAP[e.code]) {
      e.preventDefault();
      const c = REC_CELLS.find(x => x.id === REC_KEY_MAP[e.code]);
      if (c) recHandleCellClick(c);
    }
  });
}

function recSetStatus(html) {
  const el = document.getElementById('recStatus');
  if (el) el.innerHTML = html;
}

function recHandleCellClick(c) {
  if (recIsRecording && recAudio && !recAudio.paused) { recCaptureBeat(c.id); return; }

  const wasActive = recActiveId === c.id;
  document.querySelectorAll('#recGrid .cell').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.timing-row').forEach(el => el.classList.remove('row-active'));

  recActiveId = null;
  recDrawAim(null);

  if (wasActive) { recSetStatus('deselected'); return; }

  recActiveId = c.id;
  const el = document.getElementById('reccell-' + c.id);
  el.classList.add('active', 'flash');
  el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
  recDrawAim(c.id);
  document.getElementById('recrow-' + c.id).classList.add('row-active');
  recSetStatus('aimed at <span>' + c.label + '</span> — spawn @ <span>' + recBoxState[c.id].spawnTime.toFixed(1) + 's</span>');
}

function recCaptureBeat(id) {
  const t = recAudio.currentTime;
  recBeats.push({ id, time: t, color: BOX_COLORS[id] });
  recBeats.sort((a, b) => a.time - b.time);

  const el = document.getElementById('reccell-' + id);
  el.classList.add('record-flash', 'key-press');
  el.addEventListener('animationend', () => { el.classList.remove('record-flash', 'key-press'); }, { once: true });

  recBoxState[id].spawnTime = t;
  document.getElementById('recslider-' + id).value = t;
  document.getElementById('recval-' + id).textContent = t.toFixed(1) + 's';
  recRenderBeatsList();
  recRenderBeatMarkers();

  const lbl = REC_CELLS.find(x => x.id === id).label;
  recSetStatus('<span class="rec">● REC</span> ' + lbl + ' [<span>' + REC_KEY_DISPLAY[id] + '</span>] @ <span>' + t.toFixed(2) + 's</span>');
}

function recRenderBeatsList() {
  const beatsList = document.getElementById('beatsList');
  const beatsPanel = document.getElementById('recBeatsPanel');
  const beatCountEl = document.getElementById('beatCount');
  beatsList.innerHTML = '';
  beatsPanel.style.display = recBeats.length ? 'block' : 'none';
  beatCountEl.textContent = recBeats.length;
  document.getElementById('recBtnClearBeats').disabled = recBeats.length === 0;

  recBeats.forEach((b, i) => {
    const lbl = REC_CELLS.find(x => x.id === b.id).label;
    const div = document.createElement('div');
    div.className = 'beat-entry';
    div.innerHTML =
      '<span class="be-idx">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="be-box"><span class="color-dot" style="background:' + b.color + '"></span>' + lbl + '</span>' +
      '<span style="color:#555;min-width:20px;font-size:9px;">[' + REC_KEY_DISPLAY[b.id] + ']</span>' +
      '<span class="be-time">' + b.time.toFixed(3) + 's</span>' +
      '<span class="be-del" onclick="recDeleteBeat(' + i + ')">✕</span>';
    beatsList.appendChild(div);
  });
  beatsList.scrollTop = beatsList.scrollHeight;
}

function recRenderBeatMarkers() {
  const progressWrap = document.getElementById('progressWrap');
  progressWrap.querySelectorAll('.beat-marker').forEach(m => m.remove());
  if (!recAudioDur) return;
  recBeats.forEach(b => {
    const m = document.createElement('div');
    m.className = 'beat-marker';
    m.style.cssText = 'left:' + ((b.time / recAudioDur) * 100) + '%;background:' + b.color;
    progressWrap.appendChild(m);
  });
}

function recDeleteBeat(i) { recBeats.splice(i, 1); recRenderBeatsList(); recRenderBeatMarkers(); }

function recClearBeats() {
  if (!confirm('Clear all recorded beats?')) return;
  recBeats = []; recRenderBeatsList(); recRenderBeatMarkers();
}

function recTogglePlay() {
  if (!recAudio) return;
  if (recAudio.paused) {
    recAudio.play().catch(err => recSetStatus('<span style="color:var(--accent3)">playback error: ' + err.message + '</span>'));
    recStartRaf(); recUpdatePlayBtn();
    if (recIsRecording) recSetStatus('<span class="rec">● RECORDING</span> — use Q W E / A D / Z X C keys');
  } else {
    recAudio.pause(); cancelAnimationFrame(recRafId); recUpdatePlayBtn();
  }
}

function recStopAudio() {
  if (!recAudio) return;
  recAudio.pause(); recAudio.currentTime = 0;
  cancelAnimationFrame(recRafId); recUpdateProgress(0); recUpdatePlayBtn();
  if (recIsRecording) { recIsRecording = false; document.body.classList.remove('recording'); recUpdateRecordBtn(); }
}

function recToggleRecord() {
  if (!recAudio) return;

  // If already recording, stop immediately
  if (recIsRecording) {
    recIsRecording = false;
    document.body.classList.remove('recording');
    recUpdateRecordBtn();
    recSetStatus('recording stopped — <span>' + recBeats.length + ' beats</span> captured');
    return;
  }

  // Start a 3-second countdown before recording begins
  const btn = document.getElementById('recBtnRecord');
  btn.disabled = true;

  let count = 3;
  recShowCountdown(count);
  recSetStatus('get ready… <span>' + count + '</span>');

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      recShowCountdown(count);
      recSetStatus('get ready… <span>' + count + '</span>');
    } else {
      clearInterval(interval);
      recHideCountdown();
      btn.disabled = false;

      // Begin recording
      recIsRecording = true;
      document.body.classList.add('recording');
      recUpdateRecordBtn();
      if (recAudio.paused) {
        recAudio.currentTime = 0;
        recAudio.play().catch(() => { });
        recStartRaf(); recUpdatePlayBtn();
      }
      recSetStatus('<span class="rec">● RECORDING</span> — use <span>Q W E</span> / <span>A D</span> / <span>Z X C</span> keys');
    }
  }, 1000);
}

function recShowCountdown(n) {
  let overlay = document.getElementById('recCountdownOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'recCountdownOverlay';
    overlay.className = 'rec-countdown-overlay';
    const recScreen = document.getElementById('screen-recorder');
    recScreen.appendChild(overlay);
  }
  overlay.innerHTML = '<span class="rec-countdown-num">' + n + '</span>';
  overlay.classList.add('visible');
  // Re-trigger animation on each count change
  const numEl = overlay.querySelector('.rec-countdown-num');
  numEl.classList.remove('pop');
  void numEl.offsetWidth; // reflow to restart animation
  numEl.classList.add('pop');
}

function recHideCountdown() {
  const overlay = document.getElementById('recCountdownOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

function recUpdatePlayBtn() {
  if (!recAudio) return;
  document.getElementById('recBtnPlay').textContent = recAudio.paused ? '▶ play' : '⏸ pause';
}

function recUpdateRecordBtn() {
  const btn = document.getElementById('recBtnRecord');
  if (recIsRecording) { btn.textContent = '■ stop rec'; btn.classList.add('recording'); }
  else { btn.textContent = '● record'; btn.classList.remove('recording'); }
}

function recStartRaf() {
  cancelAnimationFrame(recRafId);
  (function tick() {
    if (recAudio && !recAudio.paused) {
      recUpdateProgress(recAudio.currentTime);
      recRafId = requestAnimationFrame(tick);
    }
  })();
}

function recUpdateProgress(t) {
  const pct = recAudioDur ? (t / recAudioDur) * 100 : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressPlayhead').style.left = pct + '%';
  const timeStr = recFormatTime(t) + ' / ' + recFormatTime(recAudioDur);
  document.getElementById('progressTime').textContent = timeStr;
  document.getElementById('audioHeaderTime').textContent = timeStr;
}

function recFormatTime(s) {
  if (!isFinite(s)) return '0:00';
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}


function recDrawAim(targetId) {
  const canvas = document.getElementById('aimCanvas');
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  const r = wrap.getBoundingClientRect();
  canvas.width = r.width; canvas.height = r.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!targetId) return;

  const cR = document.getElementById('reccell-center').getBoundingClientRect();
  const tR = document.getElementById('reccell-' + targetId).getBoundingClientRect();
  const cx = cR.left - r.left + cR.width / 2, cy = cR.top - r.top + cR.height / 2;
  const tx = tR.left - r.left + tR.width / 2, ty = tR.top - r.top + tR.height / 2;

  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty);
  ctx.strokeStyle = 'rgba(124,111,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.stroke();

  const angle = Math.atan2(ty - cy, tx - cx);
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 9 * Math.cos(angle - 0.4), ty - 9 * Math.sin(angle - 0.4));
  ctx.lineTo(tx - 9 * Math.cos(angle + 0.4), ty - 9 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = 'rgba(124,111,255,0.75)';
  ctx.fill();
  ctx.restore();
}

window.addEventListener('resize', () => {
  if (recActiveId) recDrawAim(recActiveId);
});

function recBuildConfig() {
  const spawnTiming = {};
  REC_DIRS.forEach(c => {
    spawnTiming[c.id] = {
      label: c.label,
      key: REC_KEY_DISPLAY[c.id],
      spawnTime: parseFloat(recBoxState[c.id].spawnTime.toFixed(3))
    };
  });
  return {
    spawnTiming,
    recordedBeats: recBeats.map((b, i) => ({
      index: i + 1,
      box: b.id,
      label: REC_CELLS.find(x => x.id === b.id).label,
      key: REC_KEY_DISPLAY[b.id],
      time: parseFloat(b.time.toFixed(3))
    }))
  };
}

function recToggleExport() {
  const box = document.getElementById('exportBox');
  const dlBtn = document.getElementById('btnDownloadJson');
  const cpBtn = document.getElementById('btnCopyJson');

  if (box.style.display === 'block') {
    box.style.display = 'none';
    dlBtn.style.display = 'none';
    cpBtn.style.display = 'none';
    return;
  }
  recLastJson = JSON.stringify(recBuildConfig(), null, 2);
  box.textContent = recLastJson;
  box.style.display = 'block';
  dlBtn.style.display = 'inline-flex';
  cpBtn.style.display = 'inline-flex';
}

function recDownloadJSON() {
  const str = recLastJson || JSON.stringify(recBuildConfig(), null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rhythm_config.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function recCopyJSON() {
  const str = recLastJson || JSON.stringify(recBuildConfig(), null, 2);
  navigator.clipboard.writeText(str).then(() => {
    recSetStatus('config <span>copied to clipboard</span>');
  }).catch(() => {
    recSetStatus('<span style="color:var(--accent3)">clipboard copy failed</span>');
  });
}

/* ══════════════════════════════════════════
   OFFICIAL LEVELS — CSV loader & list
══════════════════════════════════════════ */

const OFFICIAL_LEVELS_CSV = 'official_levels.csv';

let officialLevels = [];       // parsed rows
let officialLevelsLoaded = false;

/** Parse a CSV string into an array of objects using the header row as keys */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields that may contain commas
    const fields = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    fields.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = fields[i] !== undefined ? fields[i] : ''; });
    return obj;
  });
}

/** Format seconds (e.g. 187) to "3:07" */
function formatLength(seconds) {
  const s = parseInt(seconds, 10);
  if (isNaN(s)) return seconds;
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Return a CSS class name and label for a difficulty value (1–10) */
function diffClass(d) {
  const n = parseInt(d, 10);
  if (isNaN(n)) return { cls: 'diff-mid', label: d };
  if (n <= 3) return { cls: 'diff-easy', label: `★ ${d}` };
  if (n <= 6) return { cls: 'diff-mid', label: `★ ${d}` };
  if (n <= 8) return { cls: 'diff-hard', label: `★ ${d}` };
  return { cls: 'diff-ex', label: `★ ${d}` };
}

/** Render the levels list with optional filter string & sort key */
function renderLevelsList(filter = '', sort = 'default') {
  const list = document.getElementById('levelsList');
  list.innerHTML = '';

  let rows = [...officialLevels];

  // Filter
  if (filter) {
    const q = filter.toLowerCase();
    rows = rows.filter(r =>
      (r.song_name || '').toLowerCase().includes(q) ||
      (r.artist || '').toLowerCase().includes(q)
    );
  }

  // Sort
  if (sort === 'name') rows.sort((a, b) => (a.song_name || '').localeCompare(b.song_name || ''));
  if (sort === 'artist') rows.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
  if (sort === 'difficulty') rows.sort((a, b) => parseInt(a.difficulty || 0) - parseInt(b.difficulty || 0));
  if (sort === 'length') rows.sort((a, b) => parseInt(a.length_seconds || 0) - parseInt(b.length_seconds || 0));

  if (rows.length === 0) {
    list.innerHTML = '<div class="levels-empty">No levels found.</div>';
    return;
  }

  rows.forEach(row => {
    const diff = diffClass(row.difficulty);
    const card = document.createElement('div');
    card.className = 'level-card';
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="level-card-left">
        <div class="level-song">${row.song_name || '—'}</div>
        <div class="level-artist">${row.artist || '—'}</div>
      </div>
      <div class="level-card-right">
        <span class="level-diff ${diff.cls}">${diff.label}</span>
        <span class="level-len">⏱ ${formatLength(row.length_seconds)}</span>
        <span class="level-play-btn">PLAY ▶</span>
      </div>`;

    const play = () => {
      // Store selected level metadata so the game screen can use it
      window.selectedOfficialLevel = row;
      enterGame('OFFICIAL');
    };
    card.addEventListener('click', play);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
    list.appendChild(card);
  });
}

/** Load the CSV then init the list + search/sort controls */
async function initOfficialLevels() {
  const loading = document.getElementById('levelsLoading');

  try {
    const res = await fetch(OFFICIAL_LEVELS_CSV);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    officialLevels = parseCSV(text);
    officialLevelsLoaded = true;
  } catch (err) {
    if (loading) loading.innerHTML =
      `<span class="err">Could not load levels list: ${err.message}</span>`;
    return;
  }

  if (loading) loading.remove();
  renderLevelsList();

  const searchEl = document.getElementById('levelsSearch');
  const sortEl = document.getElementById('levelsSort');

  searchEl.addEventListener('input', () =>
    renderLevelsList(searchEl.value, sortEl.value));
  sortEl.addEventListener('change', () =>
    renderLevelsList(searchEl.value, sortEl.value));
}

// Lazy-load when the screen is shown for the first time
document.addEventListener('DOMContentLoaded', () => {
  // Observe screen-official-levels becoming active
  const observer = new MutationObserver(() => {
    if (document.getElementById('screen-official-levels').classList.contains('active') &&
      !officialLevelsLoaded) {
      initOfficialLevels();
    }
  });
  observer.observe(document.getElementById('screen-official-levels'), { attributes: true, attributeFilter: ['class'] });
});

/* ══════════════════════════════════════════
   GUIDE LINES
   Each of the 8 note cells has a fixed travel
   axis.  We draw a line from the far edge of
   the cell (the side the note comes from) all
   the way to the matching edge of the screen.

   Travel directions per cell id:
     tl → from top-left  (diagonal)
     tc → from top        (straight up)
     tr → from top-right  (diagonal)
     ml → from left       (straight left)
     mr → from right      (straight right)
     bl → from bot-left   (diagonal)
     bc → from bottom     (straight down)
     br → from bot-right  (diagonal)
══════════════════════════════════════════ */

function initGuideLines() {
  const canvas = document.getElementById('guideCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // direction each cell's notes travel FROM (outward vector)
  const GUIDE_DIRS = {
    tl: { dx: -1, dy: -1 },
    tc: { dx: 0, dy: -1 },
    tr: { dx: 1, dy: -1 },
    ml: { dx: -1, dy: 0 },
    mr: { dx: 1, dy: 0 },
    bl: { dx: -1, dy: 1 },
    bc: { dx: 0, dy: 1 },
    br: { dx: 1, dy: 1 },
  };

  function drawGuides() {
    // Size canvas to the full viewport so lines reach every edge/corner
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    Object.entries(GUIDE_DIRS).forEach(([cellId, dir]) => {
      const cell = document.getElementById(`cell-${cellId}`);
      if (!cell) return;

      const cellRect = cell.getBoundingClientRect();

      // Center of cell in viewport coords (canvas is fixed full-screen)
      const cx = cellRect.left + cellRect.width / 2;
      const cy = cellRect.top + cellRect.height / 2;

      // Start point: edge/corner of the cell facing outward
      const ex = cx + dir.dx * (cellRect.width / 2);
      const ey = cy + dir.dy * (cellRect.height / 2);

      // Project ray to the viewport boundary
      let t = Infinity;
      if (dir.dx < 0) t = Math.min(t, ex / -dir.dx);
      if (dir.dx > 0) t = Math.min(t, (canvas.width - ex) / dir.dx);
      if (dir.dy < 0) t = Math.min(t, ey / -dir.dy);
      if (dir.dy > 0) t = Math.min(t, (canvas.height - ey) / dir.dy);

      const endX = ex + dir.dx * t;
      const endY = ey + dir.dy * t;

      ctx.save();
      ctx.strokeStyle = 'rgba(124, 111, 255, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
    });
  }

  function onScreenChange() {
    if (document.getElementById('screen-game').classList.contains('active')) {
      requestAnimationFrame(() => requestAnimationFrame(drawGuides));
    }
  }

  new MutationObserver(onScreenChange).observe(
    document.getElementById('screen-game'),
    { attributes: true, attributeFilter: ['class'] }
  );

  window.addEventListener('resize', () => {
    if (document.getElementById('screen-game').classList.contains('active')) drawGuides();
  });

  onScreenChange();
}
/* ══════════════════════════════════════════
   KEYBIND SYSTEM
══════════════════════════════════════════ */
function initKeybinds() {
  const CELL_IDS = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
  let listeningBtn = null;
  let listeningAction = null;

  // Reverse lookup: action → key
  function reverseMap() {
    const rev = {};
    Object.entries(KEY_MAP).forEach(([k, v]) => { rev[v] = k; });
    return rev;
  }

  function updateBtnLabels() {
    const rev = reverseMap();
    CELL_IDS.forEach(action => {
      const btn = document.getElementById('kb-' + action);
      if (btn) btn.textContent = (rev[action] || '?').toUpperCase();
    });
    // Also update the cell key labels inside the game grid
    CELL_IDS.forEach(action => {
      const cell = document.getElementById('cell-' + action);
      if (cell) {
        const keySpan = cell.querySelector('.cell-key');
        if (keySpan) {
          const rev2 = reverseMap();
          keySpan.textContent = (rev2[action] || '?').toUpperCase();
        }
      }
    });
  }

  function stopListening() {
    if (listeningBtn) {
      listeningBtn.classList.remove('listening');
      listeningBtn.textContent = listeningBtn.dataset.currentKey || '?';
    }
    listeningBtn = null;
    listeningAction = null;
  }

  CELL_IDS.forEach(action => {
    const btn = document.getElementById('kb-' + action);
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (listeningBtn === btn) {
        // Already listening — cancel
        stopListening();
        return;
      }
      stopListening();
      listeningBtn = btn;
      listeningAction = action;
      btn.classList.add('listening');
      btn.textContent = '…';
    });
  });

  document.addEventListener('keydown', e => {
    if (!listeningAction) return;

    // Ignore modifier keys, Escape cancels
    if (e.key === 'Escape') { stopListening(); return; }
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return;

    e.preventDefault();

    const newKey = e.key.toLowerCase();

    // Don't allow binding a key already in use by a different action
    const existingAction = KEY_MAP[newKey];
    if (existingAction && existingAction !== listeningAction) {
      // Swap: remove old binding for that key
      delete KEY_MAP[newKey];
    }

    // Remove old key binding for this action
    Object.keys(KEY_MAP).forEach(k => {
      if (KEY_MAP[k] === listeningAction) delete KEY_MAP[k];
    });

    // Set new binding
    KEY_MAP[newKey] = listeningAction;
    listeningBtn.dataset.currentKey = newKey.toUpperCase();
    stopListening();
    updateBtnLabels();
  });

  // Reset button
  const resetBtn = document.getElementById('keybindReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      stopListening();
      KEY_MAP = { ...DEFAULT_KEY_MAP };
      updateBtnLabels();
    });
  }

  // Init labels on load
  updateBtnLabels();
}