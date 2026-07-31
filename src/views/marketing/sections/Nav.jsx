import { useState } from 'react';

export function Nav({ onScrollTo, onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = id => { setMenuOpen(false); onScrollTo(id); };

  return (
    <nav className="mnav">
      <div className="inner">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AdGrid</div>
        <div className="nav-mid">
          <button className="nl" onClick={() => go('operators')}>For operators</button>
          <button className="nl" onClick={() => go('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => go('how')}>How it works</button>
          <button className="nl" onClick={() => go('faq')}>FAQ</button>
        </div>
        <div className="nav-spacer" />
        <button className="nl nav-desktop-only" onClick={onLogin}>Sign in</button>
        <button className="btn-p nav-desktop-only" onClick={() => go('waitlist-form')}>Join the waitlist</button>
        {/* Hamburger — mobile only */}
        <button
          className="nav-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span /><span />
        </button>
      </div>
      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-menu">
          <button className="nl" onClick={() => go('operators')}>For operators</button>
          <button className="nl" onClick={() => go('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => go('how')}>How it works</button>
          <hr className="nav-divider" />
          <button className="nl" onClick={() => { setMenuOpen(false); onLogin(); }}>Sign in</button>
          <button className="btn-p" style={{ margin: '8px 12px 12px' }} onClick={() => go('waitlist-form')}>Join the waitlist</button>
        </div>
      )}
    </nav>
  );
}
