import { Link } from 'react-router-dom';

export function Footer({ onLogin, onScrollTo }) {
  return (
    <footer className="mfooter">
      <div className="inner">
        <div className="top">
          <div>
            <div className="logo">AdGrid</div>
            <p className="tagline">The self-serve marketplace for digital out-of-home advertising in Canada.</p>
          </div>
          <div className="cols">
            <div className="col">
              <h5>Platform</h5>
              <button onClick={() => onScrollTo('operators')}>For operators</button>
              <button onClick={() => onScrollTo('advertisers')}>For advertisers</button>
              <button onClick={() => onScrollTo('how')}>How it works</button>
            </div>
            <div className="col">
              <h5>Account</h5>
              <button onClick={onLogin}>Sign in</button>
              <button onClick={() => onScrollTo('waitlist-form')}>Join the waitlist</button>
            </div>
            <div className="col">
              <h5>Legal</h5>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
        </div>
        <div className="base">
          <span>© {new Date().getFullYear()} AdGrid</span>
          <span>Made in Canada</span>
        </div>
      </div>
    </footer>
  );
}
