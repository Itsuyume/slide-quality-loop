import { z } from 'zod';
import { pointSchema, routeSchema } from '../domain/schema.js';
import type { Route } from '../domain/schema.js';

const vectorSchema = z.object({ name: z.string(), x: z.number().finite(), y: z.number().finite(),
  vertices: z.array(z.tuple([z.number().finite(), z.number().finite(), z.string()])),
  segments: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
  tangents: z.array(z.tuple([pointSchema, pointSchema])).optional() });

export function readNativeRoute(input: unknown): Route {
  const node = vectorSchema.parse(input);
  if (node.tangents && node.tangents.length !== node.segments.length) throw new Error('Curve tangent count differs from segment count.');
  const segments = node.segments.map(([from, to], index) => {
    const a = node.vertices[from], b = node.vertices[to];
    if (!a || !b) throw new Error('Vector segment references an absent vertex.');
    const start = { x: a[0] + node.x, y: a[1] + node.y }, end = { x: b[0] + node.x, y: b[1] + node.y };
    const controls = node.tangents?.[index];
    return { start, end, controlStart: controls ? { x: start.x + controls[0].x, y: start.y + controls[0].y } : null,
      controlEnd: controls ? { x: end.x + controls[1].x, y: end.y + controls[1].y } : null };
  });
  return routeSchema.parse({ name: node.name, segments });
}
