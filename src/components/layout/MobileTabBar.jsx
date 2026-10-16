import { useState, useEffect } from 'react';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../primitives/Btn.jsx';
import { CountBadge } from '../primitives/CountBadge.jsx';
import { ModeSwitcher } from './Sidebar.jsx';
import { ICONS } from './navIcons.jsx';
import { navFor, tabsFor, highlightedNavId } from './navConfig.js';

const MORE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
);

const Badge = ({ count }) => <CountBadge count={count} style={{ position: 'absolute', top: -4, right: -8 }} />;

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
    padding: '8px 0 6px',
    color: isActive ? C.purple : C.textSub, fontFamily: F.sans, fontSize: T.xs,
    fontWeight: isActive ? 600 : 500, minHeight: 52,
  });

  return (
    <>
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 140 }} />
      )}
      {moreOpen && (
        <div role="dialog" aria-modal="true" aria-label="All pages" style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(60px + env(safe-area-inset-bottom))',
          maxHeight: '70vh', overflowY: 'auto', zIndex: 150, background: C.surface,
          borderTop: `1px solid ${C.border}`, borderRadius: '16px 16px 0 0', padding: '16px 16px 8px',
          boxShadow: SH.sheet,
        }}>
          {onModeSwitch && <ModeSwitcher activeMode={activeMode} onSwitch={m => { setMoreOpen(false); onModeSwitch(m); }} collapsed={false} />}
          {navFor(activeMode).map(g => (
            <div key={g.group ?? 'top'} style={{ marginBottom: 8 }}>
              {g.group && (
                <div style={{ ...TX.caption, padding: '8px 4px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {g.group}
                </div>
              )}
              {g.items.map(item => (
                <Btn variant="unstyled" key={item.id} onClick={() => go(item.id)} aria-current={current === item.id ? 'page' : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px',
                  background: current === item.id ? C.purpleSoft : 'none', borderRadius: 8,
                  color: current === item.id ? C.purple : C.text, fontFamily: F.sans, fontSize: T.md, textAlign: 'left',
                }}>
                  <span style={{ display: 'flex', position: 'relative' }}>
                    {ICONS[item.icon]}
                    {item.badge && <Badge count={pendingCount} />}
                  </span>
                  {item.label}
                </Btn>
              ))}
            </div>
          ))}
          <Btn variant="unstyled" onClick={() => { setMoreOpen(false); onSignOut(); }} style={{
            width: '100%', padding: '12px 8px', borderTop: `1px solid ${C.border}`,
            color: C.redText, fontFamily: F.sans, fontSize: T.md, textAlign: 'left', marginTop: 4,
          }}>Sign out</Btn>
        </div>
      )}
      <nav aria-label="Main" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 160, display: 'flex',
        background: C.surface, borderTop: `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {tabs.map(t => (
          <Btn variant="unstyled" key={t.id} onClick={() => go(t.id)} aria-current={current === t.id ? 'page' : undefined} style={tabBtn(current === t.id && !moreOpen)}>
            <span style={{ display: 'flex', position: 'relative' }}>
              {ICONS[t.icon]}
              {t.badge && <Badge count={pendingCount} />}
            </span>
            {t.id.endsWith('overview') ? 'Home' : t.id === 'approval' ? 'Approvals' : t.label}
          </Btn>
        ))}
        <Btn variant="unstyled" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} style={tabBtn(moreOpen || !inTabs)}>
          <span style={{ display: 'flex' }}>{MORE_ICON}</span>
          More
        </Btn>
      </nav>
    </>
  );
}
