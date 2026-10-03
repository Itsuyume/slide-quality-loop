import type { Contract, Snapshot } from '../src/domain/schema.js';
import type { Packet, Review } from '../src/domain/review.js';
import type { EvaluationInput } from '../src/domain/policy.js';
import { checkSnapshot } from '../src/domain/checks.js';

export function contract(): Contract {
  return { id: 'example', role: 'relationship', brief: 'Explain parent and child roles.', width: 1920, height: 1080,
    contentUnits: [{ id: 'people', anyOf: ['Person One Person Two'] }], exactBindings: [{ node: 'parent-role', expected: 'Parent' }],
    minimumBodyPx: 28, minimumCaptionPx: 20, captionNodes: ['citation'], minimumContrast: 4.5, forbidGreen: true,
    readingChecks: [{ id: 'parent', question: 'Who is the parent?', accepted: ['Person One'] }] };
}

export function snapshot(letter = 'a'): Snapshot {
  return { id: 'example', role: 'relationship', imageSha256: letter.repeat(64), measurementSha256: 'c'.repeat(64), width: 1920, height: 1080,
    ready: true, loadedFonts: true, background: '#ffffff', texts: [
      { name: 'people', text: 'Person One Person Two', x: 100, y: 100, w: 500, h: 80, size: 40, color: '#222222', visible: true },
      { name: 'parent-role', text: 'Parent', x: 100, y: 220, w: 200, h: 50, size: 32, color: '#222222', visible: true }
    ], paints: [], outside: [], collisions: [], glyphsOutside: 0, visibilityCoverage: 'dom-v1', rasterAudit: { greenPixels: 0, opaquePixels: 1920 * 1080, totalPixels: 1920 * 1080 } };
}

export function packet(reverse = false): Packet {
  return { packetId: (reverse ? '2' : '1').repeat(64), pairId: '3'.repeat(64), contractSha256: '4'.repeat(64), protocolVersion: '1',
    role: 'relationship', brief: 'Explain the relation.', images: { A: (reverse ? 'b' : 'a').repeat(64), B: (reverse ? 'a' : 'b').repeat(64) },
    questions: [{ id: 'parent', question: 'Who is the parent?' }] };
}

export function review(reverse = false): Review {
  const task = packet(reverse), winner = reverse ? 'A' : 'B';
  return { packetId: task.packetId, images: task.images,
    reviewer: { id: reverse ? 'fresh-two' : 'fresh-one', origin: 'independent-agent', independent: true, authorshipHidden: true },
    overall: winner, adequacy: { A: 'adequate', B: 'adequate' },
    axes: { hierarchy: winner, space: winner, grouping: winner, typography: winner, roleFit: winner },
    observations: (['A', 'B'] as const).map(side => ({ side, region: [0.1, 0.1, 0.6, 0.6], observation: 'Names form an explicit visual group.', consequence: 'The viewer can associate the label with the correct person.' })),
    reading: (['A', 'B'] as const).map(side => ({ side, questionId: 'parent', answer: 'Person One', region: [0.1, 0.1, 0.5, 0.2] })) };
}

export function evaluation(): EvaluationInput {
  const target = snapshot('b'), terms = contract();
  return { candidate: target, baseline: snapshot(), candidateGate: checkSnapshot(target, terms), contract: terms,
    packets: [packet(), packet(true)], reviews: [review(), review(true)], attempt: 1, maxAttempts: 3 };
}
