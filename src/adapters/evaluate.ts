import path from 'node:path';
import { z } from 'zod';
import { checkSnapshot } from '../domain/checks.js';
import { decide } from '../domain/policy.js';
import { feedbackSchema, reviewSchema } from '../domain/review.js';
import { summarizeCalibration } from '../application/calibration.js';
import { readChecked, writeNewJson } from './files.js';
import { sessionSchema, verifySession } from './packets.js';
import { analyzeComposition } from '../domain/composition.js';

export async function evaluateSession(directory: string, reviewFiles: string[], feedbackFile: string, output: string, attempt: number, maxAttempts: number) {
  const session = await readChecked(path.join(directory, 'session.private.json'), sessionSchema);
  await verifySession(session, directory);
  const reviews = await Promise.all(reviewFiles.map(file => readChecked(file, reviewSchema)));
  const feedback = await readChecked(feedbackFile, z.array(feedbackSchema));
  const candidateGate = checkSnapshot(session.candidate, session.contract);
  const result = { schemaVersion: 1, createdAt: new Date().toISOString(), candidateGate,
    baselineGate: checkSnapshot(session.baseline, session.contract),
    decision: decide({ ...session, candidateGate, reviews, attempt, maxAttempts }),
    calibration: summarizeCalibration(feedback, reviews, session.packets),
    composition: { baseline: analyzeComposition(session.baseline, session.contract), candidate: analyzeComposition(session.candidate, session.contract) },
    reviews, binding: { candidateImageSha256: session.candidate.imageSha256, baselineImageSha256: session.baseline.imageSha256, contractSha256: session.contractSha256, protocolSha256: session.protocolSha256 },
    attempt, maxAttempts
  };
  await writeNewJson(output, result);
  return result;
}
