import { useEffect, useState } from 'react';
import { C, T, SH } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';

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
    <Btn
      variant="unstyled"
      type="button"
      className="scroll-top-btn"
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
        background: C.gradAction,
        color: C.white,
        fontSize: T.lg,
        boxShadow: SH.pop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >↑</Btn>
  );
}
