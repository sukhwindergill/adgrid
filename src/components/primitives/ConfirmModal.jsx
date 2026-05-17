import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { Card } from './Card.jsx';
import { Btn } from './Btn.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', danger = false }) => {
    return new Promise((resolve) => {
      setState({ title, message, confirmLabel, danger, resolve });
    });
  }, []);

  const handleResponse = useCallback((value) => {
    setState(prev => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  // Resolve with false on unmount to prevent hanging promises
  useEffect(() => {
    return () => {
      setState(prev => {
        prev?.resolve(false);
        return null;
      });
    };
  }, []);

  // Escape key dismisses modal
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => { if (e.key === 'Escape') handleResponse(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, handleResponse]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9997, backdropFilter: 'blur(4px)',
        }}>
          <Card style={{ width: '100%', maxWidth: 380, padding: 28, margin: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
              {state.title}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, marginBottom: 24, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {state.message}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => handleResponse(false)}>Cancel</Btn>
              <Btn
                onClick={() => handleResponse(true)}
                style={state.danger ? { background: C.red, color: '#fff' } : {}}
                onMouseEnter={state.danger ? (e => { e.currentTarget.style.background = '#dc2626'; }) : undefined}
                onMouseLeave={state.danger ? (e => { e.currentTarget.style.background = C.red; }) : undefined}
              >
                {state.confirmLabel}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
