import { z } from 'zod';

export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const identifierSchema = z.string().min(1).max(120);
export const boxSchema = z.object({ x: z.number().finite(), y: z.number().finite(), w: z.number().finite().nonnegative(), h: z.number().finite().nonnegative() });
export type Box = z.infer<typeof boxSchema>;
export const textSchema = boxSchema.extend({
  name: identifierSchema, text: z.string(), size: z.number().positive().finite(),
  color: z.string().regex(/^#[a-f\d]{6}$/i), visible: z.boolean().nullable()
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
  rasterAudit: rasterAuditSchema.nullable().default(null)
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
  readingChecks: z.array(z.object({ id: identifierSchema, question: z.string().min(1), accepted: z.array(z.string().min(1)).min(1) })).min(1)
}).strict();
export type Contract = z.infer<typeof contractSchema>;
export type Issue = { code: string; target: string; detail: string };
export type GateResult = { status: 'pass' | 'fail' | 'unknown'; issues: Issue[]; unverified: string[] };

export function normalize(value: string): string {
  return value.normalize('NFC').replace(/[\s·.,;:()“”‘’]/gu, '').toLowerCase();
}
