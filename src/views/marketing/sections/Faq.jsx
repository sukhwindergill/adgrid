import { useEffect, useState } from 'react';
import { useReveal } from './useReveal.js';
import { FAQS } from './faqData.js';

function FaqItem({ id, q, a, open, onToggle }) {
  return (
    <div className={`faq-item ${open ? 'on' : ''}`} id={id}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-toggle" aria-hidden="true">+</span>
      </button>
      {open && <div className="faq-a">{a}</div>}
    </div>
  );
}

export function Faq() {
  const [ref, on] = useReveal();
  const [openIdx, setOpenIdx] = useState(0);

  // SiteSearch dispatches this when a FAQ result is clicked, so the
  // matched question expands instead of just scrolling the section into view.
  useEffect(() => {
    const onFaqOpen = e => setOpenIdx(e.detail);
    window.addEventListener('adgrid:faq-open', onFaqOpen);
    return () => window.removeEventListener('adgrid:faq-open', onFaqOpen);
  }, []);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <section className="sec light" id="faq" ref={ref}>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ maxWidth: 760 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="eyebrow">FAQ</div>
          <h2 className="sec-h">Questions, answered</h2>
        </div>
        <div className="faq-list">
          {FAQS.map(([q, a], i) => (
            <FaqItem key={q} id={`faq-${i}`} q={q} a={a} open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
