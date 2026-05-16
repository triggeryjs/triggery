import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractTrigger } from '../src/codemods/extract-trigger.ts';

describe('extract-trigger codemod', () => {
  let workdir = '';

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'triggery-codemod-'));
  });

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  async function writeFixture(name: string, code: string): Promise<string> {
    const path = join(workdir, name);
    await writeFile(path, code, 'utf8');
    return path;
  }

  it('generates a *.trigger.ts file from a useEffect block', async () => {
    const file = await writeFixture(
      'Chat.tsx',
      [
        "import { useEffect } from 'react';",
        '',
        'export function Chat() {',
        '  useEffect(() => {',
        '    console.log("hi");',
        '  }, []);',
        '  return null;',
        '}',
        '',
      ].join('\n'),
    );

    const result = extractTrigger({ file, name: 'new-message' });

    expect(result.triggerFilePath.endsWith('new-message.trigger.ts')).toBe(true);
    expect(result.triggerFileContent).toContain("id: 'new-message'");
    expect(result.triggerFileContent).toContain("events: ['new-message']");
    expect(result.triggerFileContent).toContain('console.log("hi");');

    // Source file should now reference useEvent.
    const updated = await readFile(file, 'utf8');
    expect(updated).toContain("useEvent(newMessageTrigger, 'new-message')");
    expect(updated).not.toContain('console.log("hi");');
  });

  it('throws when there is no useEffect', async () => {
    const file = await writeFixture('Nothing.tsx', 'export function Nothing() { return null; }\n');
    expect(() => extractTrigger({ file, name: 'noop' })).toThrow(/No useEffect/);
  });

  it('supports dry-run (no files written)', async () => {
    const file = await writeFixture(
      'Chat.tsx',
      'export function Chat() { useEffect(() => { a(); }, []); }\n',
    );
    const result = extractTrigger({ file, name: 'ping', dryRun: true });
    expect(result.triggerFileContent).toContain("id: 'ping'");
    // The source file was modified in memory by ts-morph but never persisted —
    // re-read from disk to confirm.
    const onDisk = await readFile(file, 'utf8');
    expect(onDisk).toContain('useEffect(() =>');
  });
});
