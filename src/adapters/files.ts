import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { ZodType, ZodTypeDef } from 'zod';

export function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function readChecked<T>(file: string, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  return schema.parse(value);
}

export async function writeNewJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
