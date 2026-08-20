import { useEffect, useState } from 'react';
import { C } from '../../design/tokens.js';

const THRESHOLD = 400;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 500,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: 'none',
        background: C.grad,
        color: '#fff',
        fontSize: 18,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >↑</button>
  );
}
