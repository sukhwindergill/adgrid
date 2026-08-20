import { useState } from 'react';
import { useReveal } from './useReveal.js';
import { FAQS } from './faqData.js';

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className={`faq-item ${open ? 'on' : ''}`}>
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
  return (
    <section className="sec light" id="faq" ref={ref}>
      <div className={`inner rv ${on ? 'on' : ''}`} style={{ maxWidth: 760 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="eyebrow">FAQ</div>
          <h2 className="sec-h">Questions, answered</h2>
        </div>
        <div className="faq-list">
          {FAQS.map(([q, a], i) => (
            <FaqItem key={q} q={q} a={a} open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}
