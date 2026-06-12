import { useEffect, useState, useRef } from 'react';
import QRCode from 'react-qr-code';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';

const POLL_INTERVAL_MS  = 30_000;
const ROTATE_INTERVAL_MS = 10_000;

function buildQrUrl(destinationUrl, screenId, campaignId) {
  try {
    const u = new URL(destinationUrl);
    u.searchParams.set('utm_source', 'adgrid');
    u.searchParams.set('utm_medium', 'dooh');
    u.searchParams.set('ag_screen', screenId ?? '');
    u.searchParams.set('ag_campaign', campaignId ?? '');
    u.searchParams.set('s', screenId ?? '');
    return u.toString();
  } catch {
    return destinationUrl;
  }
}

function CreativeSlide({ campaign, screenId }) {
  const bg = campaign.accent_color || '#7c3aed';
  const qrUrl = buildQrUrl(campaign.destination_url || 'https://adgrid.io', screenId, campaign.id);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(160deg, #050a10 0%, #0d1520 60%, ${bg}22 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'flex-start', justifyContent: 'flex-end',
      padding: 'clamp(32px, 5vw, 80px)',
      overflow: 'hidden',
    }}>
      {/* Background accent glow */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: '50%', height: '60%',
        background: `radial-gradient(ellipse, ${bg}33 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Bottom accent line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: bg }} />

      {/* AdGrid watermark */}
      <div style={{
        position: 'absolute', top: 'clamp(20px, 3vw, 48px)', left: 'clamp(20px, 3vw, 48px)',
        fontSize: 'clamp(10px, 1.2vw, 16px)', fontWeight: 700, letterSpacing: '3px',
        color: 'rgba(255,255,255,0.2)', fontFamily: "'Inter', sans-serif", textTransform: 'uppercase',
      }}>
        ADGRID
      </div>

      {/* QR code — top right */}
      <div style={{
        position: 'absolute', top: 'clamp(20px, 3vw, 48px)', right: 'clamp(20px, 3vw, 48px)',
        background: '#fff', borderRadius: 12, padding: 'clamp(8px, 1.2vw, 16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <QRCode value={qrUrl} size={Math.max(64, Math.floor(window.innerWidth * 0.12))} level="M" />
        <div style={{
          fontSize: 'clamp(8px, 0.8vw, 12px)', color: '#555', textAlign: 'center',
          marginTop: 6, fontFamily: "'Inter', sans-serif", fontWeight: 500,
        }}>Scan to learn more</div>
      </div>

      {/* Category tag */}
      {campaign.category && (
        <div style={{
          fontSize: 'clamp(10px, 1vw, 14px)', letterSpacing: '3px', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif", marginBottom: 'clamp(12px, 2vw, 24px)',
        }}>
          {campaign.category}
        </div>
      )}

      {/* Headline */}
      <div style={{
        fontSize: 'clamp(32px, 6vw, 96px)', fontWeight: 800, color: '#fff',
        lineHeight: 1.05, maxWidth: '70%', marginBottom: 'clamp(16px, 2.5vw, 40px)',
        fontFamily: 'Georgia, serif', textShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
        {campaign.headline || campaign.advertiser_name}
      </div>

      {/* CTA button */}
      {campaign.cta && (
        <div style={{
          display: 'inline-block',
          padding: 'clamp(8px, 1.2vw, 18px) clamp(20px, 3vw, 48px)',
          border: `2px solid ${bg}`,
          color: bg, fontSize: 'clamp(12px, 1.4vw, 22px)',
          fontWeight: 600, borderRadius: 4,
          fontFamily: "'Inter', sans-serif", letterSpacing: '1px',
        }}>
          {campaign.cta}
        </div>
      )}
    </div>
  );
}

function IdleSlide() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(160deg, #050a10 0%, #0d1a2e 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 'clamp(24px, 5vw, 64px)', fontWeight: 800, letterSpacing: '8px',
        color: 'rgba(255,255,255,0.08)', fontFamily: "'Inter', sans-serif",
        textTransform: 'uppercase', marginBottom: 24,
      }}>
        ADGRID
      </div>
      <div style={{
        fontSize: 'clamp(12px, 1.5vw, 18px)', color: 'rgba(255,255,255,0.2)',
        fontFamily: "'Inter', sans-serif",
      }}>
        No active campaigns scheduled
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(124,58,237,0.3)' }} />
    </div>
  );
}

export function DisplayPlayer({ screenToken }) {
  const [campaigns, setCampaigns]   = useState([]);
  const [screenId, setScreenId]     = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentIdxRef = useRef(0);
  const [fadeIn, setFadeIn]         = useState(true);
  const [status, setStatus]         = useState('loading'); // 'loading' | 'ok' | 'error'
  const [errMsg, setErrMsg]         = useState('');
  const rotateRef = useRef(null);

  const fetchFeed = async () => {
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/display-feed?token=${screenToken}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrMsg(body.error ?? `HTTP ${res.status}`);
        setStatus('error');
        return;
      }
      const data = await res.json();
      setScreenId(data.screen_id);
      setCampaigns(data.campaigns ?? []);
      setStatus('ok');
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  };

  // Initial fetch + poll every 30s
  useEffect(() => {
    fetchFeed();
    const poll = setInterval(fetchFeed, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [screenToken]);

  // Heartbeat — fire every 30s to keep last_seen updated on the screen record
  useEffect(() => {
    if (!screenToken) return;
    const sendHeartbeat = () => {
      fetch(`${SUPABASE_FUNCTIONS_URL}/ingest-impressions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screen_token: screenToken, heartbeat_only: true }),
      }).catch(e => console.error('Heartbeat error:', e));
    };
    sendHeartbeat(); // immediate on mount
    const hb = setInterval(sendHeartbeat, POLL_INTERVAL_MS);
    return () => clearInterval(hb);
  }, [screenToken]);

  // Impression tracking — fire every rotation interval when a campaign is live
  useEffect(() => {
    if (!screenId || campaigns.length === 0) return;
    const iv = setInterval(() => {
      fetch(`${SUPABASE_FUNCTIONS_URL}/ingest-impressions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screen_token: screenToken,
          campaign_id: campaigns[currentIdxRef.current]?.id ?? null,
          people_count: 1,
          dwell_seconds: ROTATE_INTERVAL_MS / 1000,
          attention_score: 1.0,
        }),
      }).catch(e => console.error('Impression ingest error:', e));
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [screenId, campaigns.length, screenToken]);

  // Rotate campaigns
  useEffect(() => {
    if (campaigns.length < 2) return;
    rotateRef.current = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIdx(i => {
          const next = (i + 1) % campaigns.length;
          currentIdxRef.current = next;
          return next;
        });
        setFadeIn(true);
      }, 400);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(rotateRef.current);
  }, [campaigns.length]);

  // Reset index when campaigns list changes
  useEffect(() => { setCurrentIdx(0); setFadeIn(true); }, [campaigns]);

  if (status === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050a10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontFamily: "'Inter', sans-serif", letterSpacing: 2 }}>
          CONNECTING…
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050a10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 14, color: 'rgba(255,100,100,0.7)', fontFamily: "'Inter', sans-serif" }}>
          Display Error
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'Inter', sans-serif", maxWidth: 400, textAlign: 'center' }}>
          {errMsg}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', marginTop: 8 }}>
          Token: {screenToken?.slice(0, 8)}…
        </div>
      </div>
    );
  }

  const current = campaigns[currentIdx];

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#050a10', cursor: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0,
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}>
        {current ? (
          <CreativeSlide campaign={current} screenId={screenId} />
        ) : (
          <IdleSlide />
        )}
      </div>

      {/* Campaign indicator dots */}
      {campaigns.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 'clamp(36px, 4vw, 52px)', left: '50%',
          transform: 'translateX(-50%)', display: 'flex', gap: 8,
        }}>
          {campaigns.map((_, i) => (
            <div key={i} style={{
              width: i === currentIdx ? 24 : 6, height: 6, borderRadius: 3,
              background: i === currentIdx ? '#fff' : 'rgba(255,255,255,0.25)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      )}

      {/* GDPR privacy notice */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '6px 20px',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        backdropFilter: 'blur(4px)',
      }}>
        <span style={{ fontSize: 'clamp(9px, 0.9vw, 12px)', color: 'rgba(255,255,255,0.35)', fontFamily: "'Inter', sans-serif" }}>
          {/* TODO(legal): sign off on notice wording. Must stay accurate to actual
              data collection — no cameras/computer vision on screens today. */}
          This screen does not use cameras or collect viewer data. Scanning an ad's QR code records the scan.
        </span>
        <a href="/privacy" style={{ fontSize: 'clamp(9px, 0.9vw, 12px)', color: 'rgba(255,255,255,0.25)', fontFamily: "'Inter', sans-serif", textDecoration: 'underline' }}>
          Privacy Policy ↗
        </a>
      </div>
    </div>
  );
}
