import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PNG } from 'pngjs';
import { digest } from './files.js';
import { boxSchema, snapshotSchema } from '../domain/schema.js';
import type { Snapshot } from '../domain/schema.js';
import { auditRaster } from '../domain/raster.js';
import { unionBounds } from '../domain/geometry.js';
import { readNativeRoute } from './native-routes.js';

const measuredText = boxSchema.extend({ name: z.string(), text: z.string(), size: z.number(), color: z.string(), visible: z.boolean().optional(),
  glyphRects: z.array(boxSchema.extend({ character: z.string() })).optional() });
const measuredSlide = z.object({ sourceSlide: z.number(), width: z.number(), height: z.number(), nodes: z.array(measuredText), outside: z.array(z.object({ name: z.string() })), collisions: z.array(z.object({ a: z.string(), b: z.string() })), glyphsOutside: z.array(z.unknown()) });
const measurementSchema = z.object({ revision: z.string(), ready: z.boolean(), fonts: z.array(z.object({ status: z.string() })).min(1), slides: z.array(measuredSlide), visibilityVersion: z.literal('dom-v1').optional(), imageHashes: z.record(z.string()).optional() });
const nativeNode = boxSchema.extend({ type: z.string(), fill: z.string().nullable().optional(), stroke: z.string().nullable().optional() }).passthrough();
const nativeSchema = z.object({ revision: z.string(), slides: z.array(z.object({ sourceSlide: z.number(), width: z.number(), height: z.number(), background: z.string(), nodes: z.array(nativeNode) })) });

function rgbHex(value: string): string {
  if (/^#[a-f\d]{6}$/i.test(value)) return value.toLowerCase();
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  if (!match) throw new Error(`Unsupported opaque color: ${value}`);
  return '#' + match.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

function verifyPng(bytes: Buffer, width: number, height: number): Uint8Array {
  if (bytes.length < 100 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Missing or invalid PNG render.');
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) throw new Error('PNG dimensions do not match measurement.');
  return PNG.sync.read(bytes, { checkCRC: true }).data;
}

function verifyCoverage(measured: z.infer<typeof measurementSchema>): void {
  if (!measured.visibilityVersion) return;
  if (!measured.imageHashes) throw new Error('Audited captures require image hashes.');
  if (measured.slides.some(slide => slide.nodes.some(node => node.visible === undefined))) throw new Error('Audited capture has missing visibility values.');
}

export async function loadSnapshot(directory: string, slideNumber: number, role: string): Promise<Snapshot> {
  const [measuredBytes, nativeBytes, image] = await Promise.all([
    readFile(path.join(directory, 'measurement.json')), readFile(path.join(directory, 'native-model.json')), readFile(path.join(directory, `${slideNumber}.png`))
  ]);
  const measured = measurementSchema.parse(JSON.parse(measuredBytes.toString()) as unknown);
  const native = nativeSchema.parse(JSON.parse(nativeBytes.toString()) as unknown);
  verifyCoverage(measured);
  const slide = measured.slides.find(s => s.sourceSlide === slideNumber), model = native.slides.find(s => s.sourceSlide === slideNumber);
  if (!slide || !model) throw new Error('Requested slide is absent from snapshot.');
  if (native.revision !== measured.revision || model.width !== slide.width || model.height !== slide.height) throw new Error('Mixed native/measurement revisions.');
  const pixels = verifyPng(image, slide.width, slide.height);
  const imageHash = digest(image);
  if (measured.imageHashes && measured.imageHashes[String(slideNumber)] !== imageHash) throw new Error('PNG changed after capture.');
  const paints = model.nodes.flatMap(node => {
    const values: Snapshot['paints'] = [];
    if (node.fill) values.push({ ...node, color: rgbHex(node.fill), kind: 'background' });
    if (node.stroke) values.push({ ...node, color: rgbHex(node.stroke), kind: 'stroke' });
    return values;
  });
  return snapshotSchema.parse({ id: measured.revision, role, imageSha256: imageHash, measurementSha256: digest(measuredBytes), width: slide.width, height: slide.height,
    ready: measured.ready, loadedFonts: measured.fonts.every(f => f.status === 'loaded'), background: rgbHex(model.background),
    texts: slide.nodes.map(n => ({ ...n, color: rgbHex(n.color), visible: n.visible ?? null,
      contentBox: n.glyphRects ? unionBounds(n.glyphRects.filter(g => g.character.trim() && g.w > 0 && g.h > 0)) : null })), paints,
    outside: slide.outside.map(n => n.name), collisions: slide.collisions, glyphsOutside: slide.glyphsOutside.length,
    visibilityCoverage: measured.visibilityVersion ?? 'legacy', rasterAudit: auditRaster(pixels, slide.width, slide.height),
    routes: model.nodes.filter(node => node.type === 'VECTOR').map(readNativeRoute)
  });
}
