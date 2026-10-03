import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/domain/policy.js';
import { reviewSchema } from '../src/domain/review.js';
import { summarizeCalibration } from '../src/application/calibration.js';
import { evaluation, review } from './fixtures.js';

test('consistent independent winner can be proposed but never self-approved', () => {
  const result = decide(evaluation());
  assert.equal(result.action, 'propose-for-human-review'); assert.equal(result.userAccepted, false); assert.equal(result.automaticTransferAllowed, false);
});
test('high visual preference cannot compensate for a hard failure', () => {
  const input = evaluation(); input.candidateGate = { status: 'fail', issues: [{ code: 'missing-content', target: 'claim', detail: 'Gone' }], unverified: [] };
  assert.equal(decide(input).action, 'reject');
});
test('absent and duplicated reviews are held', () => {
  const input = evaluation(); input.reviews = []; assert.equal(decide(input).action, 'hold');
  input.reviews = [review(), review()]; assert.equal(decide(input).action, 'hold');
});
test('preferring position A in both passes is detected as disagreement', () => {
  const input = evaluation(); input.reviews.forEach(r => { r.overall = 'A'; });
  assert.equal(decide(input).action, 'hold');
});
test('a tie is not an improvement', () => {
  const input = evaluation(); input.reviews.forEach(r => { r.overall = 'tie'; });
  assert.equal(decide(input).action, 'retain-baseline');
});
test('both bad and inadequate candidates return to repair', () => {
  const input = evaluation(); const first = input.reviews[0]; assert.ok(first); first.overall = 'both-bad';
  assert.equal(decide(input).action, 'repair');
});
test('abstention and unmeasured input remain held', () => {
  const input = evaluation(); const first = input.reviews[0]; assert.ok(first); first.overall = 'uncertain';
  assert.equal(decide(input).action, 'hold');
  input.candidateGate = { status: 'unknown', issues: [], unverified: ['Missing visibility evidence'] };
  assert.equal(decide(input).action, 'hold');
});
test('author self-review is not independent evidence', () => {
  const input = evaluation(); const first = input.reviews[0]; assert.ok(first); first.reviewer.origin = 'host';
  assert.equal(decide(input).action, 'hold');
});
test('stale image hash invalidates review; same reviewer cannot fill both passes', () => {
  const input = evaluation(); const first = input.reviews[0], second = input.reviews[1]; assert.ok(first); assert.ok(second);
  first.images = { ...first.images, A: 'f'.repeat(64) }; assert.equal(decide(input).action, 'hold');
  input.reviews = [review(), review(true)]; input.reviews[1] = { ...second, reviewer: { ...second.reviewer, id: 'fresh-one' } };
  assert.equal(decide(input).action, 'hold');
});
test('wrong or duplicated reading answers prevent promotion', () => {
  const input = evaluation(); const first = input.reviews[0]; assert.ok(first);
  const answer = first.reading.find(r => r.side === 'B'); assert.ok(answer); answer.answer = 'Person Two';
  assert.equal(decide(input).action, 'repair');
  answer.answer = 'Person One'; first.reading.push({ ...answer }); assert.equal(decide(input).action, 'repair');
});
test('identical renders and iteration limits prevent unbounded regeneration', () => {
  const input = evaluation(); input.candidate.imageSha256 = input.baseline.imageSha256;
  assert.equal(decide(input).action, 'retain-baseline');
  input.attempt = 4; assert.equal(decide(input).action, 'stop-budget');
  input.attempt = 0; assert.throws(() => decide(input), /budget/);
});
test('invalid or absent visual regions fail structured response validation', () => {
  const value = review(); value.observations = []; assert.equal(reviewSchema.safeParse(value).success, false);
  const other = review(); const observation = other.observations[0]; assert.ok(observation); observation.region = [0.9, 0, 0.9, 0.5];
  assert.equal(reviewSchema.safeParse(other).success, false);
});
test('negative-only feedback cannot establish preference calibration', () => {
  const result = summarizeCalibration([{ imageSha256: 'a'.repeat(64), role: 'relationship', label: 'rejected', origin: 'human', evidence: 'User rejected this image.' }], [review(), review(true)]);
  assert.equal(result.falseAcceptances, 1); assert.equal(result.falseRejectionRate, null); assert.equal(result.personalPreferenceCalibrated, false);
});
test('always rejecting is exposed by positive-example false rejection', () => {
  const r = review(); r.adequacy.B = 'inadequate';
  const result = summarizeCalibration([{ imageSha256: 'b'.repeat(64), role: 'relationship', label: 'accepted', origin: 'human', evidence: 'Synthetic accepted unit-test specimen.' }], [r]);
  assert.equal(result.falseRejections, 1); assert.equal(result.falseRejectionRate, 1);
});
test('host judgments are excluded from independent calibration statistics', () => {
  const r = review(); r.reviewer.origin = 'host'; r.reviewer.independent = false;
  const result = summarizeCalibration([{ imageSha256: 'a'.repeat(64), role: 'relationship', label: 'rejected', origin: 'human', evidence: 'Explicit user rejection.' }], [r]);
  assert.equal(result.evaluatedHumanNegatives, 0); assert.equal(result.falseAcceptanceRate, null);
});
