import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, F, T } from '../../design/tokens.js';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { navFor, highlightedNavId } from './navConfig.js';
import { MobileTabBar } from './MobileTabBar.jsx';
import { ICONS } from './navIcons.jsx';

// ─── ModeSwitcher ─────────────────────────────────────────────────────────────

export function ModeSwitcher({ activeMode, onSwitch, collapsed }) {
  const modes = [
    { id: 'operator',   label: 'Operator' },
    { id: 'advertiser', label: 'Advertiser' },
  ];

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
        {modes.map(m => (
          <button
            key={m.id}
            title={m.label}
            aria-label={`Switch to ${m.label} mode`}
            aria-pressed={activeMode === m.id}
            onClick={() => onSwitch(m.id)}
            style={{
              width: '100%', padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: activeMode === m.id
                ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.15))'
                : 'transparent',
              color: activeMode === m.id ? C.purple : C.textMuted,
              fontSize: T.xs, fontWeight: 700, fontFamily: F.sans, letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.id === 'operator' ? ICONS.operatorMode : ICONS.advertiserMode}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', background: C.surfaceAlt, borderRadius: 8,
      padding: 3, gap: 2, margin: '0 0 10px 0',
      border: `1px solid ${C.border}`,
    }}>
      {modes.map(m => (
        <button
          key={m.id}
          onClick={() => onSwitch(m.id)}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: T.sm, fontWeight: activeMode === m.id ? 600 : 500, fontFamily: F.sans,
            transition: 'all 0.15s',
            background: activeMode === m.id ? C.surface : 'transparent',
            color: activeMode === m.id ? C.purple : C.textSub,
            boxShadow: activeMode === m.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ item, active, collapsed, pendingCount, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isActive = highlightedNavId(active) === item.id;
  const showBadge = item.badge && pendingCount > 0;

  return (
    <button
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onClick(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        width: '100%',
        padding: collapsed ? '10px 0' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive
          ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.08))'
          : hovered
          ? 'rgba(124,58,237,0.06)'
          : 'transparent',
        border: 'none',
        borderRadius: 8,
        color: isActive ? C.purple : hovered ? C.text : C.textSub,
        cursor: 'pointer',
        fontFamily: F.sans,
        fontSize: T.base,
        fontWeight: isActive ? 600 : 400,
        transition: 'all 0.15s',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Active left border */}
      {isActive && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '20%',
          bottom: '20%',
          width: 3,
          borderRadius: 2,
          background: C.purple,
        }} />
      )}

      <span style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        color: isActive ? C.purple : 'inherit',
        position: 'relative',
      }}>
        {ICONS[item.icon]}
        {/* Badge on icon when collapsed */}
        {showBadge && collapsed && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            background: '#f59e0b',
            color: '#fff',
            fontSize: T.xs,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            fontFamily: F.sans,
          }}>
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </span>

      {!collapsed && (
        <>
          <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
          {/* Badge on label row when expanded */}
          {showBadge && (
            <span style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: '#f59e0b',
              color: '#fff',
              fontSize: T.xs,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
              fontFamily: F.sans,
              flexShrink: 0,
            }}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ active, activeMode, onModeSwitch, user, onSignOut, pendingCount = 0 }) {
  const navigate = useNavigate();
  const setActive = id => navigate('/app/' + id);
  const { isMobile, width: viewportWidth } = useBreakpoint();
  const isPhone = viewportWidth < 768;
  const [collapsedPref, setCollapsedPref] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  // Always icon-rail on mobile — a 220px expanded sidebar would eat most of
  // a phone viewport. The user's manual preference is preserved for when
  // they're back on a wider screen.
  const collapsed = isMobile ? true : collapsedPref;

  const [signOutHovered, setSignOutHovered] = useState(false);
  const [collapseHovered, setCollapseHovered] = useState(false);

  const toggle = () => {
    if (isMobile) return;
    const next = !collapsedPref;
    setCollapsedPref(next);
    try {
      localStorage.setItem('sidebar_collapsed', String(next));
    } catch {
      // ignore
    }
  };

  const groups = navFor(activeMode);
  const width = collapsed ? 52 : 220;

  // Phones get a bottom tab bar instead of a sidebar: an icon rail with a
  // dozen look-alike icons was the only nav, and it ate a fifth of the width.
  if (isPhone) {
    return (
      <MobileTabBar
        active={active} activeMode={activeMode} onModeSwitch={onModeSwitch}
        onNavigate={setActive} onSignOut={onSignOut} pendingCount={pendingCount}
      />
    );
  }

  return (
    <aside style={{
      width,
      minWidth: width,
      height: '100vh',
      position: 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: T.base,
          fontWeight: 700,
          fontFamily: F.sans,
          flexShrink: 0,
        }}>A</div>
        {!collapsed && (
          <span style={{
            fontFamily: F.sans,
            fontWeight: 700,
            fontSize: T.md,
            letterSpacing: '0.05em',
            color: C.text,
            whiteSpace: 'nowrap',
          }}>ADGRID</span>
        )}
      </div>

      {/* Nav content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '8px 6px' : '8px 8px' }}>
        {/* Mode switcher */}
        <ModeSwitcher activeMode={activeMode} onSwitch={onModeSwitch} collapsed={collapsed} />

        {groups.map((g, gi) => (
          <div key={g.group ?? 'top'} role="group" aria-label={g.group ?? 'Home'}>
            {gi > 0 && (collapsed
              ? <div style={{ height: 1, background: C.border, margin: '10px 4px' }} />
              : <div style={{
                  padding: '14px 12px 6px', fontSize: T.xs, fontWeight: 600, fontFamily: F.sans,
                  color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{g.group}</div>)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.items.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={active}
                  collapsed={collapsed}
                  pendingCount={pendingCount}
                  onClick={setActive}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: collapsed ? '8px 6px' : '8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flexShrink: 0,
      }}>
        {/* Account / sign-out row */}
        {!collapsed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            marginTop: 2,
          }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: T.xs,
              fontWeight: 600,
              fontFamily: F.sans,
              flexShrink: 0,
            }}>
              {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.sans, fontSize: T.sm, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontFamily: F.sans, fontSize: T.xs, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </div>
            </div>
            <button
              title="Sign out"
              onClick={onSignOut}
              onMouseEnter={() => setSignOutHovered(true)}
              onMouseLeave={() => setSignOutHovered(false)}
              style={{
                background: signOutHovered ? 'rgba(239,68,68,0.1)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '4px 6px',
                cursor: 'pointer',
                color: signOutHovered ? C.red : C.textMuted,
                fontFamily: F.sans,
                fontSize: T.xs,
                fontWeight: 500,
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            title="Sign out"
            onClick={onSignOut}
            onMouseEnter={() => setSignOutHovered(true)}
            onMouseLeave={() => setSignOutHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '10px 0',
              background: signOutHovered ? 'rgba(239,68,68,0.1)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: signOutHovered ? C.red : C.textMuted,
              transition: 'all 0.15s',
            }}
          >
            {ICONS.user}
          </button>
        )}

        {/* Legal links */}
        {!collapsed && (
          <div style={{
            display: 'flex', gap: 10, padding: '2px 12px 4px',
            fontSize: T.xs, fontFamily: F.sans, color: C.textMuted,
          }}>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = C.purple}
              onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
            >Terms</a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.textMuted, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = C.purple}
              onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
            >Privacy</a>
          </div>
        )}

        {/* Collapse toggle — hidden on mobile, where the sidebar is always icon-rail */}
        {!isMobile && <button
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggle}
          onMouseEnter={() => setCollapseHovered(true)}
          onMouseLeave={() => setCollapseHovered(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-end',
            width: '100%',
            padding: collapsed ? '10px 0' : '8px 12px',
            background: collapseHovered ? 'rgba(124,58,237,0.06)' : 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: C.textSub,
            transition: 'all 0.15s',
            gap: collapsed ? 0 : 6,
          }}
        >
          {!collapsed && (
            <span style={{ fontFamily: F.sans, fontSize: T.xs, color: C.textMuted }}>Collapse</span>
          )}
          {collapsed ? ICONS.chevronRight : ICONS.chevronLeft}
        </button>}
      </div>
    </aside>
  );
}
