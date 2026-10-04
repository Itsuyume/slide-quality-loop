import { parseArgs } from 'node:util';
import { checkSnapshot } from './domain/checks.js';
import { contractSchema } from './domain/schema.js';
import { digest, readChecked, writeNewJson } from './adapters/files.js';
import { loadSnapshot } from './adapters/snapshot.js';
import { prepareSession } from './adapters/packets.js';
import { evaluateSession } from './adapters/evaluate.js';
import { analyzeComposition } from './domain/composition.js';

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing --${name}.`);
  return value;
}

async function inspectSnapshot(command: 'gate' | 'diagnose', directory: string, contractFile: string, slide: number, output: string): Promise<void> {
  const contract = await readChecked(contractFile, contractSchema);
  const snapshot = await loadSnapshot(directory, slide, contract.role);
  if (command === 'diagnose') {
    const diagnostics = analyzeComposition(snapshot, contract);
    await writeNewJson(output, { imageSha256: snapshot.imageSha256, measurementSha256: snapshot.measurementSha256,
      contractSha256: digest(JSON.stringify(contract)), diagnostics });
    console.log(JSON.stringify(diagnostics));
    process.exitCode = diagnostics.status === 'measured' ? 0 : 3;
    return;
  }
  const result = checkSnapshot(snapshot, contract);
  await writeNewJson(output, { snapshot, result });
  console.log(JSON.stringify(result));
  process.exitCode = result.status === 'pass' ? 0 : result.status === 'fail' ? 2 : 3;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const { values } = parseArgs({ args: process.argv.slice(3), options: {
    snapshot: { type: 'string' }, baseline: { type: 'string' }, candidate: { type: 'string' },
    contract: { type: 'string' }, slide: { type: 'string', default: '13' }, out: { type: 'string' },
    session: { type: 'string' }, review: { type: 'string', multiple: true }, feedback: { type: 'string' },
    attempt: { type: 'string', default: '1' }, budget: { type: 'string', default: '3' }
  }, strict: true });
  const slide = Number(values.slide);
  if (!Number.isSafeInteger(slide) || slide < 1) throw new Error('Invalid slide number.');
  if (command === 'gate' || command === 'diagnose') {
    await inspectSnapshot(command, required(values.snapshot, 'snapshot'), required(values.contract, 'contract'), slide, required(values.out, 'out'));
    return;
  }
  if (command === 'prepare') {
    const result = await prepareSession(required(values.baseline, 'baseline'), required(values.candidate, 'candidate'), required(values.contract, 'contract'), slide, required(values.out, 'out'));
    console.log(JSON.stringify({ packets: result.packets.map(p => p.packetId), reviewStatus: 'pending' }));
    return;
  }
  if (command === 'evaluate') {
    const result = await evaluateSession(required(values.session, 'session'), values.review ?? [], required(values.feedback, 'feedback'), required(values.out, 'out'), Number(values.attempt), Number(values.budget));
    console.log(JSON.stringify({ decision: result.decision, calibration: result.calibration }));
    process.exitCode = result.decision.action === 'propose-for-human-review' ? 0 : 3;
    return;
  }
  throw new Error('Commands: gate|diagnose --snapshot DIR --contract FILE --out FILE; prepare --baseline DIR --candidate DIR --contract FILE --out NEW_DIR; evaluate --session DIR --review FILE --review FILE --feedback FILE --out NEW_FILE [--attempt 1 --budget 3].');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
