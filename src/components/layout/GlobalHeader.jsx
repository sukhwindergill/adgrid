import { useState } from 'react';
import { C, F, glass } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import NotificationBell from '../NotificationBell.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const OP_TABS = [
  { id: 'overview',  label: 'Dashboard' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'screens',   label: 'Screens' },
];
const ADV_TABS = [
  { id: 'adv-overview',  label: 'Dashboard' },
  { id: 'adv-campaigns', label: 'Campaigns' },
  { id: 'adv-analytics', label: 'Analytics' },
];

const OP_SECONDARY = [
  { id: 'revenue',      label: 'Revenue' },
  { id: 'audience',     label: 'Audience' },
  { id: 'advertisers',  label: 'Advertisers' },
  { id: 'signals',      label: 'Live Signals' },
  { id: 'billing',      label: 'Billing' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'display',      label: 'Display' },
];
const ADV_SECONDARY = [
  { id: 'adv-audience',     label: 'Scans & Data' },
  { id: 'adv-billing',      label: 'Billing' },
  { id: 'adv-settings',     label: 'Settings' },
  { id: 'adv-integrations', label: 'Integrations' },
];

export function GlobalHeader({ active, setActive, user, onSignOut, isAdv }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState(null);
  const { isMobile } = useBreakpoint();

  const tabs = isAdv ? ADV_TABS : OP_TABS;
  const secondaryLinks = isAdv ? ADV_SECONDARY : OP_SECONDARY;
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  const isSecondaryActive = secondaryLinks.some(l => l.id === active);

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      {/* ── Primary bar ── */}
      <header style={{
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 28px',
        ...glass, borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F.sans,
          }}>A</div>
          {!isMobile && (
            <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', color: C.text }}>ADGRID</span>
          )}
        </div>

        {/* Primary tabs */}
        <nav style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: 60 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{
              padding: isMobile ? '0 10px' : '0 16px',
              background: 'none', border: 'none',
              borderBottom: active === t.id && !isSecondaryActive ? `2px solid ${C.purple}` : '2px solid transparent',
              color: active === t.id && !isSecondaryActive ? C.text : C.textSub,
              fontFamily: F.sans, fontSize: isMobile ? 12 : 14,
              fontWeight: active === t.id && !isSecondaryActive ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center',
              whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell aria-label="Notifications" />
          {!isMobile && (
            <Btn
              variant="primary"
              size="sm"
              onClick={() => setActive(isAdv ? 'adv-create' : 'campaigns')}
              style={{ boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
            >
              + New Campaign
            </Btn>
          )}

          {/* Avatar + dropdown (user info + sign out only) */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setMenuOpen(o => !o)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuOpen(o => !o); } }}
              aria-label="Account menu"
              role="button"
              tabIndex={0}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: F.sans,
                cursor: 'pointer', userSelect: 'none',
              }}
            >{initials}</div>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 190 }} />
                <div style={{
                  position: 'absolute', right: 0, top: 42, width: 200,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  padding: '8px 0', zIndex: 200,
                }}>
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.text }}>{user?.name || 'User'}</div>
                    <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>{user?.email}</div>
                  </div>
                  <button onClick={() => { onSignOut(); setMenuOpen(false); }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 16px', background: 'none', border: 'none',
                    fontFamily: F.sans, fontSize: 13, color: C.red, cursor: 'pointer',
                  }}>Sign out</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Secondary sub-nav ── */}
      <div style={{
        height: 40,
        display: 'flex', alignItems: 'stretch',
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        overflowX: 'auto',
        padding: '0 28px',
        gap: 0,
      }}>
        {secondaryLinks.map(l => (
          <button
            key={l.id}
            onClick={() => setActive(l.id)}
            style={{
              padding: '0 14px',
              background: 'none', border: 'none',
              borderBottom: active === l.id ? `2px solid ${C.purple}` : '2px solid transparent',
              color: active === l.id ? C.text : hoveredLink === l.id ? C.textSub : C.textMuted,
              fontFamily: F.sans, fontSize: 12,
              fontWeight: active === l.id ? 600 : 400,
              cursor: 'pointer', transition: 'color 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={() => setHoveredLink(l.id)}
            onMouseLeave={() => setHoveredLink(null)}
            onFocus={() => setHoveredLink(l.id)}
            onBlur={() => setHoveredLink(null)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
