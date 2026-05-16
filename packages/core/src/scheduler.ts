import type { SchedulerStrategy } from './types.ts';

export type Task = () => void;

export type SchedulerImpl = {
  enqueue(task: Task): void;
  /** Drain all pending tasks synchronously (for tests and `fireSync`). */
  flush(): void;
};

function createMicrotaskScheduler(): SchedulerImpl {
  let queue: Task[] = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (queue.length === 0) return;
    const tasks = queue;
    queue = [];
    for (const task of tasks) {
      try {
        task();
      } catch (error) {
        // Do not let one task take down the rest. Errors are surfaced via the inspector.
        // eslint-disable-next-line no-console -- last line of defence
        console.error('[triggery] scheduler task failed:', error);
      }
    }
  };

  return {
    enqueue(task) {
      queue.push(task);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    },
    flush,
  };
}

function createSyncScheduler(): SchedulerImpl {
  return {
    enqueue(task) {
      task();
    },
    flush() {
      // The sync scheduler keeps no queue.
    },
  };
}

export function createScheduler(strategy: SchedulerStrategy): SchedulerImpl {
  return strategy === 'sync' ? createSyncScheduler() : createMicrotaskScheduler();
}
