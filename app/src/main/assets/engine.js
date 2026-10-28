/* Pure game rules, shared by the Android app and the standalone preview. */
(function (root) {
  'use strict';
  const LEVELS = {
    easy: { label: 'Fácil', clues: 42 },
    medium: { label: 'Intermedio', clues: 33 },
    hard: { label: 'Difícil', clues: 27 }
  };
  const row = i => Math.floor(i / 9);
  const col = i => i % 9;
  const box = i => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
  const peers = (a, b) => row(a) === row(b) || col(a) === col(b) || box(a) === box(b);
  const shuffle = items => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  function countSolutions(input, limit = 2) {
    const cells = [...input], rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      if (!cells[i]) continue;
      const bit = 1 << cells[i], r = row(i), c = col(i), b = box(i);
      if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }
    let count = 0;
    function visit() {
      let best = -1, mask = 0, size = 10;
      for (let i = 0; i < 81; i++) {
        if (cells[i]) continue;
        const options = 1022 & ~(rows[row(i)] | cols[col(i)] | boxes[box(i)]);
        let n = options, bits = 0;
        while (n) { n &= n - 1; bits++; }
        if (!bits) return;
        if (bits < size) { best = i; mask = options; size = bits; }
        if (bits === 1) break;
      }
      if (best === -1) { count++; return; }
      const r = row(best), c = col(best), b = box(best);
      for (let digit = 1; digit <= 9 && count < limit; digit++) {
        const bit = 1 << digit;
        if (!(mask & bit)) continue;
        cells[best] = digit; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        visit();
        cells[best] = 0; rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;
      }
    }
    visit(); return count;
  }
  function generate(level) {
    if (!LEVELS[level]) level = 'medium';
    const groups = [0, 1, 2];
    const rows = shuffle(groups).flatMap(g => shuffle(groups).map(i => g * 3 + i));
    const cols = shuffle(groups).flatMap(g => shuffle(groups).map(i => g * 3 + i));
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const solution = rows.flatMap(r => cols.map(c => digits[(r * 3 + Math.floor(r / 3) + c) % 9]));
    let puzzle = [...solution];
    let clues = 81;
    for (const i of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
      const old = puzzle[i]; puzzle[i] = 0;
      if (countSolutions(puzzle) !== 1) puzzle[i] = old;
      else clues--;
      if (clues === LEVELS[level].clues) break;
    }
    return { puzzle, solution, level };
  }
  function conflicts(board) {
    const result = new Set();
    for (let i = 0; i < 81; i++) {
      if (!board[i]) continue;
      for (let j = i + 1; j < 81; j++) {
        if (board[i] === board[j] && peers(i, j)) { result.add(i); result.add(j); }
      }
    }
    return result;
  }
  function highlights(board, selected) {
    return board.map((value, i) => ({
      selected: i === selected,
      related: selected >= 0 && peers(i, selected),
      match: selected >= 0 && board[selected] > 0 && value === board[selected]
    }));
  }
  function createGame(level = 'medium') {
    const generated = generate(level);
    return { ...generated, board: [...generated.puzzle], notes: Array(81).fill(0), history: [], selected: -1,
      notesMode: false, elapsed: 0, completed: false, autoCompleted: false };
  }
  function snapshot(game) {
    game.history.push({ board: [...game.board], notes: [...game.notes], selected: game.selected });
    if (game.history.length > 100) game.history.shift();
  }
  function enter(game, digit, hint = false) {
    const i = game.selected;
    if (i < 0 || game.puzzle[i] || game.completed || digit < 0 || digit > 9) return false;
    if (game.notesMode && digit && !hint) {
      if (game.board[i]) return false;
      snapshot(game); game.notes[i] ^= 1 << digit;
    } else {
      if (game.board[i] === digit && game.notes[i] === 0) return false;
      snapshot(game); game.board[i] = digit; game.notes[i] = 0;
      if (digit) for (let j = 0; j < 81; j++) {
        if (j !== i && peers(i, j)) game.notes[j] &= ~(1 << digit);
      }
    }
    game.completed = game.board.every((n, j) => n === game.solution[j]);
    return true;
  }
  function undo(game) {
    const prev = game.history.pop();
    if (!prev) return false;
    Object.assign(game, prev, { completed: false, autoCompleted: false }); return true;
  }
  function hint(game) {
    let i = game.selected;
    if (i < 0 || game.puzzle[i] || game.board[i] === game.solution[i]) {
      i = game.board.findIndex((n, j) => n !== game.solution[j]);
    }
    if (i < 0 || game.completed) return false;
    game.selected = i;
    return enter(game, game.solution[i], true);
  }
  function canAutocomplete(game) {
    if (game.completed) return false;
    let remaining = 0;
    for (let i = 0; i < 81; i++) {
      if (!game.board[i]) remaining++;
      else if (game.board[i] !== game.solution[i]) return false;
    }
    return remaining > 0 && remaining <= 10;
  }
  async function autocomplete(game, {
    wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
    onStep = () => {},
    isActive = () => true
  } = {}) {
    if (!canAutocomplete(game)) return false;
    const emptyCells = game.board.flatMap((n, i) => n ? [] : [i]);
    for (const i of emptyCells) {
      if (!isActive()) return false;
      await wait(220);
      if (!isActive()) return false;
      game.selected = i;
      enter(game, game.solution[i], true);
      if (game.completed) game.autoCompleted = true;
      onStep(i);
    }
    // Let the last number remain visible before showing the completion dialog.
    await wait(250);
    return isActive();
  }
  function validSave(g) {
    const digits = a => Array.isArray(a) && a.length === 81 && a.every(n => Number.isInteger(n) && n >= 0 && n <= 9);
    return g && LEVELS[g.level] && digits(g.puzzle) && digits(g.board) && digits(g.solution) &&
      g.solution.every(n => n > 0) && conflicts(g.solution).size === 0 &&
      g.puzzle.every((n, i) => !n || (n === g.solution[i] && n === g.board[i])) &&
      Array.isArray(g.notes) && g.notes.length === 81 && g.notes.every(n => Number.isInteger(n) && n >= 0 && n <= 1022) &&
      Number.isFinite(g.elapsed) && g.elapsed >= 0;
  }
  const api = { LEVELS, row, col, box, peers, countSolutions, generate, conflicts, highlights, createGame, enter, undo, hint, canAutocomplete, autocomplete, validSave };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sudoku = api;
})(typeof window !== 'undefined' ? window : globalThis);
