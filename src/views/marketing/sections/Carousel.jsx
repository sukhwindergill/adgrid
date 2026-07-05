import { useEffect, useRef, useState } from 'react';

const INTERVAL_MS = 4000;

export function Carousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (paused || reducedMotion.current) return;
    const id = setInterval(() => setIndex(i => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const goTo = i => setIndex(((i % slides.length) + slides.length) % slides.length);

  return (
    <div className="gallery-carousel" aria-live="off"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      <div className="gallery-stage">
        {slides.map((slide, i) => (
          <div className={`gallery-slide ${i === index ? 'on' : ''}`} key={slide.src}>
            <img src={slide.src} alt={slide.alt} loading="lazy" width={slide.width} height={slide.height} />
          </div>
        ))}
        <button className="gallery-arrow prev" onClick={() => goTo(index - 1)} aria-label="Previous slide">‹</button>
        <button className="gallery-arrow next" onClick={() => goTo(index + 1)} aria-label="Next slide">›</button>
      </div>
      <div className="gallery-caption-bar">
        <span className="gallery-caption">{slides[index].caption}</span>
        <div className="gallery-dots">
          {slides.map((slide, i) => (
            <button key={slide.src} className={`gallery-dot ${i === index ? 'on' : ''}`}
              onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
