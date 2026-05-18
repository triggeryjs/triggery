import { describe, expect, it, vi } from 'vitest';
import { createRuntime, createTrigger } from '../src/index.ts';
import { createInspector, createInspectorFactory, createNoopInspector } from '../src/inspect.ts';

describe('A1 — inspect subpath', () => {
  it('createInspectorFactory returns a function that builds a real inspector', () => {
    const factory = createInspectorFactory();
    const inspector = factory(10);
    expect(typeof inspector.record).toBe('function');
    expect(typeof inspector.getBuffer).toBe('function');
  });

  it('createRuntime accepts a factory and uses it', () => {
    const factory = vi.fn(createInspectorFactory());
    const runtime = createRuntime({ inspector: factory });
    expect(factory).toHaveBeenCalledExactlyOnceWith(50);
    expect(runtime.inspectorEnabled).toBe(true);
  });

  it('factory-supplied inspector records snapshots end-to-end', () => {
    const runtime = createRuntime({ inspector: createInspectorFactory() });
    createTrigger<{ events: { go: void }; actions: { ping: void } }>(
      {
        id: 'fac',
        events: ['go'],
        handler({ actions }) {
          actions.ping?.();
        },
      },
      runtime,
    );
    runtime.registerAction('fac', 'ping', () => {});
    runtime.fireSync('go');
    const snapshots = runtime.getInspectorBuffer();
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0]?.triggerId).toBe('fac');
  });

  it('respects bufferSize from createRuntime options', () => {
    const factory = vi.fn(createInspectorFactory());
    createRuntime({ inspector: factory, inspectorBufferSize: 7 });
    expect(factory).toHaveBeenCalledWith(7);
  });

  it('re-exported createInspector + createNoopInspector still work', () => {
    expect(typeof createInspector(5).record).toBe('function');
    expect(typeof createNoopInspector().record).toBe('function');
  });

  it('inspector: false keeps the runtime in noop mode (factory not invoked)', () => {
    const factory = vi.fn(createInspectorFactory());
    const runtime = createRuntime({ inspector: false });
    expect(runtime.inspectorEnabled).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });
});
