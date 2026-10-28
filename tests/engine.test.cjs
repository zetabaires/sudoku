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
