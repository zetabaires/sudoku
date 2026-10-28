/* UI and local persistence. No network requests. */
(() => {
  'use strict';
  const S = window.Sudoku, $ = id => document.getElementById(id), SAVE = 'sudoku-simple-v1';
  let game = null, paused = false, foreground = true, selectedLevel = 'medium', lastTick = Date.now(), wasModalPaused = false;
  let storageAvailable = true;
  let autocompleting = false, autocompleteRun = 0;
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE));
      if (!S.validSave(saved)) return null;
      saved.history = []; // Resume the board; undo starts from this session.
      saved.selected = Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < 81 ? saved.selected : -1;
      saved.completed = saved.board.every((n, i) => n === saved.solution[i]);
      saved.autoCompleted = !!saved.autoCompleted && saved.completed;
      saved.notesMode = !!saved.notesMode;
      return saved;
    } catch (_) { return null; }
  }
  function save() {
    if (!game) return;
    try { localStorage.setItem(SAVE, JSON.stringify(game)); }
    catch (_) { storageAvailable = false; }
  }
  const formatTime = ms => {
    const total = Math.floor(ms / 1000), minutes = Math.floor(total / 60);
    return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  function tick() {
    const now = Date.now();
    if (game && !paused && foreground && !document.hidden && !game.completed && !$('new-dialog').open) game.elapsed += Math.max(0, now - lastTick);
    lastTick = now;
    if (game) $('timer').textContent = formatTime(game.elapsed);
  }
  function setPause(value) {
    tick(); paused = value; lastTick = Date.now();
    $('pause-cover').hidden = !paused;
    $('pause').setAttribute('aria-label', paused ? 'Continuar partida' : 'Pausar partida');
    $('pause').querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
    $('board').inert = paused;
    render(); save();
  }
  const cellElements = [];
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell'; cell.type = 'button'; cell.dataset.index = i;
    cell.addEventListener('click', () => {
      if (!game || paused || game.completed || autocompleting) return;
      game.selected = i; render(); save();
    });
    $('board').appendChild(cell); cellElements.push(cell);
  }
  for (let n = 1; n <= 9; n++) {
    const key = document.createElement('button'); key.className = 'number'; key.type = 'button';
    key.innerHTML = `<span class="digit">${n}</span><span class="remaining">9</span>`;
    key.dataset.digit = n; key.addEventListener('click', () => input(n)); $('keypad').appendChild(key);
  }
  function render() {
    if (!game) return;
    $('level-name').textContent = S.LEVELS[game.level].label;
    $('timer').textContent = formatTime(game.elapsed);
    const conflicts = S.conflicts(game.board), shades = S.highlights(game.board, game.selected);
    cellElements.forEach((cell, i) => {
      const shade = shades[i], value = game.board[i];
      cell.className = ['cell', shade.related ? 'related' : '', shade.match ? 'match' : '', shade.selected ? 'selected' : '', value && !game.puzzle[i] ? 'entered' : '', conflicts.has(i) ? 'conflict' : ''].filter(Boolean).join(' ');
      cell.replaceChildren();
      if (value) cell.textContent = value;
      else if (game.notes[i]) {
        const pencil = document.createElement('span'); pencil.className = 'pencil';
        for (let n = 1; n <= 9; n++) {
          const small = document.createElement('span'); small.textContent = game.notes[i] & (1 << n) ? n : ''; pencil.appendChild(small);
        }
        cell.appendChild(pencil);
      }
      const noteDigits = Array.from({length:9}, (_,n)=>n+1).filter(n=>game.notes[i] & (1<<n));
      cell.setAttribute('aria-label', `Fila ${S.row(i) + 1}, columna ${S.col(i) + 1}: ${value || 'vacía'}${game.puzzle[i] ? ', fija' : ''}${noteDigits.length ? ', notas ' + noteDigits.join(', ') : ''}${conflicts.has(i) ? ', en conflicto' : ''}`);
      cell.setAttribute('aria-pressed', String(shade.selected));
    });
    const locked = paused || game.completed || autocompleting;
    $('board').inert = paused || autocompleting;
    const offerAutocomplete = !locked && S.canAutocomplete(game);
    $('autocomplete').hidden = !offerAutocomplete;
    $('status').hidden = offerAutocomplete;
    $('undo').disabled = locked || !game.history.length;
    $('erase').disabled = locked || game.selected < 0 || !!game.puzzle[game.selected] || (!game.board[game.selected] && !game.notes[game.selected]);
    $('notes').disabled = locked;
    $('hint').disabled = locked;
    $('pause').disabled = game.completed || autocompleting;
    $('new-game').disabled = autocompleting;
    $('level-button').disabled = autocompleting;
    $('notes').setAttribute('aria-pressed', String(game.notesMode));
    $('notes-badge').textContent = game.notesMode ? 'On' : 'Off';
    for (const key of $('keypad').children) {
      const n = Number(key.dataset.digit), remaining = Math.max(0, 9 - game.board.filter(v => v === n).length);
      key.querySelector('.remaining').textContent = remaining;
      key.classList.toggle('done', remaining === 0); key.disabled = locked;
      key.setAttribute('aria-label', `Número ${n}, ${remaining} por colocar`);
    }
    $('status').textContent = !storageAvailable ? 'No se pudo guardar la partida en este dispositivo.' :
      autocompleting ? 'Completando el tablero…' :
      game.completed ? '¡Tablero completo! Bien jugado.' : paused ? 'Partida en pausa.' :
      conflicts.size ? 'Hay números repetidos. Podés corregirlos o deshacer.' :
      game.notesMode ? 'Modo notas: anotá los números posibles.' :
      game.selected < 0 ? 'Elegí una casilla para empezar.' :
      game.puzzle[game.selected] ? 'Número fijo · sus coincidencias están resaltadas.' : 'Elegí un número para esta casilla.';
  }
  function afterMove(changed) {
    if (!changed) return;
    tick(); save(); render();
    if (game.completed) {
      $('win-summary').textContent = `Terminaste el nivel ${S.LEVELS[game.level].label.toLowerCase()} en ${formatTime(game.elapsed)}.`;
      $('win-dialog').showModal();
    }
  }
  function input(n) {
    if (!game || paused || autocompleting || $('new-dialog').open || $('win-dialog').open) return;
    if (game.selected < 0) { $('status').textContent = 'Primero elegí una casilla del tablero.'; return; }
    afterMove(S.enter(game, n));
  }
  function chooseLevel(level) {
    selectedLevel = level;
    document.querySelectorAll('[data-level]').forEach(b => {
      const chosen = b.dataset.level === level;
      b.classList.toggle('chosen', chosen); b.setAttribute('aria-pressed', String(chosen));
    });
  }
  function openNew() {
    if (autocompleting) return;
    tick(); wasModalPaused = paused;
    chooseLevel(game ? game.level : 'medium');
    $('dialog-copy').textContent = game && !game.completed ? 'Al empezar, se reemplazará tu partida actual.' : 'Elegí la dificultad y empezá a jugar.';
    $('cancel-new').hidden = !game;
    $('new-dialog').showModal();
  }
  $('new-game').addEventListener('click', openNew);
  $('level-button').addEventListener('click', openNew);
  document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => chooseLevel(b.dataset.level)));
  $('new-dialog').addEventListener('cancel', event => { if (!game) event.preventDefault(); });
  $('new-dialog').addEventListener('close', () => { lastTick = Date.now(); if (game) setPause(wasModalPaused); });
  $('start').addEventListener('click', () => {
    $('start').disabled = true; $('start').textContent = 'Preparando tablero…';
    setTimeout(() => {
      game = S.createGame(selectedLevel); wasModalPaused = false; paused = false;
      $('new-dialog').close(); lastTick = Date.now(); setPause(false); save(); render();
      $('start').disabled = false; $('start').textContent = 'Empezar a jugar';
    }, 30);
  });
  $('pause').addEventListener('click', () => { if (game && !game.completed) setPause(!paused); });
  $('resume').addEventListener('click', () => setPause(false));
  $('undo').addEventListener('click', () => afterMove(S.undo(game)));
  $('erase').addEventListener('click', () => input(0));
  $('notes').addEventListener('click', () => { game.notesMode = !game.notesMode; save(); render(); });
  $('hint').addEventListener('click', () => afterMove(S.hint(game)));
  $('autocomplete').addEventListener('click', async () => {
    if (!game || paused || autocompleting || $('new-dialog').open || $('win-dialog').open || !S.canAutocomplete(game)) return;
    const target = game, run = ++autocompleteRun;
    autocompleting = true;
    render();
    const finished = await S.autocomplete(target, {
      isActive: () => run === autocompleteRun && game === target && foreground && !document.hidden && !paused,
      onStep: () => { tick(); save(); render(); }
    });
    if (run !== autocompleteRun || game !== target) return;
    autocompleting = false;
    render();
    if (finished) afterMove(true);
  });
  $('play-again').addEventListener('click', () => { $('win-dialog').close(); openNew(); });
  $('close-win').addEventListener('click', () => $('win-dialog').close());
  document.addEventListener('keydown', e => {
    if (!game || paused || autocompleting || $('new-dialog').open || $('win-dialog').open || game.completed) return;
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); input(Number(e.key)); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); input(0); }
    else if (e.key.toLowerCase() === 'n') { $('notes').click(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); afterMove(S.undo(game)); }
    else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault(); const i = Math.max(0, game.selected), r = S.row(i), c = S.col(i);
      const nextRow = e.key === 'ArrowUp' ? (r + 8) % 9 : e.key === 'ArrowDown' ? (r + 1) % 9 : r;
      const nextCol = e.key === 'ArrowLeft' ? (c + 8) % 9 : e.key === 'ArrowRight' ? (c + 1) % 9 : c;
      game.selected = nextRow * 9 + nextCol; render(); cellElements[game.selected].focus();
    }
  });
  function background() {
    tick(); foreground = false;
    if (autocompleting) { autocompleteRun++; autocompleting = false; }
    save();
    if (game && !game.completed && !$('new-dialog').open) setPause(true);
    else render();
  }
  window.nativeVisibility = visible => { if (!visible) background(); else { foreground = true; lastTick = Date.now(); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) background(); else { foreground = true; lastTick = Date.now(); } });
  window.addEventListener('pagehide', background);
  setInterval(() => { tick(); save(); }, 1000);
  game = load();
  if (game) render(); else openNew();
})();
