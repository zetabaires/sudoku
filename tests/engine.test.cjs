const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../app/src/main/assets/engine.js');

for (const level of Object.keys(S.LEVELS)) {
  test(`${level}: 25 generated puzzles are valid and have exactly one solution`, () => {
    for (let n = 0; n < 25; n++) {
      const g = S.createGame(level);
      assert.equal(S.countSolutions(g.puzzle), 1);
      assert.equal(S.conflicts(g.solution).size, 0);
      assert.ok(g.puzzle.filter(Boolean).length >= S.LEVELS[level].clues);
      assert.ok(g.puzzle.filter(Boolean).length <= S.LEVELS[level].clues + 3);
      assert.ok(S.validSave(g));
    }
  });
}
test('selection shades all 21 cells in the row, column and box, plus matching digits', () => {
  const board = Array(81).fill(0); board[40] = 5; board[0] = 5; board[80] = 5;
  const shades = S.highlights(board, 40);
  assert.equal(shades.filter(s => s.related).length, 21);
  for (let i = 0; i < 81; i++) {
    const expected = Math.floor(i / 9) === 4 || i % 9 === 4 || (Math.floor(i / 9) >= 3 && Math.floor(i / 9) <= 5 && i % 9 >= 3 && i % 9 <= 5);
    assert.equal(shades[i].related, expected, `cell ${i}`);
  }
  assert.deepEqual(shades.flatMap((s, i) => s.match ? [i] : []), [0, 40, 80]);
  assert.equal(shades.filter(s => s.selected).length, 1);
  assert.equal(S.highlights(board, -1).filter(s => s.related || s.match).length, 0);
});
test('clues cannot be changed; entry, erase, undo and notes restore exactly', () => {
  const g = S.createGame(); g.selected = g.puzzle.findIndex(Boolean);
  const fixed = g.board[g.selected]; assert.equal(S.enter(g, 0), false); assert.equal(g.board[g.selected], fixed);
  g.selected = g.puzzle.indexOf(0); const i = g.selected;
  g.notesMode = true; S.enter(g, 4); assert.equal(g.notes[i], 1 << 4); assert.equal(g.board[i], 0);
  S.enter(g, 4); assert.equal(g.notes[i], 0); S.undo(g); assert.equal(g.notes[i], 1 << 4);
  g.notesMode = false; S.enter(g, g.solution[i]); assert.equal(g.notes[i], 0);
  S.undo(g); assert.equal(g.board[i], 0); assert.equal(g.notes[i], 1 << 4);
  S.enter(g, 0); assert.equal(g.notes[i], 0); S.undo(g); assert.equal(g.notes[i], 1 << 4);
});
test('entering a value cleans peer notes; undo restores those notes', () => {
  const g = S.createGame(); g.selected = g.puzzle.indexOf(0);
  const peer = g.board.findIndex((n, i) => !n && i !== g.selected && S.peers(i, g.selected));
  const digit = g.solution[g.selected]; g.notes[peer] = (1 << digit) | (1 << (digit % 9 + 1));
  const original = g.notes[peer]; S.enter(g, digit); assert.equal(g.notes[peer] & (1 << digit), 0);
  S.undo(g); assert.equal(g.notes[peer], original);
});
test('hints work with notes enabled and can finish a puzzle', () => {
  const g = S.createGame(); g.notesMode = true;
  let steps = 0;
  while (!g.completed && steps++ < 82) S.hint(g);
  assert.equal(g.completed, true); assert.deepEqual(g.board, g.solution);
  assert.equal(S.enter(g, 0), false); assert.equal(S.hint(g), false);
  assert.equal(S.undo(g), true); assert.equal(g.completed, false);
});
test('duplicate detection covers row, column, box and leaves unrelated cells alone', () => {
  const board = Array(81).fill(0); board[0] = 2; board[8] = 2; board[72] = 2; board[10] = 2; board[40] = 2;
  assert.deepEqual([...S.conflicts(board)].sort((a,b)=>a-b), [0,8,10,72]);
});
test('damaged saves are rejected', () => {
  assert.ok(!S.validSave(null)); const g = S.createGame(); g.board = []; assert.ok(!S.validSave(g));
  const h = S.createGame(); h.solution[0] = 0; assert.ok(!S.validSave(h));
});
function nearFinish(remaining) {
  const g = S.createGame();
  const editable = g.puzzle.flatMap((n, i) => n ? [] : [i]);
  g.board = [...g.solution];
  for (const i of editable.slice(0, remaining)) g.board[i] = 0;
  return g;
}
test('autocomplete is offered only with 1–10 remaining cells and correct entries', async () => {
  assert.equal(S.canAutocomplete(S.createGame()), false);
  assert.equal(S.canAutocomplete(nearFinish(11)), false);
  assert.equal(S.canAutocomplete(nearFinish(10)), true);
  assert.equal(S.canAutocomplete(nearFinish(1)), true);
  assert.equal(S.canAutocomplete(nearFinish(0)), false);
  const g = nearFinish(10), i = g.puzzle.findIndex((n,j) => !n && g.board[j]);
  g.board[i] = g.solution[i] % 9 + 1;
  assert.equal(S.canAutocomplete(g), false);
  assert.equal(await S.autocomplete(g), false);
});
test('autocomplete does not accept an incorrect non-conflicting entry', () => {
  const g = nearFinish(1), i = g.board.indexOf(0);
  // Empty the peers of one wrong value to ensure validation checks the solution,
  // rather than relying only on visible duplicate conflicts.
  const digit = g.solution[i] % 9 + 1;
  for (let j = 0; j < 81; j++) if (g.board[j] === digit && S.peers(i,j)) g.board[j] = 0;
  g.board[i] = digit;
  assert.equal(S.conflicts(g.board).size, 0);
  assert.ok(g.board.filter(n => !n).length <= 10);
  assert.equal(S.canAutocomplete(g), false);
});
test('autocomplete finishes once, clears notes, preserves clues and can be undone', async () => {
  const g = nearFinish(10), i = g.board.indexOf(0);
  g.notes[i] = (1 << 2) | (1 << 7); g.notesMode = true;
  const before = [...g.board], notes = [...g.notes], puzzle = [...g.puzzle];
  assert.equal(await S.autocomplete(g, { wait: async () => {} }), true);
  assert.deepEqual(g.board, g.solution); assert.deepEqual(g.puzzle, puzzle);
  assert.ok(g.notes.every(n => n === 0)); assert.equal(g.completed, true);
  assert.equal(g.autoCompleted, true); assert.equal(await S.autocomplete(g), false);
  assert.equal(S.canAutocomplete(g), false); assert.equal(S.validSave(JSON.parse(JSON.stringify(g))), true);
  for (let i = 0; i < 10; i++) assert.equal(S.undo(g), true);
  assert.deepEqual(g.board, before); assert.deepEqual(g.notes, notes);
  assert.equal(g.completed, false); assert.equal(g.autoCompleted, false);
});
test('ineligible autocomplete leaves the game unchanged', async () => {
  const g = nearFinish(11), before = JSON.stringify(g);
  assert.equal(await S.autocomplete(g), false); assert.equal(JSON.stringify(g), before);
});
test('autocomplete reveals one cell per delay and waits after the final number', async () => {
  const g = nearFinish(3), waits = [], shown = [];
  let settled = false;
  const completion = S.autocomplete(g, {
    wait: ms => new Promise(resolve => waits.push({ ms, resolve })),
    onStep: i => shown.push({ i, remaining: g.board.filter(n => !n).length, completed: g.completed })
  });
  completion.then(() => { settled = true; });
  assert.equal(g.board.filter(n => !n).length, 3);
  for (let step = 0; step < 3; step++) {
    assert.equal(waits[step].ms, 220);
    waits[step].resolve(); await Promise.resolve();
    assert.equal(shown.length, step + 1);
    assert.equal(shown[step].remaining, 2 - step);
    assert.equal(shown[step].completed, step === 2);
    assert.equal(g.selected, shown[step].i);
    assert.equal(g.board[shown[step].i], g.solution[shown[step].i]);
    assert.equal(settled, false);
  }
  assert.equal(waits[3].ms, 250); assert.equal(settled, false);
  waits[3].resolve(); assert.equal(await completion, true);
  assert.equal(shown.length, 3); assert.equal(g.autoCompleted, true);
});
test('interrupting autocomplete preserves shown values and cancels pending cells', async () => {
  const g = nearFinish(3), waits = [];
  let active = true, shown = 0;
  const completion = S.autocomplete(g, {
    wait: () => new Promise(resolve => waits.push(resolve)),
    isActive: () => active,
    onStep: () => { shown++; assert.equal(S.validSave(JSON.parse(JSON.stringify(g))), true); }
  });
  waits[0](); await Promise.resolve();
  assert.equal(shown, 1); const saved = JSON.stringify(g);
  active = false; waits[1]();
  assert.equal(await completion, false); assert.equal(JSON.stringify(g), saved);
  assert.equal(g.completed, false); assert.equal(g.board.filter(n => !n).length, 2);
  assert.equal(await S.autocomplete(g, { wait: async () => {} }), true);
  assert.equal(g.completed, true);
});
