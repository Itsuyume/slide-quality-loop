import { normalize } from './schema.js';
import type { Contract, GateResult, Snapshot } from './schema.js';
import type { Packet, Review } from './review.js';
import { reviewBindingProblems } from './review-evidence.js';

export type Decision = { action: 'reject' | 'hold' | 'retain-baseline' | 'repair' | 'propose-for-human-review' | 'stop-budget'; reasons: string[]; userAccepted: false; automaticTransferAllowed: false };
export type EvaluationInput = { candidate: Snapshot; baseline: Snapshot; candidateGate: GateResult; contract: Contract; packets: Packet[]; reviews: Review[]; attempt: number; maxAttempts: number };

function decision(action: Decision['action'], ...reasons: string[]): Decision {
  return { action, reasons, userAccepted: false, automaticTransferAllowed: false };
}

function matchingReviews(input: EvaluationInput): string[] {
  if (input.packets.length !== 2 || input.reviews.length !== 2) return ['Two swapped-order review records are required.'];
  const seen = new Set<string>();
  const problems: string[] = [];
  for (const review of input.reviews) {
    const packet = input.packets.find(p => p.packetId === review.packetId);
    if (!packet || seen.has(review.packetId)) { problems.push('Missing or duplicated packet review.'); continue; }
    seen.add(review.packetId);
    problems.push(...reviewBindingProblems(review, input.packets));
  }
  problems.push(...packetProblems(input.packets));
  if (new Set(input.reviews.map(r => r.reviewer.id)).size !== 2) problems.push('Fresh reviewer identities are required for the two passes.');
  return problems;
}

function packetProblems(packets: Packet[]): string[] {
  const [first, second] = packets;
  if (!first || !second) return ['Two packets are required.'];
  if (first.pairId !== second.pairId || first.images.A !== second.images.B || first.images.B !== second.images.A) return ['Packets do not exchange A/B positions for the same pair.'];
  return [];
}

function readingProblems(review: Review, side: 'A' | 'B', contract: Contract): string[] {
  return contract.readingChecks.flatMap(check => {
    const answers = review.reading.filter(r => r.side === side && r.questionId === check.id);
    const answer = answers[0];
    if (answers.length !== 1 || !answer) return [`Missing or duplicate reading answer: ${check.id}.`];
    return check.accepted.some(expected => normalize(expected) === normalize(answer.answer)) ? [] : [`Reading mismatch: ${check.id}.`];
  });
}

function comparisonProblems(review: Review, other: 'A' | 'B', contract: Contract): string[] {
  if (contract.readingChecks.some(check => review.reading.filter(r => r.side === other && r.questionId === check.id).length !== 1)) return ['Baseline reading evidence is missing or duplicated.'];
  const axes = Object.values(review.axes);
  if (axes.includes('uncertain')) return ['A comparison axis is unassessed.'];
  if ((review.overall === 'A' || review.overall === 'B') && !axes.includes(review.overall)) return ['Overall preference has no supporting comparison axis.'];
  return [];
}

function candidateFailure(review: Review, side: 'A' | 'B', contract: Contract): Decision | null {
    if (review.overall === 'uncertain' || review.adequacy[side] === 'uncertain') return decision('hold', 'A judge abstained.');
    if (review.overall === 'both-bad' || review.adequacy[side] === 'inadequate') return decision('repair', 'Candidate has not met the role-specific adequacy floor.');
    const reading = readingProblems(review, side, contract);
    if (reading.length) return decision('repair', ...reading);
    const comparison = comparisonProblems(review, side === 'A' ? 'B' : 'A', contract);
    if (comparison.length) return decision('hold', ...comparison);
    if (!review.observations.some(o => o.side === side) || !review.observations.some(o => o.side !== side)) return decision('hold', 'Both images need grounded observations.');
    return null;
}

function judgeDecision(input: EvaluationInput): Decision {
  const wins: boolean[] = [];
  for (const review of input.reviews) {
    const side = review.images.A === input.candidate.imageSha256 ? 'A' : 'B';
    if (![review.images.A, review.images.B].includes(input.candidate.imageSha256)) return decision('hold', 'Candidate is absent from the review.');
    const failure = candidateFailure(review, side, input.contract);
    if (failure) return failure;
    wins.push(review.overall === side);
  }
  if (wins.every(Boolean)) return decision('propose-for-human-review', 'Candidate won both positions and passed the reading checks. Personal aesthetic calibration is not established by this result.');
  if (wins.some(Boolean)) return decision('hold', 'Position-swapped judgments disagree.');
  return decision('retain-baseline', 'No consistent improvement over the baseline was demonstrated.');
}

export function decide(input: EvaluationInput): Decision {
  if (!Number.isInteger(input.attempt) || input.attempt < 1 || !Number.isInteger(input.maxAttempts) || input.maxAttempts < 1) throw new Error('Invalid iteration budget.');
  if (input.candidateGate.status === 'fail') return decision('reject', ...input.candidateGate.issues.map(i => `${i.code}: ${i.target}`));
  if (input.attempt > input.maxAttempts) return decision('stop-budget', 'Iteration budget exhausted; do not generate another variant.');
  if (input.candidateGate.status === 'unknown') return decision('hold', ...input.candidateGate.unverified);
  if (input.candidate.imageSha256 === input.baseline.imageSha256) return decision('retain-baseline', 'Identical rendered images are not a design iteration.');
  const problems = matchingReviews(input);
  if (problems.length) return decision('hold', ...problems);
  return judgeDecision(input);
}
