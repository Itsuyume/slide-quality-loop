import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/domain/policy.js';
import { feedbackSchema, reviewSchema } from '../src/domain/review.js';
import { summarizeCalibration } from '../src/application/calibration.js';
import { evaluation } from './fixtures.js';

function assessedInput() {
  const input = evaluation();
  const criteria = [{ id: 'attachment', question: 'Does the supporting pathway visually belong to its subject?' }];
  input.contract.reviewCriteria = criteria;
  input.packets.forEach(packet => { packet.criteria = criteria; });
  input.reviews.forEach(review => { review.assessments = (['A', 'B'] as const).map(side => ({ side, criterionId: 'attachment', verdict: 'satisfied',
    region: [0, 0, 1, 1], rationale: 'The nearby supporting pathway has an unambiguous subject.' })); });
  return input;
}

test('missing, duplicate and uncertain criterion responses cannot be hidden by overall preference', () => {
  const input = assessedInput(); const first = input.reviews[0]; assert.ok(first);
  first.assessments = []; assert.equal(decide(input).action, 'hold');
  const complete = assessedInput(); const response = complete.reviews[0]?.assessments?.[0]; assert.ok(response);
  complete.reviews[0]?.assessments?.push({ ...response }); assert.equal(decide(complete).action, 'hold');
  const uncertain = assessedInput(); const assessment = uncertain.reviews[0]?.assessments?.[0]; assert.ok(assessment);
  assessment.verdict = 'uncertain'; assert.equal(decide(uncertain).action, 'hold');
});

test('a preferred candidate still needs repair when an explicit criterion has a problem', () => {
  const input = assessedInput();
  for (const review of input.reviews) {
    const assessment = review.assessments?.find(a => a.side === review.overall); assert.ok(assessment);
    assessment.verdict = 'problem'; assessment.rationale = 'The supporting pathway is detached and its subject is ambiguous.';
  }
  const result = decide(input);
  assert.equal(result.action, 'repair'); assert.ok(result.reasons.some(r => r.includes('attachment')));
});

test('criterion disagreement stays held regardless of reviewer order', () => {
  const input = assessedInput(); const assessment = input.reviews[0]?.assessments?.find(a => a.side === 'B'); assert.ok(assessment);
  assessment.verdict = 'problem';
  assert.equal(decide(input).action, 'hold');
  input.reviews.reverse(); assert.equal(decide(input).action, 'hold');
});

test('a repair diagnosis cannot mask an incomplete second criterion assessment', () => {
  const input = assessedInput(); const first = input.reviews[0], second = input.reviews[1]; assert.ok(first); assert.ok(second);
  const assessment = first.assessments?.find(a => a.side === 'B'); assert.ok(assessment);
  assessment.verdict = 'problem'; second.assessments = [];
  assert.equal(decide(input).action, 'hold');
  input.reviews.reverse(); assert.equal(decide(input).action, 'hold');
});

test('a baseline criterion problem does not erase a valid candidate improvement', () => {
  const input = assessedInput();
  for (const review of input.reviews) {
    const baseline = review.assessments?.find(a => a.side !== review.overall); assert.ok(baseline); baseline.verdict = 'problem';
  }
  assert.equal(decide(input).action, 'propose-for-human-review');
});

test('unknown criteria and ungrounded criterion claims fail validation or hold', () => {
  const input = assessedInput(); const assessment = input.reviews[0]?.assessments?.[0]; assert.ok(assessment);
  assessment.criterionId = 'invented'; assert.equal(decide(input).action, 'hold');
  assessment.region = [0.9, 0.9, 1, 1]; assert.equal(reviewSchema.safeParse(input.reviews[0]).success, false);
});

test('relative human progress remains distinct from final acceptance and calibration', () => {
  const input = assessedInput();
  const feedback = feedbackSchema.parse({ imageSha256: input.candidate.imageSha256, role: 'relationship', label: 'pending', progress: 'improved', origin: 'human', evidence: 'It has improved but still needs work.' });
  const result = summarizeCalibration([feedback], input.reviews, input.packets);
  assert.equal(result.humanReportedImprovements, 1); assert.equal(result.evaluatedHumanPositives, 0);
  assert.equal(result.falseRejectionRate, null); assert.equal(result.personalPreferenceCalibrated, false);
  input.reviews = []; assert.equal(decide(input).action, 'hold');
  assert.throws(() => summarizeCalibration([feedback, feedback], [], input.packets), /one current label/);
});
