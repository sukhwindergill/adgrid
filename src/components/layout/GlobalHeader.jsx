import { useState } from 'react';
import { C, F, glass, T, alpha } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import NotificationBell from '../NotificationBell.jsx';
import { AccountSwitcher } from './AccountSwitcher.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { MenuPanel, MenuItem, MenuBackdrop } from '../primitives/Menu.jsx';
import { SwitchTrack } from '../primitives/Switch.jsx';
import { useT } from '../../i18n/useT.js';

export function GlobalHeader({ user, onSignOut, demoMode = false, onToggleDemoMode, onOpenSearch }) {
  const { t, locale, setLocale } = useT();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
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
      borderBottom: `1px solid ${alpha(C.black, 0.07)}`,
      gap: 12,
    }}>
      {onOpenSearch && (
        <Btn
          variant="unstyled"
          onClick={onOpenSearch}
          aria-label={t('shell.search')}
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
          style={{
            marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', minWidth: 0, borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.textMuted,
            fontFamily: F.sans, fontSize: T.base,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <span>{t('shell.search')}</span>
          <kbd style={{ fontFamily: F.sans, fontSize: T.xs, padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface }}>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </Btn>
      )}
      <AccountSwitcher />
      <NotificationBell />

      {/* Avatar + dropdown */}
      <div style={{ position: 'relative' }}>
        <Btn
          variant="unstyled"
          aria-label={t('shell.accountMenu')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: C.gradStrong,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.white,
            fontSize: T.sm,
            fontWeight: 600,
            fontFamily: F.sans,
            userSelect: 'none',
          }}
        >{initials}</Btn>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <MenuBackdrop onClose={() => setMenuOpen(false)} />
            <MenuPanel role="menu" style={{ right: 0, top: 42, width: 220, padding: '8px 0' }}>
              {/* User info */}
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                <div style={TX.strong}>
                  {user?.name || t('shell.user')}
                </div>
                <div style={{ ...TX.caption, marginTop: 2 }}>
                  {user?.email}
                </div>
              </div>

              {/* Demo mode toggle — shows seeded fake screens (spread across
                  several countries/cities) so the product can be demoed
                  before real operators have onboarded. Off by default. */}
              {onToggleDemoMode && (
                <MenuItem
                  role="menuitemcheckbox"
                  aria-checked={demoMode}
                  onClick={() => onToggleDemoMode()}
                  style={{ justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}
                >
                  <span>{t('shell.demoMode')}</span>
                  <SwitchTrack on={demoMode} size="sm" />
                </MenuItem>
              )}

              {/* Language: names the other language, in that language. */}
              <MenuItem
                role="menuitem"
                lang={locale === 'fr-CA' ? 'en' : 'fr'}
                onClick={() => { setLocale(locale === 'fr-CA' ? 'en' : 'fr-CA'); setMenuOpen(false); }}
                style={{ borderBottom: `1px solid ${C.border}` }}
              >
                {t('common.language.other')}
              </MenuItem>

              {/* Sign out */}
              <MenuItem role="menuitem" tone="danger" onClick={() => { onSignOut(); setMenuOpen(false); }}>
                {t('shell.signOut')}
              </MenuItem>
            </MenuPanel>
          </>
        )}
      </div>
    </header>
  );
}
