import type { Contract } from './schema.js';
import type { Review } from './review.js';

function assessCriteria(review: Review, candidate: 'A' | 'B', contract: Contract) {
  const unverified: string[] = [], repairs: string[] = [];
  const criteria = contract.reviewCriteria;
  if (!criteria) return { unverified, repairs };
  const assessments = review.assessments ?? [];
  if (assessments.some(a => !criteria.some(c => c.id === a.criterionId))) unverified.push('Unknown review criterion.');
  for (const criterion of criteria) for (const side of ['A', 'B'] as const) {
    const matches = assessments.filter(a => a.side === side && a.criterionId === criterion.id);
    const assessment = matches[0];
    if (matches.length !== 1 || !assessment) { unverified.push(`Missing or duplicate criterion assessment: ${side}/${criterion.id}.`); continue; }
    if (assessment.verdict === 'uncertain') unverified.push(`Unassessed criterion: ${side}/${criterion.id}.`);
    if (side === candidate && assessment.verdict === 'problem') repairs.push(`Unresolved criterion: ${criterion.id}. ${assessment.rationale}`);
  }
  return { unverified, repairs };
}

export function assessCriteriaPair(reviews: Review[], candidateHash: string, contract: Contract) {
  const assessments = reviews.map(review => assessCriteria(review, review.images.A === candidateHash ? 'A' : 'B', contract));
  const unverified = assessments.flatMap(result => result.unverified);
  const verdicts = new Map<string, string>();
  if (!contract.reviewCriteria) return { unverified, repairs: [] };
  for (const review of reviews) for (const assessment of review.assessments ?? []) {
    const key = `${review.images[assessment.side]}:${assessment.criterionId}`;
    const previous = verdicts.get(key);
    if (previous !== undefined && previous !== assessment.verdict) unverified.push(`Position-swapped criterion judgments disagree: ${assessment.criterionId}.`);
    verdicts.set(key, assessment.verdict);
  }
  return { unverified, repairs: assessments.flatMap(result => result.repairs) };
}
