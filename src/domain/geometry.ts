import type { Box, Route } from './schema.js';

export function unionBounds(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
}

export function boxDistance(a: Box, b: Box): number {
  return Math.hypot(Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w), Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h));
}

function segmentLength(segment: Route['segments'][number]): number {
  const { start, end, controlStart, controlEnd } = segment;
  if (!controlStart || !controlEnd) return Math.hypot(end.x - start.x, end.y - start.y);
  let previous = start, length = 0;
  // A deterministic 64-step polyline estimate, not an exact analytic arc length.
  for (let step = 1; step <= 64; step++) {
    const t = step / 64, u = 1 - t;
    const point = { x: u ** 3 * start.x + 3 * u ** 2 * t * controlStart.x + 3 * u * t ** 2 * controlEnd.x + t ** 3 * end.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * controlStart.y + 3 * u * t ** 2 * controlEnd.y + t ** 3 * end.y };
    length += Math.hypot(point.x - previous.x, point.y - previous.y); previous = point;
  }
  return length;
}

export function routeLength(route: Route): number {
  return route.segments.reduce((length, segment) => length + segmentLength(segment), 0);
}
