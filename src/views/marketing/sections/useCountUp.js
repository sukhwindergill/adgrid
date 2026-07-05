import { useEffect, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Animates a numeric value from 0 -> target while `active` is true.
export function useCountUp(target, active, duration = 800) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active || prefersReducedMotion()) return;

    let frameId;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(target * eased);
      if (t < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, target, duration]);

  if (!active) return 0;
  if (prefersReducedMotion()) return target;
  return display;
}
