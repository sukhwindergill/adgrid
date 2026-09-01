import { useState } from 'react';
import { C, F, glass } from '../../design/tokens.js';
import NotificationBell from '../NotificationBell.jsx';
import { AccountSwitcher } from './AccountSwitcher.jsx';

export function GlobalHeader({ user, onSignOut, demoMode = false, onToggleDemoMode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 20px',
      ...glass,
      borderBottom: '1px solid rgba(0,0,0,0.07)',
      gap: 12,
    }}>
      <AccountSwitcher />
      <NotificationBell />

      {/* Avatar + dropdown */}
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: F.sans,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >{initials}</div>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 190 }}
            />
            <div style={{
              position: 'absolute',
              right: 0,
              top: 42,
              width: 220,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              padding: '8px 0',
              zIndex: 200,
            }}>
              {/* User info */}
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.text }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {user?.email}
                </div>
              </div>

              {/* Demo mode toggle — shows seeded fake screens (spread across
                  several countries/cities) so the product can be demoed
                  before real operators have onboarded. Off by default. */}
              {onToggleDemoMode && (
                <button
                  onClick={() => onToggleDemoMode()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: `1px solid ${C.border}`,
                    fontFamily: F.sans,
                    fontSize: 13,
                    color: C.text,
                    cursor: 'pointer',
                  }}
                >
                  <span>Demo mode <span style={{ color: C.textMuted, fontSize: 11 }}>(fake screens)</span></span>
                  <span style={{
                    display: 'inline-block', width: 30, height: 17, borderRadius: 999,
                    background: demoMode ? '#7c3aed' : '#d4d4d4', position: 'relative', transition: 'background 0.15s',
                    flexShrink: 0,
                  }}>
                    <span style={{
                      position: 'absolute', top: 2, left: demoMode ? 15 : 2, width: 13, height: 13,
                      borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                    }} />
                  </span>
                </button>
              )}

              {/* Sign out */}
              <button
                onClick={() => { onSignOut(); setMenuOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  fontFamily: F.sans,
                  fontSize: 13,
                  color: C.red,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >Sign out</button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
