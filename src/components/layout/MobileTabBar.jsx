import { useState, useEffect } from 'react';
import { C, F } from '../../design/tokens.js';
import { ModeSwitcher } from './Sidebar.jsx';
import { ICONS } from './navIcons.jsx';
import { navFor, tabsFor, highlightedNavId } from './navConfig.js';

const MORE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
);

function Badge({ count }) {
  if (!count) return null;
  return (
    <span style={{
      position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8,
      background: C.amber, color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: F.sans,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
    }}>{count > 99 ? '99+' : count}</span>
  );
}

// Phone navigation: four primary destinations plus a More sheet holding the
// full grouped nav, the operator/advertiser switch and sign out.
export function MobileTabBar({ active, activeMode, onModeSwitch, onNavigate, onSignOut, pendingCount = 0 }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const current = highlightedNavId(active);
  const tabs = tabsFor(activeMode);
  const inTabs = tabs.some(t => t.id === current);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const go = id => { setMoreOpen(false); onNavigate(id); };

  const tabBtn = (isActive) => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '8px 0 6px', background: 'none', border: 'none', cursor: 'pointer',
    color: isActive ? C.purple : C.textSub, fontFamily: F.sans, fontSize: 11,
    fontWeight: isActive ? 600 : 500, minHeight: 52,
  });

  return (
    <>
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 140 }} />
      )}
      {moreOpen && (
        <div role="dialog" aria-modal="true" aria-label="All pages" style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(60px + env(safe-area-inset-bottom))',
          maxHeight: '70vh', overflowY: 'auto', zIndex: 150, background: C.surface,
          borderTop: `1px solid ${C.border}`, borderRadius: '16px 16px 0 0', padding: '16px 16px 8px',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
        }}>
          {onModeSwitch && <ModeSwitcher activeMode={activeMode} onSwitch={m => { setMoreOpen(false); onModeSwitch(m); }} collapsed={false} />}
          {navFor(activeMode).map(g => (
            <div key={g.group ?? 'top'} style={{ marginBottom: 8 }}>
              {g.group && (
                <div style={{ padding: '8px 4px 4px', fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F.sans }}>
                  {g.group}
                </div>
              )}
              {g.items.map(item => (
                <button key={item.id} onClick={() => go(item.id)} aria-current={current === item.id ? 'page' : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px',
                  background: current === item.id ? C.purpleSoft : 'none', border: 'none', borderRadius: 8,
                  color: current === item.id ? C.purple : C.text, fontFamily: F.sans, fontSize: 15, cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ display: 'flex', position: 'relative' }}>
                    {ICONS[item.icon]}
                    {item.badge && <Badge count={pendingCount} />}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
          <button onClick={() => { setMoreOpen(false); onSignOut(); }} style={{
            width: '100%', padding: '12px 8px', background: 'none', border: 'none', borderTop: `1px solid ${C.border}`,
            color: C.red, fontFamily: F.sans, fontSize: 15, textAlign: 'left', cursor: 'pointer', marginTop: 4,
          }}>Sign out</button>
        </div>
      )}
      <nav aria-label="Main" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 160, display: 'flex',
        background: C.surface, borderTop: `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => go(t.id)} aria-current={current === t.id ? 'page' : undefined} style={tabBtn(current === t.id && !moreOpen)}>
            <span style={{ display: 'flex', position: 'relative' }}>
              {ICONS[t.icon]}
              {t.badge && <Badge count={pendingCount} />}
            </span>
            {t.id.endsWith('overview') ? 'Home' : t.id === 'approval' ? 'Approvals' : t.label}
          </button>
        ))}
        <button onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} style={tabBtn(moreOpen || !inTabs)}>
          <span style={{ display: 'flex' }}>{MORE_ICON}</span>
          More
        </button>
      </nav>
    </>
  );
}
