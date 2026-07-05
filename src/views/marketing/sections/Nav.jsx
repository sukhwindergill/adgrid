export function Nav({ onScrollTo, onLogin }) {
  return (
    <nav className="mnav">
      <div className="inner">
        <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>AdGrid</div>
        <div className="nav-mid">
          <button className="nl" onClick={() => onScrollTo('operators')}>For operators</button>
          <button className="nl" onClick={() => onScrollTo('advertisers')}>For advertisers</button>
          <button className="nl" onClick={() => onScrollTo('how')}>How it works</button>
        </div>
        <div className="nav-spacer" />
        <button className="nl" onClick={onLogin}>Sign in</button>
        <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>Join the waitlist</button>
      </div>
    </nav>
  );
}
