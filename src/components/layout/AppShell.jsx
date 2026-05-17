import { C, F } from '../../design/tokens.js';
import { ToastProvider } from '../primitives/Toast.jsx';
import { ConfirmProvider } from '../primitives/ConfirmModal.jsx';

export function AppShell({ header, children, impersonating, onStopImpersonation }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div style={{ minHeight: '100vh', background: C.bg }}>
          {impersonating && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              background: C.purple, color: '#fff', padding: '10px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              fontFamily: F.sans, fontSize: 13, fontWeight: 500,
            }}>
              <span>👁 Viewing as {impersonating.name}</span>
              <button onClick={onStopImpersonation} style={{
                padding: '4px 14px', borderRadius: 20, border: '2px solid rgba(255,255,255,0.5)',
                background: 'transparent', color: '#fff', cursor: 'pointer',
                fontFamily: F.sans, fontSize: 12, fontWeight: 600,
              }}>Exit</button>
            </div>
          )}
          <div style={{ paddingTop: impersonating ? 44 : 0 }}>
            {header}
            <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 28px 60px' }}>
              {children}
            </main>
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
