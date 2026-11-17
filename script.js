/* script.js - Presentation and animation only.
 * All puzzle logic (solving, move validation) is done by the Prolog server. */
(() => {
  'use strict';

  const TOWERS = ['a', 'b', 'c'];
  const TARGET = 'c';
  const BASE_OFFSET = 42; // px from board bottom to the first disk (label + base bar)

  const $ = (id) => document.getElementById(id);
  const els = {
    board: $('board'), layer: $('disksLayer'), loading: $('loading'), message: $('message'),
    badge: $('backendBadge'), modeManual: $('modeManual'), modeAuto: $('modeAuto'),
    diskCount: $('diskCount'), speed: $('speed'), speedLabel: $('speedLabel'),
    start: $('btnStart'), pause: $('btnPause'), resume: $('btnResume'), reset: $('btnReset'),
    statDisks: $('statDisks'), statMoves: $('statMoves'), statMin: $('statMin'), statTime: $('statTime'),
    progress: $('progress'), fill: $('progressFill'), progressText: $('progressText'),
    history: $('historyList'), historyEmpty: $('historyEmpty'),
    towerEls: Object.fromEntries(TOWERS.map((t) => [t, document.querySelector(`.tower[data-tower="${t}"]`)])),
  };

  const state = {
    mode: 'manual',
    disks: 3,
    towers: { a: [], b: [], c: [] },   // top disk first, same as the Prolog API
    moves: 0,
    minimum: 7,
    status: 'idle',                    // idle | running | paused | done
    selected: null,
    busy: false,
    runId: 0,                          // bumped on reset so old animations stop
    speed: 5,
    diskEls: new Map(),
    elapsedMs: 0, timerStart: null, timerId: null,
  };

  // ------------------------------------------------------------ utilities
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const phaseMs = () => Math.round(900 / state.speed);
  const centerPct = (tower) => ((TOWERS.indexOf(tower) * 2 + 1) / 6) * 100;
  const name = (tower) => tower.toUpperCase();

  function diskHeight() {
    const room = els.board.clientHeight - BASE_OFFSET - 56;
    return Math.max(14, Math.min(30, Math.floor(room / (state.disks + 1))));
  }
  const liftBottom = () => els.board.clientHeight - diskHeight() - 8;

  function setMessage(text, type = 'info') {
    els.message.textContent = text;
    els.message.className = `message ${type}`;
  }
  function setLoading(on) { els.loading.hidden = !on; }
  function setBackend(online) {
    els.badge.textContent = online ? 'Prolog server online' : 'Prolog server offline';
    els.badge.className = `badge ${online ? 'online' : 'offline'}`;
  }

  /** Talks to the Prolog server and turns failures into friendly errors. */
  async function api(path, options) {
    let response;
    try {
      response = await fetch(path, options);
    } catch (err) {
      setBackend(false);
      throw new Error('Cannot reach the Prolog server. Start it with "swipl server.pl" and open http://localhost:8080.');
    }
    let data = null;
    try { data = await response.json(); } catch (err) { /* non-JSON body */ }
    if (!response.ok) throw new Error((data && data.error) || `Server error (${response.status}).`);
    setBackend(true);
    return data;
  }

  // ---------------------------------------------------------------- timer
  const currentElapsed = () => state.elapsedMs + (state.timerStart ? performance.now() - state.timerStart : 0);
  function formatTime(ms) {
    const total = Math.floor(ms / 100);
    const tenths = total % 10, secs = Math.floor(total / 10) % 60, mins = Math.floor(total / 600);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }
  function startTimer() {
    if (state.timerId) return;
    state.timerStart = performance.now();
    state.timerId = setInterval(() => { els.statTime.textContent = formatTime(currentElapsed()); }, 100);
  }
  function stopTimer() {
    if (!state.timerId) return;
    state.elapsedMs = currentElapsed();
    state.timerStart = null;
    clearInterval(state.timerId);
    state.timerId = null;
    els.statTime.textContent = formatTime(state.elapsedMs);
  }

  // ------------------------------------------------------------ rendering
  function buildBoard() {
    els.layer.innerHTML = '';
    state.diskEls.clear();
    for (let size = state.disks; size >= 1; size--) {
      const el = document.createElement('div');
      el.className = 'disk';
      el.textContent = size;
      const hue = Math.round(((size - 1) / Math.max(state.disks, 1)) * 300 + 10);
      el.style.background = `linear-gradient(180deg, hsl(${hue} 85% 66%), hsl(${hue} 75% 48%))`;
      els.layer.appendChild(el);
      state.diskEls.set(size, el);
    }
    layoutAll();
  }

  /** Place every disk exactly where state.towers says it belongs (no animation). */
  function layoutAll() {
    const h = diskHeight();
    const slot = 100 / 3;
    TOWERS.forEach((tower) => {
      state.towers[tower].slice().reverse().forEach((size, index) => {
        const el = state.diskEls.get(size);
        if (!el) return;
        el.style.transition = 'none';
        el.style.height = `${h - 3}px`;
        el.style.width = `${slot * (0.34 + 0.6 * (size / state.disks))}%`;
        el.style.left = `${centerPct(tower)}%`;
        el.style.bottom = `${BASE_OFFSET + index * h}px`;
      });
    });
  }

  function updateUI() {
    const onTarget = state.towers[TARGET].length;
    const pct = Math.round((onTarget / state.disks) * 100);
    els.statDisks.textContent = state.disks;
    els.statMoves.textContent = state.moves;
    els.statMin.textContent = state.minimum;
    els.fill.style.width = `${pct}%`;
    els.progress.setAttribute('aria-valuenow', pct);
    els.progressText.textContent = `${onTarget} of ${state.disks} disks on tower ${name(TARGET)}`;

    const auto = state.mode === 'auto';
    els.start.disabled = !(auto && (state.status === 'idle' || state.status === 'done'));
    els.pause.disabled = !(auto && state.status === 'running');
    els.resume.disabled = !(auto && state.status === 'paused');
    els.modeManual.classList.toggle('active', !auto);
    els.modeAuto.classList.toggle('active', auto);
    els.modeManual.setAttribute('aria-pressed', String(!auto));
    els.modeAuto.setAttribute('aria-pressed', String(auto));
    els.board.classList.toggle('solved', state.status === 'done');
  }

  function recordMove(disk, from, to) {
    state.moves += 1;
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = `#${state.moves}`;
    const text = document.createElement('span');
    text.textContent = `Disk ${disk}: ${name(from)} to ${name(to)}`;
    li.append(n, text);
    els.history.appendChild(li);
    els.history.scrollTop = els.history.scrollHeight;
    els.historyEmpty.hidden = true;
  }

  // ------------------------------------------------------------ animation
  /** Lift the disk, slide it sideways, lower it onto the destination stack. */
  async function animateMove(size, from, to) {
    const el = state.diskEls.get(size);
    if (!el) return;
    const d = phaseMs();
    const h = diskHeight();
    const targetIndex = state.towers[to].length;       // stack height before the drop
    el.style.transition = `bottom ${d}ms ease-in-out, left ${d}ms ease-in-out`;
    el.classList.add('moving');
    el.style.bottom = `${liftBottom()}px`;
    await sleep(d + 15);
    el.style.left = `${centerPct(to)}%`;
    await sleep(d + 15);
    el.style.bottom = `${BASE_OFFSET + targetIndex * h}px`;
    await sleep(d + 15);
    el.classList.remove('moving');
  }

  function liftTop(tower, lifted) {
    const size = state.towers[tower][0];
    const el = state.diskEls.get(size);
    if (!el) return;
    const index = state.towers[tower].length - 1;
    el.style.transition = `bottom ${Math.min(phaseMs(), 250)}ms ease-out`;
    el.style.bottom = lifted ? `${liftBottom()}px` : `${BASE_OFFSET + index * diskHeight()}px`;
  }

  function clearSelection(lowerDisk) {
    if (state.selected === null) return;
    if (lowerDisk) liftTop(state.selected, false);
    els.towerEls[state.selected].classList.remove('selected');
    state.selected = null;
  }

  function shake(tower) {
    const el = els.towerEls[tower];
    el.classList.remove('shake');
    void el.offsetWidth;                                // restart the animation
    el.classList.add('shake');
  }

  // --------------------------------------------------------- manual mode
  async function onTowerClick(tower) {
    if (state.mode !== 'manual' || state.busy || state.status === 'done') return;
    if (state.selected === null) {
      if (state.towers[tower].length === 0) {
        shake(tower);
        return setMessage(`Tower ${name(tower)} has no disks to move.`, 'error');
      }
      state.selected = tower;
      els.towerEls[tower].classList.add('selected');
      liftTop(tower, true);
      return setMessage(`Disk ${state.towers[tower][0]} lifted. Click the tower to drop it on.`);
    }
    if (state.selected === tower) {
      clearSelection(true);
      return setMessage('Disk put back. Pick a tower to start a move.');
    }
    await attemptManualMove(state.selected, tower);
  }

  async function attemptManualMove(from, to) {
    state.busy = true;
    setLoading(true);
    let result;
    try {
      result = await api('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: state.towers, from, to, target: TARGET }),
      });
    } catch (err) {
      clearSelection(true);
      state.busy = false;
      setLoading(false);
      return setMessage(err.message, 'error');
    }
    setLoading(false);

    if (!result.valid) {
      clearSelection(true);
      shake(to);
      state.busy = false;
      return setMessage(`Invalid move: ${result.reason}`, 'error');
    }

    const runId = state.runId;
    startTimer();
    els.towerEls[from].classList.remove('selected');
    state.selected = null;
    await animateMove(result.move.disk, from, to);
    if (runId !== state.runId) return;                  // reset while animating
    state.towers = result.state;                        // state returned by Prolog
    recordMove(result.move.disk, from, to);
    state.busy = false;
    updateUI();
    if (result.solved) finish();
    else setMessage(`Moved disk ${result.move.disk} from ${name(from)} to ${name(to)}.`);
  }

  // ------------------------------------------------------- automatic mode
  async function startAuto() {
    if (state.mode !== 'auto' || state.status === 'running') return;
    await resetPuzzle();
    const runId = state.runId;

    setLoading(true);
    let solution;
    try {
      solution = await api(`/api/solve?disks=${state.disks}&from=a&to=${TARGET}`);
    } catch (err) {
      setLoading(false);
      return setMessage(err.message, 'error');
    }
    setLoading(false);
    if (runId !== state.runId) return;

    state.minimum = solution.minimum;
    state.status = 'running';
    startTimer();
    updateUI();
    setMessage(`Prolog produced ${solution.count} moves. Watch it solve the puzzle.`);

    for (const move of solution.moves) {
      while (state.status === 'paused' && runId === state.runId) await sleep(80);
      if (runId !== state.runId) return;
      await animateMove(move.disk, move.from, move.to);
      if (runId !== state.runId) return;
      // Mirror the move on screen (the move itself came from Prolog).
      state.towers[move.from].shift();
      state.towers[move.to].unshift(move.disk);
      recordMove(move.disk, move.from, move.to);
      updateUI();
    }
    finish();
  }

  function pauseAuto() {
    if (state.status !== 'running') return;
    state.status = 'paused';
    stopTimer();
    updateUI();
    setMessage('Paused. The current move finishes first. Press Resume to continue.');
  }

  function resumeAuto() {
    if (state.status !== 'paused') return;
    state.status = 'running';
    startTimer();
    updateUI();
    setMessage('Resumed.');
  }

  function finish() {
    state.status = 'done';
    stopTimer();
    state.busy = false;
    updateUI();
    const optimal = state.moves === state.minimum;
    setMessage(`Solved in ${state.moves} moves (${formatTime(state.elapsedMs)}). ${optimal ? 'That is the minimum possible.' : `The minimum is ${state.minimum}.`}`, 'success');
  }

  // ---------------------------------------------------------------- reset
  async function resetPuzzle() {
    state.runId += 1;
    stopTimer();
    clearSelection(false);
    state.elapsedMs = 0;
    state.moves = 0;
    state.status = 'idle';
    state.busy = false;
    state.towers = { a: Array.from({ length: state.disks }, (_, i) => i + 1), b: [], c: [] };
    els.history.innerHTML = '';
    els.historyEmpty.hidden = false;
    els.statTime.textContent = formatTime(0);
    buildBoard();
    updateUI();
    setMessage(state.mode === 'manual'
      ? 'Click a tower to lift its top disk.'
      : 'Press Start and Prolog will solve the puzzle.');
    try {
      const info = await api(`/api/info?disks=${state.disks}`);
      state.minimum = info.minimum;
      updateUI();
    } catch (err) {
      setMessage(err.message, 'error');
    }
  }

  function setMode(mode) {
    state.mode = mode;
    resetPuzzle();
  }

  // --------------------------------------------------------------- events
  TOWERS.forEach((tower) => {
    const el = els.towerEls[tower];
    el.addEventListener('click', () => onTowerClick(tower));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTowerClick(tower); }
    });
  });
  els.modeManual.addEventListener('click', () => setMode('manual'));
  els.modeAuto.addEventListener('click', () => setMode('auto'));
  els.diskCount.addEventListener('change', () => {
    state.disks = parseInt(els.diskCount.value, 10);
    resetPuzzle();
  });
  els.speed.addEventListener('input', () => {
    state.speed = parseInt(els.speed.value, 10);
    els.speedLabel.textContent = state.speed;
  });
  els.start.addEventListener('click', startAuto);
  els.pause.addEventListener('click', pauseAuto);
  els.resume.addEventListener('click', resumeAuto);
  els.reset.addEventListener('click', resetPuzzle);
  window.addEventListener('resize', () => { if (!state.busy && state.status !== 'running') { clearSelection(false); layoutAll(); } });

  // ----------------------------------------------------------------- init
  if (location.protocol === 'file:') {
    setBackend(false);
    setMessage('Open this page through the Prolog server at http://localhost:8080 (run "swipl server.pl" first).', 'error');
  } else {
    resetPuzzle();
  }
})();
