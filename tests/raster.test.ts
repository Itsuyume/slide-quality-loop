import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRaster } from '../src/domain/raster.js';
import { checkSnapshot } from '../src/domain/checks.js';
import { contract, snapshot } from './fixtures.js';

test('visible raster green is rejected without any exported surface', () => {
  const s = snapshot();
  s.rasterAudit = auditRaster(Uint8Array.from([0, 136, 0, 255, 255, 255, 255, 255]), 2, 1);
  assert.equal(s.paints.length, 0);
  assert.equal(s.rasterAudit.greenPixels, 1);
  assert.ok(checkSnapshot(s, contract()).issues.some(issue => issue.target === 'rendered-image'));
});

test('transparent pixels need compositing and cannot silently pass color review', () => {
  const s = snapshot(); s.rasterAudit = auditRaster(Uint8Array.from([0, 136, 0, 0]), 1, 1);
  assert.equal(s.rasterAudit.greenPixels, 0);
  assert.equal(checkSnapshot(s, contract()).status, 'unknown');
});

test('a missing rendered color audit is unknown under a color ban', () => {
  const s = snapshot(); s.rasterAudit = null;
  assert.equal(checkSnapshot(s, contract()).status, 'unknown');
  const terms = contract(); terms.forbidGreen = false;
  assert.equal(checkSnapshot(s, terms).status, 'pass');
});

test('empty, mismatched and fractional rasters fail at the boundary', () => {
  assert.throws(() => auditRaster(new Uint8Array(), 0, 0), /dimensions/);
  assert.throws(() => auditRaster(new Uint8Array(4), 2, 1), /dimensions/);
  assert.throws(() => auditRaster(new Uint8Array(6), 1.5, 1), /dimensions/);
});
