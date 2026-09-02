import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  // isMobile threshold matches the design system's single breakpoint (901px) so
  // components don't hit a dead zone where they're too narrow for the desktop
  // grid but not yet switched to the stacked mobile layout.
  return { isMobile: width < 901, isTablet: width < 1024, width };
}
