import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeComposition } from '../src/domain/composition.js';
import { boxDistance, routeLength, unionBounds } from '../src/domain/geometry.js';
import { readNativeRoute } from '../src/adapters/native-routes.js';
import { contractSchema, routeSchema } from '../src/domain/schema.js';
import { contract, snapshot } from './fixtures.js';

function specimen() {
  const terms = contract(), image = snapshot();
  terms.composition = { relations: [{ id: 'kinship', actors: ['people'], labels: ['parent-role'], routes: ['link'] }],
    attachments: [{ id: 'support', members: ['parent-role'], anchors: ['people'] }] };
  image.texts.forEach(text => { text.contentBox = { x: text.x, y: text.y, w: text.w, h: text.h }; });
  image.routes = [{ name: 'link', segments: [{ start: { x: 100, y: 180 }, end: { x: 100, y: 220 }, controlStart: null, controlEnd: null }] }];
  return { terms, image };
}

test('missing content geometry and missing routes stay unmeasured instead of ideal zeroes', () => {
  const { terms, image } = specimen(); const label = image.texts[1]; assert.ok(label);
  label.contentBox = null; image.routes = [];
  const result = analyzeComposition(image, terms); const relation = result.relations[0]; assert.ok(relation);
  assert.equal(result.status, 'unmeasured'); assert.equal(relation.labelToActorFontRatio, null);
  assert.equal(relation.maxLabelToActorGapEm, null); assert.equal(relation.routeLengthCanvasDiagonals, null);
  assert.deepEqual(relation.missing, ['parent-role', 'route:link']);
});

test('absent composition contract is not scored; null specifications fail validation', () => {
  assert.equal(analyzeComposition(snapshot(), contract()).status, 'not-configured');
  assert.equal(contractSchema.safeParse({ ...contract(), composition: null }).success, false);
  assert.equal(contractSchema.safeParse({ ...contract(), composition: { relations: [{ id: 'bad', actors: [], labels: [], routes: [] }], attachments: [] } }).success, false);
});

test('known gaps and relative type size are measured from visible character bounds', () => {
  const { terms, image } = specimen();
  const result = analyzeComposition(image, terms); const relation = result.relations[0], group = result.attachments[0];
  assert.ok(relation); assert.ok(group);
  assert.equal(relation.labelToActorFontRatio, 0.8); assert.equal(relation.maxLabelToActorGapEm, 1.25);
  assert.equal(group.farthestMemberGapEm, 1.25); assert.equal(result.automaticAestheticDecision, false);
});

test('empty diagnostics and duplicate references cannot produce misleading measurements', () => {
  assert.equal(contractSchema.safeParse({ ...contract(), composition: { relations: [], attachments: [] } }).success, false);
  const { terms } = specimen(); const relation = terms.composition?.relations[0]; assert.ok(relation);
  relation.routes.push('link'); assert.equal(contractSchema.safeParse(terms).success, false);
  relation.routes.pop(); terms.composition?.attachments.push({ id: 'kinship', members: ['parent-role'], anchors: ['people'] });
  assert.equal(contractSchema.safeParse(terms).success, false);
});

test('inflating allocation boxes cannot manufacture spatial proximity', () => {
  const { terms, image } = specimen(); const before = analyzeComposition(image, terms);
  image.texts.forEach(text => { text.x = 0; text.y = 0; text.w = 1920; text.h = 1080; });
  assert.deepEqual(analyzeComposition(image, terms), before);
});

test('shrinking labels and detaching support are separate observable changes', () => {
  const { terms, image } = specimen(); const label = image.texts[1]; assert.ok(label?.contentBox);
  label.size = 20; label.contentBox.y = 500;
  const result = analyzeComposition(image, terms); const relation = result.relations[0], group = result.attachments[0];
  assert.ok(relation); assert.ok(group);
  assert.equal(relation.labelToActorFontRatio, 0.5); assert.equal(group.farthestMemberGapEm, 16);
  assert.equal(result.automaticAestheticDecision, false);
});

test('duplicate or hidden references cannot silently pick a convenient element', () => {
  const { terms, image } = specimen(); const label = image.texts[1]; assert.ok(label);
  label.visible = false; assert.equal(analyzeComposition(image, terms).status, 'unmeasured');
  label.visible = true; image.texts.push({ ...label });
  assert.equal(analyzeComposition(image, terms).status, 'unmeasured');
});

test('straight, curved and coincident routes have finite explainable lengths', () => {
  const line = readNativeRoute({ name: 'line', x: 10, y: 20, vertices: [[0, 0, 'NONE'], [30, 40, 'NONE']], segments: [[0, 1]] });
  assert.equal(routeLength(line), 50); assert.deepEqual(line.segments[0]?.start, { x: 10, y: 20 });
  const curve = readNativeRoute({ name: 'curve', x: 0, y: 0, vertices: [[0, 0, 'NONE'], [100, 0, 'NONE']], segments: [[0, 1]], tangents: [[{ x: 0, y: 100 }, { x: 0, y: 100 }]] });
  assert.ok(Math.abs(routeLength(curve) - 200) < 0.05);
  const zero = readNativeRoute({ name: 'zero', x: 0, y: 0, vertices: [[0, 0, 'NONE']], segments: [[0, 0]] });
  assert.equal(routeLength(zero), 0);
});

test('malformed curve geometry fails the input boundary', () => {
  assert.throws(() => readNativeRoute(null));
  assert.throws(() => readNativeRoute({ name: 'bad', x: 0, y: 0, vertices: [[0, 0, 'NONE']], segments: [[0, 1]] }), /absent vertex/);
  assert.throws(() => readNativeRoute({ name: 'bad', x: 0, y: 0, vertices: [[0, 0, 'NONE']], segments: [[0, 0]], tangents: [] }), /tangent count/);
  assert.equal(routeSchema.safeParse({ name: 'partial', segments: [{ start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, controlStart: { x: 0, y: 1 }, controlEnd: null }] }).success, false);
});

test('empty bounds, contact and diagonal separation do not produce infinity', () => {
  assert.equal(unionBounds([]), null);
  assert.equal(boxDistance({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 10, w: 10, h: 10 }), 0);
  assert.equal(boxDistance({ x: 0, y: 0, w: 10, h: 10 }, { x: 13, y: 14, w: 1, h: 1 }), 5);
});
