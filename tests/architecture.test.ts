import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? sources(path.join(directory, entry.name)) : Promise.resolve(entry.name.endsWith('.ts') ? [path.join(directory, entry.name)] : [])));
  return nested.flat();
}

function assertAcyclic(graph: Map<string, string[]>, node: string, visiting: Set<string>, done: Set<string>): void {
  if (visiting.has(node)) throw new Error(`Dependency cycle: ${node}`);
  if (done.has(node)) return;
  visiting.add(node);
  for (const next of graph.get(node) ?? []) assertAcyclic(graph, next, visiting, done);
  visiting.delete(node); done.add(node);
}

test('real source dependency graph is acyclic', async () => {
  const files = await sources(path.resolve('src'));
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const ast = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest);
    const imports = ast.statements.filter(ts.isImportDeclaration).map(statement => statement.moduleSpecifier).filter(ts.isStringLiteral).map(specifier => specifier.text).filter(name => name.startsWith('.'));
    graph.set(file, imports.map(name => path.resolve(path.dirname(file), name.replace(/\.js$/, '.ts'))));
  }
  const done = new Set<string>();
  for (const file of files) assertAcyclic(graph, file, new Set(), done);
});

test('cycle detector actually rejects a cycle', () => {
  assert.throws(() => assertAcyclic(new Map([['a', ['b']], ['b', ['a']]]), 'a', new Set(), new Set()), /cycle/);
});
