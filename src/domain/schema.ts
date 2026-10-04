import { z } from 'zod';

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const identifierSchema = z.string().min(1).max(120);
export const boxSchema = z.object({ x: z.number().finite(), y: z.number().finite(), w: z.number().finite().nonnegative(), h: z.number().finite().nonnegative() });
export type Box = z.infer<typeof boxSchema>;
export const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const segmentSchema = z.object({ start: pointSchema, end: pointSchema, controlStart: pointSchema.nullable(), controlEnd: pointSchema.nullable() }).strict()
  .refine(s => (s.controlStart === null) === (s.controlEnd === null), 'A curve needs both control points.');
export const routeSchema = z.object({ name: identifierSchema, segments: z.array(segmentSchema).min(1) }).strict();
export type Route = z.infer<typeof routeSchema>;
const nodeNames = z.array(identifierSchema).min(1).refine(names => new Set(names).size === names.length, 'Node references must be unique.');
export const criterionSchema = z.object({ id: identifierSchema, question: z.string().min(1) }).strict();
const compositionSchema = z.object({
  relations: z.array(z.object({ id: identifierSchema, actors: nodeNames, labels: nodeNames,
    routes: z.array(identifierSchema).refine(names => new Set(names).size === names.length, 'Route references must be unique.') }).strict()),
  attachments: z.array(z.object({ id: identifierSchema, members: nodeNames, anchors: nodeNames }).strict())
}).strict().refine(spec => spec.relations.length + spec.attachments.length > 0, 'At least one composition diagnostic must be declared.')
  .refine(spec => {
    const ids = [...spec.relations, ...spec.attachments].map(item => item.id);
    return new Set(ids).size === ids.length;
  }, 'Composition IDs must be unique.');
export const textSchema = boxSchema.extend({
  name: identifierSchema, text: z.string(), size: z.number().positive().finite(),
  color: z.string().regex(/^#[a-f\d]{6}$/i), visible: z.boolean().nullable(),
  contentBox: boxSchema.nullable().optional()
});
export const paintSchema = boxSchema.extend({ color: z.string().regex(/^#[a-f\d]{6}$/i), kind: z.enum(['background', 'stroke']) });
export const rasterAuditSchema = z.object({ greenPixels: z.number().int().nonnegative(), opaquePixels: z.number().int().nonnegative(), totalPixels: z.number().int().positive() })
  .refine(value => value.greenPixels <= value.opaquePixels && value.opaquePixels <= value.totalPixels, 'Invalid raster pixel counts.');
export type RasterAudit = z.infer<typeof rasterAuditSchema>;
export const snapshotSchema = z.object({
  id: identifierSchema, role: identifierSchema,
  imageSha256: digestSchema, measurementSha256: digestSchema,
  width: z.number().positive().finite(), height: z.number().positive().finite(),
  ready: z.boolean(), loadedFonts: z.boolean(),
  background: z.string().regex(/^#[a-f\d]{6}$/i),
  texts: z.array(textSchema).min(1), paints: z.array(paintSchema),
  outside: z.array(z.string()), collisions: z.array(z.object({ a: z.string(), b: z.string() })),
  glyphsOutside: z.number().int().nonnegative(),
  visibilityCoverage: z.enum(['dom-v1', 'legacy']),
  rasterAudit: rasterAuditSchema.nullable().default(null), routes: z.array(routeSchema).optional()
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const contractSchema = z.object({
  id: identifierSchema, role: identifierSchema, brief: z.string().min(1),
  width: z.number().positive(), height: z.number().positive(),
  contentUnits: z.array(z.object({ id: identifierSchema, anyOf: z.array(z.string().min(1)).min(1) })).min(1),
  exactBindings: z.array(z.object({ node: identifierSchema, expected: z.string().min(1) })),
  minimumBodyPx: z.number().positive(), minimumCaptionPx: z.number().positive(),
  captionNodes: z.array(identifierSchema), minimumContrast: z.number().min(1).max(21),
  forbidGreen: z.boolean(),
  readingChecks: z.array(z.object({ id: identifierSchema, question: z.string().min(1), accepted: z.array(z.string().min(1)).min(1) })).min(1),
  reviewCriteria: z.array(criterionSchema).min(1).refine(items => new Set(items.map(c => c.id)).size === items.length, 'Criterion IDs must be unique.').optional(),
  composition: compositionSchema.optional()
}).strict();
export type Contract = z.infer<typeof contractSchema>;
export type Issue = { code: string; target: string; detail: string };
export type GateResult = { status: 'pass' | 'fail' | 'unknown'; issues: Issue[]; unverified: string[] };

export function normalize(value: string): string {
  return value.normalize('NFC').replace(/[\s·.,;:()“”‘’]/gu, '').toLowerCase();
}
