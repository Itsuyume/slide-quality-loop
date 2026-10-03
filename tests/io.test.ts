import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import { loadSnapshot } from '../src/adapters/snapshot.js';
import { digest, writeNewJson } from '../src/adapters/files.js';
import { prepareSession, verifySession } from '../src/adapters/packets.js';
import { contract, snapshot } from './fixtures.js';

async function makeCapture(directory: string, shade = 255): Promise<void> {
  await mkdir(directory);
  const source = snapshot();
  const png = new PNG({ width: 1920, height: 1080 }); png.data.fill(shade);
  const image = PNG.sync.write(png);
  const measurement = { revision: 'test', ready: true, fonts: [{ status: 'loaded' }], visibilityVersion: 'dom-v1', imageHashes: { '13': digest(image) },
    slides: [{ sourceSlide: 13, width: 1920, height: 1080, nodes: source.texts, outside: [], collisions: [], glyphsOutside: [] }] };
  const native = { revision: 'test', slides: [{ sourceSlide: 13, width: 1920, height: 1080, background: '#ffffff', nodes: [] }] };
  await Promise.all([writeNewJson(path.join(directory, 'measurement.json'), measurement), writeNewJson(path.join(directory, 'native-model.json'), native), writeFile(path.join(directory, '13.png'), image)]);
}

test('real files decode and image tampering or absence fails the boundary', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'slide-quality-')); t.after(() => rm(root, { recursive: true }));
  const directory = path.join(root, 'capture'); await makeCapture(directory);
  const loaded = await loadSnapshot(directory, 13, 'relationship'); assert.equal(loaded.texts.length, 2);
  const bytes = await readFile(path.join(directory, '13.png')); bytes[80] = (bytes[80] ?? 0) ^ 1;
  await writeFile(path.join(directory, '13.png'), bytes);
  await assert.rejects(loadSnapshot(directory, 13, 'relationship'));
  await rm(path.join(directory, '13.png'));
  await assert.rejects(loadSnapshot(directory, 13, 'relationship'), /ENOENT/);
});
test('output writes cannot silently replace an existing receipt', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'slide-quality-')); t.after(() => rm(root, { recursive: true }));
  const output = path.join(root, 'receipt.json'); await writeNewJson(output, { original: true });
  await assert.rejects(writeNewJson(output, { original: false }), /EEXIST/);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), { original: true });
});
test('two concurrent writes produce one receipt and one explicit failure', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'slide-quality-')); t.after(() => rm(root, { recursive: true }));
  const results = await Promise.allSettled([writeNewJson(path.join(root, 'same.json'), { n: 1 }), writeNewJson(path.join(root, 'same.json'), { n: 2 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});
test('anonymous packets really swap images and detect later source changes', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'slide-quality-')); t.after(() => rm(root, { recursive: true }));
  const baseline = path.join(root, 'base'), candidate = path.join(root, 'candidate'), out = path.join(root, 'packets');
  await makeCapture(baseline); await makeCapture(candidate, 230);
  const terms = path.join(root, 'contract.json'); await writeNewJson(terms, contract());
  const session = await prepareSession(baseline, candidate, terms, 13, out);
  assert.equal(digest(await readFile(path.join(out, 'pass-1/A.png'))), digest(await readFile(path.join(out, 'pass-2/B.png'))));
  await verifySession(session, out);
  await assert.rejects(prepareSession(baseline, candidate, terms, 13, out), /EEXIST/);
  await writeFile(path.join(candidate, 'measurement.json'), '{}');
  await assert.rejects(verifySession(session, out));
});
test('null and incomplete measurement fail rather than becoming an empty pass', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'slide-quality-')); t.after(() => rm(root, { recursive: true }));
  const directory = path.join(root, 'capture'); await makeCapture(directory);
  await writeFile(path.join(directory, 'measurement.json'), 'null');
  await assert.rejects(loadSnapshot(directory, 13, 'relationship'));
});
