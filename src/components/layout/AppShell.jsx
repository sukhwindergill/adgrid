import { C, F, T } from '../../design/tokens.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

export function AppShell({ sidebar, header, children, impersonating, onStopImpersonation }) {
  const { isMobile, width } = useBreakpoint();
  // Phones carry a fixed bottom tab bar (see MobileTabBar); keep content clear of it.
  const bottomPad = width < 768 ? 'calc(88px + env(safe-area-inset-bottom))' : (isMobile ? '40px' : '60px');
  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Impersonation banner — fixed, full width */}
      {impersonating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: C.purple,
          color: '#fff',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: F.sans,
          fontSize: T.base,
          fontWeight: 500,
        }}>
          <span>👁 Viewing as {impersonating.name}</span>
          <button
            onClick={onStopImpersonation}
            style={{
              padding: '4px 14px',
              borderRadius: 20,
              border: '2px solid rgba(255,255,255,0.5)',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: F.sans,
              fontSize: T.sm,
              fontWeight: 600,
            }}
          >Exit</button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        minHeight: '100vh',
        paddingTop: impersonating ? 44 : 0,
      }}>
        {/* Sidebar slot */}
        {sidebar}

        {/* Right column: TopBar + main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {header}
          <main id="main-content" style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? `16px 12px ${bottomPad}` : `28px 28px ${bottomPad}`, width: '100%', boxSizing: 'border-box' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
