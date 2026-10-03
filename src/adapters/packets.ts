import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { REVIEW_PROTOCOL } from '../application/protocol.js';
import { checkSnapshot } from '../domain/checks.js';
import { contractSchema, snapshotSchema } from '../domain/schema.js';
import type { Contract, Snapshot } from '../domain/schema.js';
import { packetSchema, reviewSchema } from '../domain/review.js';
import type { Packet } from '../domain/review.js';
import { digest, readChecked, writeNewJson } from './files.js';
import { loadSnapshot } from './snapshot.js';

export const sessionSchema = z.object({
  contract: contractSchema, baseline: snapshotSchema, candidate: snapshotSchema,
  packets: z.array(packetSchema).length(2),
  contractSha256: z.string(), protocolSha256: z.string(),
  createdAt: z.string(), sourceImages: z.object({ baseline: z.string(), candidate: z.string() }),
  sources: z.object({ baseline: z.string(), candidate: z.string(), slide: z.number().int().positive() })
}).strict();
export type Session = z.infer<typeof sessionSchema>;

function makePacket(contract: Contract, contractHash: string, a: Snapshot, b: Snapshot): Packet {
  const protocolHash = digest(REVIEW_PROTOCOL);
  const pairId = digest([contractHash, protocolHash, ...[a.imageSha256, b.imageSha256].sort()].join(':'));
  return { packetId: digest(`${pairId}:${a.imageSha256}:${b.imageSha256}`), pairId, contractSha256: contractHash,
    protocolVersion: '1', role: contract.role, brief: contract.brief,
    images: { A: a.imageSha256, B: b.imageSha256 }, questions: contract.readingChecks.map(q => ({ id: q.id, question: q.question })) };
}

async function writePacket(directory: string, packet: Packet, a: string, b: string): Promise<void> {
  await mkdir(directory);
  await Promise.all([
    copyFile(a, path.join(directory, 'A.png')), copyFile(b, path.join(directory, 'B.png')),
    writeNewJson(path.join(directory, 'task.json'), packet),
    writeNewJson(path.join(directory, 'review.schema.json'), zodToJsonSchema(reviewSchema, 'Review')),
    writeFile(path.join(directory, 'instructions.txt'), REVIEW_PROTOCOL, { flag: 'wx' })
  ]);
}

export async function prepareSession(baselineDir: string, candidateDir: string, contractFile: string, slide: number, output: string): Promise<Session> {
  const contract = await readChecked(contractFile, contractSchema);
  const [baseline, candidate] = await Promise.all([loadSnapshot(baselineDir, slide, contract.role), loadSnapshot(candidateDir, slide, contract.role)]);
  if (baseline.imageSha256 === candidate.imageSha256) throw new Error('Identical images do not require pairwise review.');
  const contractSha256 = digest(JSON.stringify(contract));
  const packets = [makePacket(contract, contractSha256, baseline, candidate), makePacket(contract, contractSha256, candidate, baseline)];
  const sourceImages = { baseline: path.resolve(baselineDir, `${slide}.png`), candidate: path.resolve(candidateDir, `${slide}.png`) };
  const session: Session = { contract, baseline, candidate, packets, contractSha256, protocolSha256: digest(REVIEW_PROTOCOL), createdAt: new Date().toISOString(), sourceImages,
    sources: { baseline: path.resolve(baselineDir), candidate: path.resolve(candidateDir), slide } };
  await mkdir(output);
  await writeNewJson(path.join(output, 'session.private.json'), session);
  await writeNewJson(path.join(output, 'gates.json'), { baseline: checkSnapshot(baseline, contract), candidate: checkSnapshot(candidate, contract) });
  const [first, second] = packets;
  if (!first || !second) throw new Error('Packet assembly failed.');
  await writePacket(path.join(output, 'pass-1'), first, sourceImages.baseline, sourceImages.candidate);
  await writePacket(path.join(output, 'pass-2'), second, sourceImages.candidate, sourceImages.baseline);
  return session;
}

export async function verifySession(session: Session, directory: string): Promise<void> {
  if (digest(JSON.stringify(session.contract)) !== session.contractSha256 || digest(REVIEW_PROTOCOL) !== session.protocolSha256) throw new Error('Contract or protocol changed after packet creation.');
  const [baseline, candidate] = await Promise.all([loadSnapshot(session.sources.baseline, session.sources.slide, session.contract.role), loadSnapshot(session.sources.candidate, session.sources.slide, session.contract.role)]);
  if (JSON.stringify(baseline) !== JSON.stringify(session.baseline) || JSON.stringify(candidate) !== JSON.stringify(session.candidate)) throw new Error('Source snapshot changed after packet preparation.');
  for (const [index, packet] of session.packets.entries()) {
    if (packet.contractSha256 !== session.contractSha256) throw new Error('Packet contract mismatch.');
    const onDisk = await readChecked(path.join(directory, `pass-${index + 1}`, 'task.json'), packetSchema);
    if (JSON.stringify(onDisk) !== JSON.stringify(packet)) throw new Error('Packet changed after session creation.');
    for (const side of ['A', 'B'] as const) {
      const image = await readFile(path.join(directory, `pass-${index + 1}`, `${side}.png`));
      if (digest(image) !== packet.images[side]) throw new Error('Review image changed after packet creation.');
    }
  }
}
