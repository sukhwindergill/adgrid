import { useEffect, useState } from 'react';

export function Hero({ onScrollTo }) {
  const [liveCount, setLiveCount] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    import('../../../lib/supabase.js').then(({ supabase }) => {
      supabase.from('screens').select('id', { count: 'exact', head: true }).eq('status', 'live')
        .then(({ count }) => { if (count != null) setLiveCount(count); });
    }).catch(() => {});
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="hero">
      <div className={`inner rv ${mounted ? 'on' : ''}`}>
        <div>
          <div className="eyebrow">Canada's OOH marketplace</div>
          <h1 className="hero-h">
            Canada's screens. Canada's brands. <span className="accent">One marketplace.</span>
          </h1>
          <p className="hero-sub">
            The self-serve marketplace where Canadian screen operators sell ad time and
            local advertisers buy it. Real-time pricing, full control on both sides.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button className="btn-p" onClick={() => onScrollTo('waitlist-form')}>List your screens</button>
            <button className="btn-s" onClick={() => onScrollTo('advertisers')}>Book a campaign</button>
          </div>
          <div className="hero-stats">
            {typeof liveCount === 'number' && liveCount >= 1 && (
              <div className="hero-stat">
                <div className="num">{liveCount}</div>
                <div className="lbl">Screens live now</div>
              </div>
            )}
            <div className="hero-stat">
              <div className="num">Toronto &amp; Vancouver</div>
              <div className="lbl">Launch cities</div>
            </div>
            <div className="hero-stat">
              <div className="num">8</div>
              <div className="lbl">Venue categories</div>
            </div>
          </div>
        </div>
        {/* TODO(design): swap for photoreal hero-gym.jpg once Nano Banana generation is available */}
        <div className="creative-ph">Digital ad screen in a gym — creative pending</div>
      </div>
    </section>
  );
}
