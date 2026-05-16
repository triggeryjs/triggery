import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateFromListenerMiddleware } from '../src/codemods/migrate-from-listener-middleware.ts';

describe('migrate-from-listener-middleware codemod', () => {
  let workdir = '';

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'triggery-codemod-rtk-'));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  async function writeFixture(name: string, code: string): Promise<string> {
    const path = join(workdir, name);
    await writeFile(path, code, 'utf8');
    return path;
  }

  it('emits one *.trigger.ts per startListening call', async () => {
    const file = await writeFixture(
      'middleware.ts',
      [
        "import { createListenerMiddleware } from '@reduxjs/toolkit';",
        "import { messageReceived, userLoggedIn } from './slice';",
        '',
        'const lm = createListenerMiddleware();',
        '',
        'lm.startListening({',
        '  actionCreator: messageReceived,',
        '  effect: async (action, api) => {',
        '    api.dispatch({ type: "notify", payload: action.payload });',
        '  },',
        '});',
        '',
        'lm.startListening({',
        '  actionCreator: userLoggedIn,',
        '  effect: (action) => { track(action); },',
        '});',
        '',
      ].join('\n'),
    );

    const result = migrateFromListenerMiddleware({ file });

    expect(result.migrated).toHaveLength(2);
    const names = result.migrated.map((m) => m.eventName).sort();
    expect(names).toEqual(['message-received', 'user-logged-in']);

    const firstContent = result.migrated[0]?.triggerFileContent ?? '';
    expect(firstContent).toContain("id: 'message-received'");
    expect(firstContent).toContain('api.dispatch');
  });

  it('returns an empty migrated list when no startListening is present', async () => {
    const file = await writeFixture('plain.ts', 'export const x = 1;\n');
    const result = migrateFromListenerMiddleware({ file });
    expect(result.migrated).toEqual([]);
  });

  it('supports dry-run', async () => {
    const file = await writeFixture(
      'mw.ts',
      [
        "import { messageReceived } from './slice';",
        'lm.startListening({ actionCreator: messageReceived, effect: (a) => {} });',
        '',
      ].join('\n'),
    );
    const result = migrateFromListenerMiddleware({ file, dryRun: true });
    expect(result.migrated).toHaveLength(1);
  });
});
