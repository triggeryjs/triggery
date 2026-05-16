import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeScheduler } from '../src/index.ts';

describe('fakeScheduler', () => {
  let scheduler = createFakeScheduler();

  afterEach(() => {
    scheduler.uninstall();
  });

  it('intercepts setTimeout and holds callbacks until advance()', async () => {
    scheduler = createFakeScheduler();
    scheduler.install();
    const cb = vi.fn();
    setTimeout(cb, 1000);
    expect(cb).not.toHaveBeenCalled();
    await scheduler.advance(500);
    expect(cb).not.toHaveBeenCalled();
    await scheduler.advance(500);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('runs multiple timers in scheduled-time order, with FIFO tiebreak', async () => {
    scheduler = createFakeScheduler();
    scheduler.install();
    const order: number[] = [];
    setTimeout(() => order.push(2), 200);
    setTimeout(() => order.push(1), 100);
    setTimeout(() => order.push(3), 200); // same time as id=2, scheduled later → after
    await scheduler.advance(200);
    expect(order).toEqual([1, 2, 3]);
  });

  it('clearTimeout cancels a pending timer', async () => {
    scheduler = createFakeScheduler();
    scheduler.install();
    const cb = vi.fn();
    const id = setTimeout(cb, 100);
    clearTimeout(id);
    await scheduler.advance(500);
    expect(cb).not.toHaveBeenCalled();
    expect(scheduler.pending()).toBe(0);
  });

  it('flushAll() runs every pending timer regardless of time', async () => {
    scheduler = createFakeScheduler();
    scheduler.install();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    setTimeout(cb1, 100);
    setTimeout(cb2, 50_000);
    await scheduler.flushAll();
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(scheduler.now()).toBe(50_000);
  });

  it('uninstall() restores native setTimeout', () => {
    scheduler = createFakeScheduler();
    const original = globalThis.setTimeout;
    scheduler.install();
    expect(globalThis.setTimeout).not.toBe(original);
    scheduler.uninstall();
    expect(globalThis.setTimeout).toBe(original);
  });

  it('advance() with negative ms throws', async () => {
    scheduler = createFakeScheduler();
    scheduler.install();
    await expect(scheduler.advance(-1)).rejects.toThrow(/ms must be/);
  });
});
