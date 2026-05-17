import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { C, F } from '../../design/tokens.js';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { message, variant: 'success'|'error' }
  const timerRef = useRef(null);

  const show = useCallback((message, variant = 'error') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, variant });
    timerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          onClick={dismiss}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
            padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
            fontFamily: F.sans, fontSize: 13, fontWeight: 500,
            maxWidth: 360,
            background: toast.variant === 'success' ? C.greenSoft : C.redSoft,
            border: `1px solid ${toast.variant === 'success' ? C.greenBorder : C.redBorder}`,
            color: toast.variant === 'success' ? C.green : C.red,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            animation: 'toast-in 0.2s ease',
          }}
        >
          {toast.message}
          <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return {
    error: (msg) => ctx.show(msg, 'error'),
    success: (msg) => ctx.show(msg, 'success'),
  };
}
