import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTriggerGraph, renderGraph } from '../src/commands/graph.ts';

describe('graph builder', () => {
  let workdir = '';

  beforeEach(async () => {
    workdir = await mkdtemp(join(tmpdir(), 'triggery-graph-'));
    await mkdir(join(workdir, 'src/triggers'), { recursive: true });
    await writeFile(
      join(workdir, 'src/triggers/message.trigger.ts'),
      `import { createTrigger } from '@triggery/core';
      export const messageTrigger = createTrigger({
        id: 'message-received',
        events: ['new-message', 'urgent-message'],
        required: ['user', 'settings'],
        handler() {},
      });`,
      'utf8',
    );
    await writeFile(
      join(workdir, 'src/triggers/onboarding.trigger.ts'),
      `import { createTrigger } from '@triggery/core';
      export const onboardingTrigger = createTrigger({
        id: 'onboarding',
        events: ['app-mount'],
        required: [],
        handler() {},
      });`,
      'utf8',
    );
  });
  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it('discovers every createTrigger call', () => {
    const nodes = buildTriggerGraph({ cwd: workdir });
    expect(nodes).toHaveLength(2);
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['message-received', 'onboarding']);
  });

  it('extracts events and required conditions', () => {
    const nodes = buildTriggerGraph({ cwd: workdir });
    const msg = nodes.find((n) => n.id === 'message-received');
    expect(msg?.events).toEqual(['new-message', 'urgent-message']);
    expect(msg?.required).toEqual(['user', 'settings']);
  });

  it('renders json/dot/md formats', () => {
    const nodes = buildTriggerGraph({ cwd: workdir });
    expect(renderGraph(nodes, 'json')).toContain('"id"');
    const dot = renderGraph(nodes, 'dot');
    expect(dot).toContain('digraph triggery');
    expect(dot).toContain('"event:new-message"');
    const md = renderGraph(nodes, 'md');
    expect(md).toContain('| `message-received` |');
  });
});
