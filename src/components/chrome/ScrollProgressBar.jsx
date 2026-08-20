import { useEffect, useState } from 'react';
import { C } from '../../design/tokens.js';

function computeProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const pct = (window.scrollY / scrollable) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => setProgress(computeProgress());
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 10001,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <div
        data-testid="scroll-progress-bar"
        style={{
          height: '100%',
          width: `${progress}%`,
          background: C.grad,
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}
