import { backgroundAt, contrast, isGreen } from './colors.js';
import { normalize } from './schema.js';
import type { Contract, GateResult, Issue, Snapshot } from './schema.js';

function contentIssues(snapshot: Snapshot, contract: Contract): Issue[] {
  const fullText = normalize(snapshot.texts.map(t => t.text).join(' '));
  const issues: Issue[] = [];
  for (const unit of contract.contentUnits) {
    if (!unit.anyOf.some(value => fullText.includes(normalize(value)))) {
      issues.push({ code: 'missing-content', target: unit.id, detail: 'Required content unit is absent.' });
    }
  }
  for (const binding of contract.exactBindings) {
    const node = snapshot.texts.find(t => t.name === binding.node);
    if (!node || normalize(node.text) !== normalize(binding.expected)) {
      issues.push({ code: 'wrong-binding', target: binding.node, detail: 'Role-bound text changed or is absent.' });
    }
  }
  return issues;
}

function typographyIssues(snapshot: Snapshot, contract: Contract): Issue[] {
  const issues: Issue[] = [];
  for (const text of snapshot.texts) {
    const floor = contract.captionNodes.includes(text.name) ? contract.minimumCaptionPx : contract.minimumBodyPx;
    if (text.size < floor) issues.push({ code: 'small-type', target: text.name, detail: `${text.size}px < ${floor}px at the declared canvas size.` });
    if (text.visible === false) issues.push({ code: 'hidden-content', target: text.name, detail: 'Required text is not visibly rendered.' });
    const ratio = contrast(text.color, backgroundAt(snapshot, text));
    if (ratio < contract.minimumContrast) issues.push({ code: 'low-contrast', target: text.name, detail: `Computed solid-background contrast ${ratio.toFixed(2)}.` });
  }
  return issues;
}

function geometryIssues(snapshot: Snapshot): Issue[] {
  const issues = snapshot.outside.map(target => ({ code: 'outside-canvas', target, detail: 'Text extends outside the canvas.' }));
  issues.push(...snapshot.collisions.map(c => ({ code: 'text-overlap', target: `${c.a}/${c.b}`, detail: 'Text allocation boxes overlap.' })));
  if (snapshot.glyphsOutside > 0) issues.push({ code: 'glyph-outside', target: 'slide', detail: `${snapshot.glyphsOutside} glyphs outside the canvas.` });
  const names = snapshot.texts.map(t => t.name);
  if (new Set(names).size !== names.length) issues.push({ code: 'duplicate-id', target: 'slide', detail: 'Text IDs must be unique.' });
  return issues;
}

function paletteIssues(snapshot: Snapshot, contract: Contract): Issue[] {
  if (!contract.forbidGreen) return [];
  const paints = [...snapshot.texts.map(t => ({ color: t.color, name: t.name })), ...snapshot.paints.map((p, i) => ({ color: p.color, name: `paint-${i}` })), { color: snapshot.background, name: 'background' }];
  const issues = paints.filter(p => isGreen(p.color)).map(p => ({ code: 'prohibited-green', target: p.name, detail: p.color }));
  if (snapshot.rasterAudit && snapshot.rasterAudit.greenPixels > 0) issues.push({ code: 'prohibited-green', target: 'rendered-image', detail: `${snapshot.rasterAudit.greenPixels} visible green pixels in the actual PNG.` });
  return issues;
}

export function checkSnapshot(snapshot: Snapshot, contract: Contract): GateResult {
  const issues = [...contentIssues(snapshot, contract), ...typographyIssues(snapshot, contract), ...geometryIssues(snapshot), ...paletteIssues(snapshot, contract)];
  if (!snapshot.ready || !snapshot.loadedFonts) issues.push({ code: 'render-incomplete', target: 'slide', detail: 'Render or fonts are not ready.' });
  if (snapshot.width !== contract.width || snapshot.height !== contract.height) issues.push({ code: 'wrong-canvas', target: 'slide', detail: 'Canvas differs from the contract.' });
  if (snapshot.role !== contract.role) issues.push({ code: 'wrong-role', target: 'slide', detail: 'The contract belongs to another slide role.' });
  const unverified = snapshot.visibilityCoverage === 'legacy' ? ['Ancestor visibility was not measured by this older renderer.'] : [];
  if (contract.forbidGreen && (!snapshot.rasterAudit || snapshot.rasterAudit.opaquePixels !== snapshot.rasterAudit.totalPixels)) unverified.push('The rendered color audit is missing or contains uncomposited transparent pixels.');
  if (issues.length) return { status: 'fail', issues, unverified };
  return { status: unverified.length ? 'unknown' : 'pass', issues, unverified };
}
