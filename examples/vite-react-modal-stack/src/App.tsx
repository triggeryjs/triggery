import { useAction, useCondition, useEvent } from '@triggery/react';
import { useEffect, useRef, useState } from 'react';
import { type ModalSpec, modalTrigger } from './triggers/index.ts';

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h1>Triggery — modal stack</h1>
      <p>
        Three triggers compose: open events push the stack, close events pop. The trigger also
        restores focus to the original opener and toggles scroll-lock on body. No prop drilling, no
        shared store.
      </p>
      <ModalStackOwner />
      <Toolbar />
    </main>
  );
}

function ModalStackOwner() {
  const [stack, setStack] = useState<ModalSpec[]>([]);
  const [scrollLocked, setScrollLocked] = useState(false);

  useCondition(modalTrigger, 'stack', () => stack, [stack]);
  useAction(modalTrigger, 'setStack', setStack);
  useAction(modalTrigger, 'setScrollLock', setScrollLocked);
  useAction(modalTrigger, 'restoreFocus', (el) => el?.focus());

  useEffect(() => {
    document.body.style.overflow = scrollLocked ? 'hidden' : '';
  }, [scrollLocked]);

  return (
    <>
      {stack.map((m, idx) => (
        <ModalLayer key={m.id} spec={m} z={1000 + idx} />
      ))}
    </>
  );
}

function ModalLayer({ spec, z }: { spec: ModalSpec; z: number }) {
  const close = useEvent(modalTrigger, 'modal:close');
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: z,
      }}
    >
      <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320 }}>
        <h2>{spec.title}</h2>
        <p>{spec.body}</p>
        <button type="button" onClick={() => close(spec.id)}>
          Close
        </button>
      </div>
    </div>
  );
}

function Toolbar() {
  const open = useEvent(modalTrigger, 'modal:open');
  const btn1 = useRef<HTMLButtonElement>(null);
  const btn2 = useRef<HTMLButtonElement>(null);
  return (
    <section style={{ marginTop: 16, display: 'flex', gap: 8 }}>
      <button
        ref={btn1}
        type="button"
        onClick={() =>
          open({
            id: crypto.randomUUID(),
            title: 'Confirm delete',
            body: 'Are you sure?',
            triggerEl: btn1.current,
          })
        }
      >
        Confirm delete
      </button>
      <button
        ref={btn2}
        type="button"
        onClick={() =>
          open({
            id: crypto.randomUUID(),
            title: 'Resolve conflict',
            body: 'Pick a version.',
            triggerEl: btn2.current,
          })
        }
      >
        Resolve conflict
      </button>
    </section>
  );
}
