import type { Box, Snapshot } from './schema.js';

function channels(hex: string): [number, number, number] {
  return [Number.parseInt(hex.slice(1, 3), 16) / 255, Number.parseInt(hex.slice(3, 5), 16) / 255, Number.parseInt(hex.slice(5, 7), 16) / 255];
}

export function isGreen(hex: string): boolean {
  const [r, g, b] = channels(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta < 0.015 || max < 0.12) return false;
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  const saturation = delta / (1 - Math.abs(max + min - 1));
  return hue >= 70 && hue <= 175 && saturation >= 0.18;
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function contains(box: Box, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function backgroundAt(snapshot: Snapshot, text: Box): string {
  const x = text.x + text.w / 2, y = text.y + text.h / 2;
  return snapshot.paints.findLast(p => p.kind === 'background' && contains(p, x, y))?.color ?? snapshot.background;
}
