import { isGreen } from './colors.js';
import type { RasterAudit } from './schema.js';

export function auditRaster(data: Uint8Array, width: number, height: number): RasterAudit {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw new Error('Invalid RGBA raster dimensions.');
  const cache = new Map<number, boolean>();
  let greenPixels = 0, opaquePixels = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] !== 255) continue;
    opaquePixels++;
    const color = data.slice(offset, offset + 3).reduce((value, channel) => (value << 8) | channel, 0);
    if (!cache.has(color)) cache.set(color, isGreen('#' + color.toString(16).padStart(6, '0')));
    if (cache.get(color)) greenPixels++;
  }
  return { greenPixels, opaquePixels, totalPixels: width * height };
}
