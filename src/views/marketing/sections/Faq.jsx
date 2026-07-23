import { useState } from 'react';
import { useReveal } from './useReveal.js';

const FAQS = [
  ['Which cities is AdGrid available in?',
    "We're launching in Toronto and Vancouver, with more Canadian cities planned as we onboard operators. Join the waitlist below if you're elsewhere — we'll reach out as we expand."],
  ['What screens qualify as an AdGrid display?',
    'Any landscape digital screen with an internet connection — a commercial display, a spare TV, or existing digital signage. Connect it in minutes with our lightweight display player; no proprietary hardware to buy.'],
  ['How much does AdGrid take, and how do payouts work?',
    'AdGrid takes a 12% platform fee; you keep 40% of net ad spend on every screen you list. Payouts are automatic via Stripe Connect on a schedule shown in your dashboard — no invoicing, no chasing payment.'],
  ['Do I have to sign a contract or pay anything upfront?',
    'No. Listing your screens is free with no long-term contract — pause or remove your inventory anytime.'],
  ['What control do I have over what plays on my screen?',
    "Full control. Approve or reject every ad before it airs, block entire categories or specific competitors, and set blackout hours when you don't want any ads running at all."],
  ['Is there a minimum ad spend for advertisers?',
    'No minimums and no long-term contracts. You see the exact price per slot before you book, and you pay only for time that actually plays.'],
  ['How do I know my campaign actually ran?',
    'Every campaign includes playback logs proving when and where your ad ran, plus a unique QR code so you can track scans by screen and by hour.'],
  ['What happens if I cancel a campaign?',
    'Cancel before any impressions are served and you get a full refund within 5–10 business days. Once impressions start, charges are final.'],
];

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
