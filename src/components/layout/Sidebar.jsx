import { useState } from 'react';
import { C, F } from '../../design/tokens.js';

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICONS = {
  overview:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  campaigns:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4"/></svg>,
  analytics:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  screens:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  revenue:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 00-5 0c0 5 5 3 5 8a2.5 2.5 0 01-5 0M12 7v1m0 8v1"/></svg>,
  audience:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  approval:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  advertisers:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  signals:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  integrations: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  display:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>,
  billing:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  scans:        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M15 3h4a2 2 0 012 2v4M15 21h4a2 2 0 002-2v-4M9 9h6v6H9z"/></svg>,
  settings:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  notifPrefs:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  user:         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>,
  verify:       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
  chevronLeft:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>,
  chevronRight: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
};

// ─── Nav definitions ──────────────────────────────────────────────────────────

const OP_PRIMARY = [
  { id: 'overview',  label: 'Dashboard',  icon: 'overview' },
  { id: 'campaigns', label: 'Campaigns',  icon: 'campaigns' },
  { id: 'analytics', label: 'Analytics',  icon: 'analytics' },
  { id: 'screens',   label: 'Screens',    icon: 'screens' },
];

const OP_SECONDARY = [
  { id: 'revenue',      label: 'Revenue',         icon: 'revenue' },
  { id: 'audience',     label: 'Audience & Scans', icon: 'audience' },
  { id: 'approval',     label: 'Approval Queue',   icon: 'approval', badge: true },
  { id: 'advertisers',  label: 'Advertisers',      icon: 'advertisers' },
  { id: 'signals',      label: 'Live Signals',     icon: 'signals' },
  { id: 'integrations', label: 'Integrations',     icon: 'integrations' },
  { id: 'display',      label: 'Display Manager',  icon: 'display' },
  { id: 'billing',      label: 'Billing',          icon: 'billing' },
  { id: 'op-settings',  label: 'Settings',         icon: 'settings' },
];

const ADV_PRIMARY = [
  { id: 'adv-overview',  label: 'Dashboard',  icon: 'overview' },
  { id: 'adv-campaigns', label: 'Campaigns',  icon: 'campaigns' },
  { id: 'adv-analytics', label: 'Analytics',  icon: 'analytics' },
];

const ADV_SECONDARY = [
  { id: 'adv-audience',     label: 'Scans & Data',  icon: 'scans' },
  { id: 'adv-billing',      label: 'Billing',        icon: 'billing' },
  { id: 'adv-settings',     label: 'Settings',       icon: 'settings' },
  { id: 'adv-integrations', label: 'Integrations',   icon: 'integrations' },
];

// ─── NavItem ─────────────────────────────────────────────────────────────────

function NavItem({ item, active, collapsed, pendingCount, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isActive = active === item.id;
  const showBadge = item.badge && pendingCount > 0;

  return (
    <button
      title={collapsed ? item.label : undefined}
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
        fontSize: 13,
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
            fontSize: 9,
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
              fontSize: 10,
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

export function Sidebar({ active, setActive, isAdv, user, onSignOut, pendingCount = 0, isPlatformOwner = false, verificationStatus = null }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [signOutHovered, setSignOutHovered] = useState(false);
  const [collapseHovered, setCollapseHovered] = useState(false);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('sidebar_collapsed', String(next));
    } catch {
      // ignore
    }
  };

  const primary   = isAdv ? ADV_PRIMARY   : OP_PRIMARY;
  const baseSecondary = isAdv ? ADV_SECONDARY : OP_SECONDARY;
  const secondary = isAdv ? baseSecondary : [
    ...baseSecondary,
    ...(isPlatformOwner
      ? [
          { id: 'admin',           label: 'Admin Dashboard',       icon: 'verify' },
          { id: 'op-verify-queue', label: 'Operator Verification',  icon: 'approval' },
        ]
      : [
          ...(verificationStatus && verificationStatus !== 'verified'
            ? [{ id: 'op-verify',     label: 'Verify Identity',  icon: 'verify' }]
            : []),
          { id: 'op-onboarding', label: 'Setup guide',    icon: 'overview' },
        ]),
  ];

  const width = collapsed ? 52 : 220;

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
          fontSize: 13,
          fontWeight: 700,
          fontFamily: F.sans,
          flexShrink: 0,
        }}>A</div>
        {!collapsed && (
          <span style={{
            fontFamily: F.sans,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.05em',
            color: C.text,
            whiteSpace: 'nowrap',
          }}>ADGRID</span>
        )}
      </div>

      {/* Nav content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '8px 6px' : '8px 8px' }}>
        {/* Primary nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {primary.map(item => (
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

        {/* Divider */}
        <div style={{
          height: 1,
          background: C.border,
          margin: collapsed ? '10px 4px' : '10px 4px',
        }} />

        {/* Secondary nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {secondary.map(item => (
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

      {/* Bottom section */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: collapsed ? '8px 6px' : '8px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flexShrink: 0,
      }}>
        {/* Notification Prefs */}
        <NavItem
          item={{ id: 'notif-prefs', label: 'Notification Prefs', icon: 'notifPrefs' }}
          active={active}
          collapsed={collapsed}
          pendingCount={0}
          onClick={setActive}
        />

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
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F.sans,
              flexShrink: 0,
            }}>
              {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                fontSize: 11,
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

        {/* Collapse toggle */}
        <button
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
            <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>Collapse</span>
          )}
          {collapsed ? ICONS.chevronRight : ICONS.chevronLeft}
        </button>
      </div>
    </aside>
  );
}
