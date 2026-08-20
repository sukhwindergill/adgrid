import { Link } from 'react-router-dom';
import './marketing.css';
import { usePageMeta } from '../../lib/usePageMeta.js';

export function NotFound() {
  usePageMeta({
    title: 'Page Not Found — AdGrid',
    description: "The page you're looking for doesn't exist or has moved.",
  });

  return (
    <div id="main-content" className="mktg" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
      <section className="sec dark" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="inner" style={{ textAlign: 'center', maxWidth: 560 }}>
          <div className="eyebrow">404</div>
          <h1 className="sec-h">Page not found</h1>
          <p className="sec-sub" style={{ margin: '14px auto 32px' }}>
            The page you're looking for doesn't exist or has moved. Let's get you back on track.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" className="btn-p">Back to home</Link>
            <Link to="/#faq" className="btn-s">Read the FAQ</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
