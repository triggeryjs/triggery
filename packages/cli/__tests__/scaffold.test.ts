import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldTrigger } from '../src/commands/scaffold.ts';

describe('scaffold trigger', () => {
  let workdir = '';

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'triggery-cli-'));
  });
  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it('writes a *.trigger.ts file in src/triggers by default', async () => {
    const path = await scaffoldTrigger({ name: 'new-message', cwd: workdir });
    expect(path.endsWith('/src/triggers/new-message.trigger.ts')).toBe(true);
    const content = await readFile(path, 'utf8');
    expect(content).toContain("id: 'new-message'");
    expect(content).toContain('export const newMessageTrigger');
    expect(content).toContain("events: ['new-message']");
  });

  it('honours --out-dir', async () => {
    const path = await scaffoldTrigger({
      name: 'reset',
      outDir: 'app/flows',
      cwd: workdir,
    });
    expect(path.endsWith('/app/flows/reset.trigger.ts')).toBe(true);
  });
});
