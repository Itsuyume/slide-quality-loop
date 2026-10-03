import type { Feedback, Packet, Review } from '../domain/review.js';
import { boundIndependentReviews } from '../domain/review-evidence.js';

export function summarizeCalibration(feedback: Feedback[], reviews: Review[], packets: Packet[]) {
  const known = feedback.filter(f => f.label !== 'pending');
  const independent = boundIndependentReviews(reviews, packets);
  if (new Set(known.map(f => f.imageSha256)).size !== known.length) throw new Error('Feedback must contain one current label per image.');
  const observations = known.map(label => {
    const votes = independent.flatMap(review => (['A', 'B'] as const).filter(side => review.images[side] === label.imageSha256).map(side => review.adequacy[side]));
    return { ...label, votes, judged: votes.length > 0 && votes.every(v => v !== 'uncertain') };
  });
  const negative = observations.filter(o => o.label === 'rejected' && o.judged);
  const positive = observations.filter(o => o.label === 'accepted' && o.judged);
  const falseAccept = negative.filter(o => o.votes.some(v => v === 'adequate')).length;
  const falseReject = positive.filter(o => o.votes.some(v => v === 'inadequate')).length;
  return {
    excludedReviewRecords: reviews.length - independent.length,
    evaluatedHumanNegatives: negative.length, evaluatedHumanPositives: positive.length,
    falseAcceptances: falseAccept, falseRejections: falseReject,
    falseAcceptanceRate: negative.length ? falseAccept / negative.length : null,
    falseRejectionRate: positive.length ? falseReject / positive.length : null,
    coverage: known.length ? observations.filter(o => o.judged).length / known.length : null,
    personalPreferenceCalibrated: false,
    status: positive.length === 0 ? 'missing-human-positive-examples' : 'descriptive-only-heldout-validation-required'
  };
}
