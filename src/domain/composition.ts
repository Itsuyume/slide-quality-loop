import { boxDistance, routeLength } from './geometry.js';
import type { Box, Contract, Snapshot } from './schema.js';

type Text = Snapshot['texts'][number];
type MeasuredText = Omit<Text, 'contentBox' | 'visible'> & { contentBox: Box; visible: true };
type Spec = NonNullable<Contract['composition']>;

function measuredTexts(snapshot: Snapshot, names: string[]): { texts: MeasuredText[]; missing: string[] } {
  const texts: MeasuredText[] = [], missing: string[] = [];
  for (const name of names) {
    const matches = snapshot.texts.filter(t => t.name === name), match = matches[0];
    if (matches.length !== 1 || !match?.contentBox || match.visible !== true) missing.push(name);
    else texts.push({ ...match, contentBox: match.contentBox, visible: true });
  }
  return { texts, missing };
}

function nearestGap(text: MeasuredText, anchors: MeasuredText[]): number {
  return Math.min(...anchors.map(anchor => boxDistance(text.contentBox, anchor.contentBox))) / text.size;
}

function relationDiagnostics(snapshot: Snapshot, spec: Spec['relations'][number]) {
  const actors = measuredTexts(snapshot, spec.actors), labels = measuredTexts(snapshot, spec.labels);
  const missing = [...actors.missing, ...labels.missing];
  const routes = spec.routes.flatMap(name => {
    const matches = snapshot.routes?.filter(r => r.name === name) ?? [];
    if (matches.length !== 1) { missing.push(`route:${name}`); return []; }
    return matches;
  });
  const textReady = !actors.missing.length && !labels.missing.length;
  return { id: spec.id, status: missing.length ? 'unmeasured' : 'measured', missing,
    labelToActorFontRatio: textReady ? Math.min(...labels.texts.map(t => t.size)) / Math.max(...actors.texts.map(t => t.size)) : null,
    maxLabelToActorGapEm: textReady ? Math.max(...labels.texts.map(t => nearestGap(t, actors.texts))) : null,
    routeLengthCanvasDiagonals: missing.some(name => name.startsWith('route:')) ? null : routes.reduce((sum, r) => sum + routeLength(r), 0) / Math.hypot(snapshot.width, snapshot.height) };
}

function attachmentDiagnostics(snapshot: Snapshot, spec: Spec['attachments'][number]) {
  const members = measuredTexts(snapshot, spec.members), anchors = measuredTexts(snapshot, spec.anchors);
  const missing = [...members.missing, ...anchors.missing];
  const gaps = missing.length ? [] : members.texts.map(member => nearestGap(member, anchors.texts));
  return { id: spec.id, status: missing.length ? 'unmeasured' : 'measured', missing,
    nearestMemberGapEm: gaps.length ? Math.min(...gaps) : null, farthestMemberGapEm: gaps.length ? Math.max(...gaps) : null };
}

export function analyzeComposition(snapshot: Snapshot, contract: Contract) {
  const spec = contract.composition;
  if (!spec) return { status: 'not-configured', relations: [], attachments: [], automaticAestheticDecision: false };
  const relations = spec.relations.map(relation => relationDiagnostics(snapshot, relation));
  const attachments = spec.attachments.map(attachment => attachmentDiagnostics(snapshot, attachment));
  return { status: [...relations, ...attachments].some(r => r.status === 'unmeasured') ? 'unmeasured' : 'measured',
    relations, attachments, automaticAestheticDecision: false };
}
