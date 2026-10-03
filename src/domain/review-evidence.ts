import type { Packet, Review } from './review.js';

export function reviewBindingProblems(review: Review, packets: Packet[]): string[] {
  const matches = packets.filter(packet => packet.packetId === review.packetId);
  const packet = matches[0];
  if (matches.length !== 1 || !packet) return ['Missing or ambiguous review packet.'];
  const problems: string[] = [];
  if (review.images.A !== packet.images.A || review.images.B !== packet.images.B) problems.push('Review references stale or different images.');
  if (!review.reviewer.independent || !review.reviewer.authorshipHidden || review.reviewer.origin === 'host') problems.push('Review is not independent and authorship-blind.');
  return problems;
}

export function boundIndependentReviews(reviews: Review[], packets: Packet[]): Review[] {
  return reviews.filter(review => {
    if (reviewBindingProblems(review, packets).length) return false;
    return reviews.filter(r => r.packetId === review.packetId).length === 1
      && reviews.filter(r => r.reviewer.id === review.reviewer.id).length === 1;
  });
}
