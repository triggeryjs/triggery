import { createRuntime, createTrigger, type Runtime } from '@triggery/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEVTOOLS_GLOBAL_KEY,
  DEVTOOLS_SOURCE,
  type DevtoolsMessage,
  installDevtoolsBridge,
} from '../src/index.ts';

type CapturedMessage = DevtoolsMessage;

let postSpy: ReturnType<typeof vi.spyOn>;
let captured: CapturedMessage[];
let activeRuntime: Runtime | undefined;

beforeEach(() => {
  captured = [];
  postSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation((data: unknown) => captured.push(data as CapturedMessage));
});

afterEach(() => {
  postSpy.mockRestore();
  activeRuntime?.dispose();
  activeRuntime = undefined;
  // Make sure we don't leak the discovery handle between tests.
  delete (globalThis as Record<string, unknown>)[DEVTOOLS_GLOBAL_KEY];
});

describe('installDevtoolsBridge', () => {
  it('exposes a discovery handle on globalThis at the default key', () => {
    activeRuntime = createRuntime();
    installDevtoolsBridge(activeRuntime);
    const handle = (globalThis as unknown as Record<string, { runtimeId?: string }>)[
      DEVTOOLS_GLOBAL_KEY
    ];
    expect(handle?.runtimeId).toBe(activeRuntime.id);
  });

  it('honours custom globalKey + source', () => {
    activeRuntime = createRuntime();
    installDevtoolsBridge(activeRuntime, { globalKey: '__custom__', source: 'custom-src' });
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires brackets on Record types
    expect((globalThis as Record<string, unknown>)['__custom__']).toBeDefined();
    expect(captured[0]?.source).toBe('custom-src');
  });

  it('posts a hello message with the current graph + buffer', () => {
    activeRuntime = createRuntime();
    createTrigger<{ events: { tick: number } }>(
      { id: 'demo', events: ['tick'], handler() {} },
      activeRuntime,
    );
    activeRuntime.fireSync('tick', 1);
    installDevtoolsBridge(activeRuntime);

    const hello = captured.find((m) => m.type === 'triggery:hello');
    expect(hello).toBeDefined();
    if (hello?.type !== 'triggery:hello') throw new Error('hello not hello');
    expect(hello.source).toBe(DEVTOOLS_SOURCE);
    expect(hello.runtimeId).toBe(activeRuntime.id);
    expect(hello.graph.triggers.map((t) => t.id)).toEqual(['demo']);
    expect(hello.buffer).toHaveLength(1);
  });

  it('streams every new snapshot as triggery:snapshot', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    createTrigger<{ events: { tick: number } }>(
      { id: 'stream', events: ['tick'], handler() {} },
      runtime,
    );
    installDevtoolsBridge(runtime);
    captured.length = 0;

    runtime.fireSync('tick', 1);
    runtime.fireSync('tick', 2);

    const snaps = captured.filter((m) => m.type === 'triggery:snapshot');
    expect(snaps).toHaveLength(2);
    if (snaps[0]?.type === 'triggery:snapshot') {
      expect(snaps[0].snapshot.triggerId).toBe('stream');
      expect(snaps[0].snapshot.eventName).toBe('tick');
    }
  });

  it('dispose() unsubscribes, removes the discovery handle and posts a bye', () => {
    activeRuntime = createRuntime();
    const runtime = activeRuntime;
    createTrigger<{ events: { tick: void } }>({ id: 'd', events: ['tick'], handler() {} }, runtime);
    const dispose = installDevtoolsBridge(runtime);
    captured.length = 0;

    dispose();
    runtime.fireSync('tick');

    expect(captured.find((m) => m.type === 'triggery:bye')).toBeDefined();
    expect(captured.find((m) => m.type === 'triggery:snapshot')).toBeUndefined();
    expect((globalThis as Record<string, unknown>)[DEVTOOLS_GLOBAL_KEY]).toBeUndefined();
  });

  it('dispose is idempotent', () => {
    activeRuntime = createRuntime();
    const dispose = installDevtoolsBridge(activeRuntime);
    captured.length = 0;
    dispose();
    dispose();
    // Only one 'bye' message — second call short-circuits.
    expect(captured.filter((m) => m.type === 'triggery:bye')).toHaveLength(1);
  });

  it('SSR / Node fallback: returns a no-op disposer when window is absent', () => {
    // happy-dom installs `window` on globalThis; replace it with a typed proxy
    // that hides the property so the bridge takes the SSR branch.
    const g = globalThis as unknown as Record<string, unknown>;
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires brackets on Record types
    const win = g['window'];
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires brackets on Record types
    delete g['window'];
    try {
      activeRuntime = createRuntime();
      const dispose = installDevtoolsBridge(activeRuntime);
      expect(() => dispose()).not.toThrow();
    } finally {
      // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires brackets on Record types
      g['window'] = win;
    }
  });
});
