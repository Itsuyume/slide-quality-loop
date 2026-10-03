import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSnapshot } from '../src/domain/checks.js';
import { contractSchema, snapshotSchema } from '../src/domain/schema.js';
import { contrast, isGreen } from '../src/domain/colors.js';
import { contract, snapshot } from './fixtures.js';

test('a complete readable specimen passes only mechanical gates', () => {
  assert.equal(checkSnapshot(snapshot(), contract()).status, 'pass');
});
test('missing content is rejected even if remaining layout is clean', () => {
  const s = snapshot(); s.texts = s.texts.filter(t => t.name !== 'people');
  assert.ok(checkSnapshot(s, contract()).issues.some(i => i.code === 'missing-content'));
});
test('all words being present does not excuse wrong role binding', () => {
  const s = snapshot(); const role = s.texts.find(t => t.name === 'parent-role');
  assert.ok(role); role.text = 'Child';
  s.texts.push({ ...role, name: 'child-role', text: 'Parent', y: 400 });
  assert.ok(checkSnapshot(s, contract()).issues.some(i => i.code === 'wrong-binding'));
});
test('green surface rejected; blue, brown, neutral remain allowed', () => {
  for (const color of ['#008800', '#328c69', '#7eaa30', '#eaf8ee']) assert.equal(isGreen(color), true);
  for (const color of ['#285d9a', '#996331', '#889088', '#202326']) assert.equal(isGreen(color), false);
  const s = snapshot(); s.paints = [{ x: 0, y: 500, w: 100, h: 100, kind: 'background', color: '#008800' }];
  assert.ok(checkSnapshot(s, contract()).issues.some(i => i.code === 'prohibited-green'));
});
test('hidden, small, and low contrast text cannot pass', () => {
  const s = snapshot(); const text = s.texts[0]; assert.ok(text);
  text.visible = false; text.size = 12; text.color = '#eeeeee';
  const codes = checkSnapshot(s, contract()).issues.map(i => i.code);
  for (const code of ['hidden-content', 'small-type', 'low-contrast']) assert.ok(codes.includes(code));
});
test('white text uses the actual covering blue background for contrast', () => {
  const s = snapshot(); const text = s.texts[0]; assert.ok(text); text.color = '#ffffff';
  s.paints.push({ x: 0, y: 0, w: 800, h: 200, kind: 'background', color: '#285d9a' });
  assert.equal(checkSnapshot(s, contract()).status, 'pass');
  assert.equal(contrast('#000000', '#ffffff'), 21);
});
test('overlap, overflow, missing fonts and render failure reject', () => {
  const s = snapshot(); s.collisions.push({ a: 'people', b: 'parent-role' }); s.outside.push('people'); s.glyphsOutside = 2; s.ready = false; s.loadedFonts = false;
  const codes = checkSnapshot(s, contract()).issues.map(i => i.code);
  for (const code of ['text-overlap', 'outside-canvas', 'glyph-outside', 'render-incomplete']) assert.ok(codes.includes(code));
});
test('legacy unmeasured visibility is unknown rather than passed', () => {
  const s = snapshot(); s.visibilityCoverage = 'legacy';
  assert.equal(checkSnapshot(s, contract()).status, 'unknown');
});
test('empty, null, NaN and negative canvas inputs fail schema validation', () => {
  for (const value of [null, {}, { ...snapshot(), texts: [] }, { ...snapshot(), width: NaN }, { ...snapshot(), height: -1 }]) {
    assert.equal(snapshotSchema.safeParse(value).success, false);
  }
  assert.equal(contractSchema.safeParse({ ...contract(), contentUnits: [] }).success, false);
});
test('duplicate text identity and role/canvas mismatch reject', () => {
  const s = snapshot(); const first = s.texts[0]; assert.ok(first); s.texts.push({ ...first }); s.role = 'quote'; s.width = 100;
  const codes = checkSnapshot(s, contract()).issues.map(i => i.code);
  for (const code of ['duplicate-id', 'wrong-role', 'wrong-canvas']) assert.ok(codes.includes(code));
});
