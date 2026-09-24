import { useState } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { checklistProgress } from '../../lib/gettingStarted.js';

function readDismissed(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

// Progress card shown at the top of a dashboard until every step is done or
// the user hides it. `steps` come from lib/gettingStarted.js; `onGo(step)`
// opens the step's destination. Dismissal is per browser, keyed by
// `storageKey` (include the user id so shared machines don't leak it).
export function GettingStartedCard({ title = 'Get started', steps, storageKey, onGo }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));
  const { done, total, complete, next } = checklistProgress(steps);

  if (complete || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* best effort */ }
    setDismissed(true);
  };

  return (
    <Card style={{ marginBottom: 24, padding: 22 }}>
      <section aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontFamily: F.display, fontSize: 17, fontWeight: 600, color: C.text }}>{title}</h2>
          <span style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted }}>{done} of {total} done</span>
          <button type="button" onClick={dismiss}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.sans, fontSize: 12, color: C.textMuted }}>
            Hide
          </button>
        </div>

        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
          style={{ height: 4, borderRadius: 2, background: C.surfaceAlt, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${(done / total) * 100}%`, background: C.purple, transition: 'width 0.4s' }} />
        </div>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {steps.map(step => {
            const isNext = step === next;
            return (
              <li key={step.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8,
                background: isNext ? C.purpleSoft : 'transparent',
              }}>
                <span aria-hidden="true" style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                  background: step.done ? C.green : 'transparent',
                  border: step.done ? 'none' : `1.5px solid ${isNext ? C.purple : C.borderDark}`,
                  color: '#fff',
                }}>{step.done ? '✓' : ''}</span>
                <div style={{ flex: 1, minWidth: 0, fontFamily: F.sans }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: step.done ? C.textMuted : C.text,
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}>
                    {step.title}<span style={{ position: 'absolute', left: -9999 }}>{step.done ? ' (done)' : ''}</span>
                  </div>
                  {!step.done && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{step.body}</div>}
                </div>
                {isNext && <Btn size="sm" onClick={() => onGo(step)}>Start</Btn>}
              </li>
            );
          })}
        </ol>
      </section>
    </Card>
  );
}
