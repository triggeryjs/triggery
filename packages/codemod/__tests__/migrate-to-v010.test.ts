import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateToV010 } from '../src/codemods/migrate-to-v010.ts';

describe('migrate-to-v010 codemod', () => {
  let workdir = '';

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'triggery-codemod-v010-'));
  });
  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  async function fixture(name: string, code: string): Promise<string> {
    const path = join(workdir, name);
    await writeFile(path, code, 'utf8');
    return path;
  }

  it('removes `conditions.X!` non-null assertions inside the handler', async () => {
    const file = await fixture(
      'a.ts',
      [
        "import { createTrigger } from '@triggery/core';",
        '',
        'export const t = createTrigger({',
        "  id: 't', events: ['e'], required: ['user'],",
        '  handler({ conditions }) {',
        '    return conditions.user!.id;',
        '  },',
        '});',
      ].join('\n'),
    );

    const results = migrateToV010({ files: [file] });
    expect(results[0]?.nonNullAssertionsRemoved).toBe(1);

    const updated = await readFile(file, 'utf8');
    expect(updated).toContain('conditions.user.id');
    expect(updated).not.toContain('conditions.user!');
  });

  it('folds let + registerCondition pairs into conditions: config', async () => {
    const file = await fixture(
      'b.ts',
      [
        "import { createTrigger, createRuntime } from '@triggery/core';",
        '',
        'const runtime = createRuntime();',
        'let user = null;',
        '',
        'export const t = createTrigger({',
        "  id: 't',",
        "  events: ['e'],",
        '  handler() {},',
        '});',
        '',
        "runtime.registerCondition(t.id, 'user', () => user);",
        '',
        "user = { id: 'alice' };",
      ].join('\n'),
    );

    const results = migrateToV010({ files: [file] });
    expect(results[0]?.conditionsInlined).toBe(1);

    const updated = await readFile(file, 'utf8');
    expect(updated).toContain("conditions: { 'user': null }");
    expect(updated).not.toContain('runtime.registerCondition');
    expect(updated).not.toContain('let user');
    expect(updated).toContain("t.setCondition('user', { id: 'alice' })");
  });

  it('leaves complex getters alone with a review marker', async () => {
    const file = await fixture(
      'c.ts',
      [
        "import { createTrigger, createRuntime } from '@triggery/core';",
        '',
        'const runtime = createRuntime();',
        'const store = { getUser: () => ({ id: 1 }) };',
        '',
        'export const t = createTrigger({',
        "  id: 't', events: ['e'], handler() {},",
        '});',
        '',
        "runtime.registerCondition(t.id, 'user', () => store.getUser());",
      ].join('\n'),
    );

    const results = migrateToV010({ files: [file] });
    expect(results[0]?.conditionsInlined).toBe(0);
    expect(results[0]?.reviewMarkers.length).toBeGreaterThan(0);

    const updated = await readFile(file, 'utf8');
    // Original line preserved
    expect(updated).toContain("registerCondition(t.id, 'user', () => store.getUser());");
    // Review marker prepended
    expect(updated).toContain('// triggery-codemod: review');
  });

  it('handles multi-condition triggers (folds each independently)', async () => {
    const file = await fixture(
      'd.ts',
      [
        "import { createTrigger, createRuntime } from '@triggery/core';",
        '',
        'const runtime = createRuntime();',
        'let user = null;',
        'let settings = null;',
        '',
        'export const t = createTrigger({',
        "  id: 't', events: ['e'], handler() {},",
        '});',
        '',
        "runtime.registerCondition(t.id, 'user', () => user);",
        "runtime.registerCondition(t.id, 'settings', () => settings);",
      ].join('\n'),
    );

    const results = migrateToV010({ files: [file] });
    expect(results[0]?.conditionsInlined).toBe(2);

    const updated = await readFile(file, 'utf8');
    expect(updated).toContain("'user': null");
    expect(updated).toContain("'settings': null");
  });

  it('dry-run does not write files', async () => {
    const file = await fixture(
      'e.ts',
      [
        "import { createTrigger } from '@triggery/core';",
        '',
        'export const t = createTrigger({',
        "  id: 't', events: ['e'], required: ['user'],",
        '  handler({ conditions }) {',
        '    return conditions.user!.id;',
        '  },',
        '});',
      ].join('\n'),
    );

    const before = await readFile(file, 'utf8');
    const results = migrateToV010({ files: [file], dryRun: true });
    expect(results[0]?.nonNullAssertionsRemoved).toBe(1);
    const after = await readFile(file, 'utf8');
    expect(after).toBe(before);
  });
});
