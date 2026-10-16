import { useEffect, useState } from 'react';
import {
  PAIR_POLL_INTERVAL_MS,
  callPairing,
  formatCountdown,
  formatPairingCode,
  loadPairedToken,
  loadPendingPairing,
  savePairedToken,
  savePendingPairing,
} from '../../lib/screenPairing.js';
import { useT } from '../../i18n/useT.js';
import { T, C, D, F, alpha } from '../../design/tokens.js';

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;


// Module-level so the default prop is referentially stable -- an inline
// arrow would re-run the pairing effect on every countdown tick.
const replaceLocation = (url) => window.location.replace(url);

function storage() {
  try { return window.localStorage; } catch { return null; }
}

// Read once on mount: a device that already paired goes straight to its
// player; one mid-pairing keeps showing the code the operator may be typing.
function initialState() {
  const store = storage();
  if (new URLSearchParams(window.location.search).has('reset')) {
    savePairedToken(store, null);
    savePendingPairing(store, null);
  }
  const pairedToken = loadPairedToken(store);
  if (pairedToken) return { pairedToken, pairing: null, phase: 'paired' };
  const pairing = loadPendingPairing(store);
  return { pairedToken: null, pairing, phase: pairing ? 'code' : 'loading' };
}

// /pair — opened on the display itself (TV browser, kiosk, Fully Kiosk on
// Android TV). Unattended and usually remote-only, so: no input, no clicks,
// recovers from every failure by itself. Shows a short code, the operator
// enters it in the dashboard, and this page swaps itself for the player.
//
// ?reset=1 forgets a previously paired screen (re-pair a device).
export function PairScreen({ navigate = replaceLocation, pollIntervalMs = PAIR_POLL_INTERVAL_MS }) {
  const { t, tx } = useT();
  const [initial] = useState(initialState);
  const [pairing, setPairing] = useState(initial.pairing);
  const [phase, setPhase] = useState(initial.phase); // 'loading' | 'code' | 'paired' | 'offline'
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (initial.pairedToken) {
      navigate(`/display/${initial.pairedToken}`);
      return undefined;
    }
    const store = storage();

    let cancelled = false;
    // Per-effect, not a ref: a StrictMode remount must not inherit the
    // torn-down effect's in-flight flag.
    let busy = false;
    let current = initial.pairing;

    const opts = { functionsUrl: SUPABASE_FUNCTIONS_URL, accessToken: ANON_KEY };

    async function requestCode() {
      const r = await callPairing({ action: 'create' }, opts);
      if (cancelled) return;
      if (r.ok && r.data.code) {
        current = { code: r.data.code, device_secret: r.data.device_secret, expires_at: r.data.expires_at };
        savePendingPairing(store, current);
        setPairing(current);
        setPhase('code');
      } else {
        setPhase(p => (p === 'code' ? p : 'offline'));
      }
    }

    async function tick() {
      if (busy || cancelled) return;
      busy = true;
      try {
        if (!current || new Date(current.expires_at) <= new Date()) {
          current = null;
          await requestCode();
          return;
        }
        const r = await callPairing({ action: 'poll', code: current.code, device_secret: current.device_secret }, opts);
        if (cancelled) return;
        if (r.ok && r.data.status === 'claimed' && r.data.screen_token) {
          savePairedToken(store, r.data.screen_token);
          savePendingPairing(store, null);
          setPhase('paired');
          cancelled = true;
          navigate(`/display/${r.data.screen_token}`);
        } else if ((r.ok && r.data.status === 'expired') || r.status === 404) {
          // Expired, or the server no longer knows this code (swept, or
          // the stored secret is stale) -- get a fresh one.
          current = null;
          savePendingPairing(store, null);
          await requestCode();
        }
        // Anything else (pending, 429, network blip): just poll again.
      } finally {
        busy = false;
      }
    }

    tick();
    const poll = setInterval(tick, pollIntervalMs);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { cancelled = true; clearInterval(poll); clearInterval(clock); };
  }, [initial, navigate, pollIntervalMs]);

  const host = window.location.host;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: C.screen, color: C.white, fontFamily: F.sans,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '5vh 5vw', textAlign: 'center', cursor: 'none',
    }}>
      <div style={{ fontSize: 'clamp(14px, 1.6vw, 22px)', letterSpacing: '0.3em', color: alpha(C.white, 0.45), fontWeight: 600, marginBottom: '4vh' }}>
        ADGRID
      </div>

      {phase === 'code' && pairing && (
        <>
          <div style={{ fontSize: 'clamp(18px, 2.4vw, 34px)', color: alpha(C.white, 0.75), marginBottom: '3vh' }}>
            {t('display.pair.instruction')}
          </div>
          <div
            data-testid="pair-code"
            aria-label={t('display.pair.codeLabel', { code: pairing.code.split('').join(' ') })}
            style={{
              fontFamily: "'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace",
              fontSize: 'clamp(64px, 13vw, 220px)', fontWeight: 700, letterSpacing: '0.12em',
              lineHeight: 1, padding: '3vh 4vw', borderRadius: 24,
              background: alpha(C.white, 0.06), border: `2px solid ${alpha(C.white, 0.12)}`,
              whiteSpace: 'nowrap',
            }}
          >
            {formatPairingCode(pairing.code)}
          </div>
          <div style={{ fontSize: 'clamp(14px, 1.6vw, 24px)', color: alpha(C.white, 0.55), marginTop: '4vh', lineHeight: 1.6, maxWidth: 1100 }}>
            {tx('display.pair.howTo', { b: chunk => <strong style={{ color: C.white }}>{chunk}</strong>, host })}
          </div>
          <div style={{ fontSize: 'clamp(12px, 1.2vw, 18px)', color: D.textFaint, marginTop: '2vh' }}>
            {t('display.pair.newCodeIn', { time: formatCountdown(pairing.expires_at, now) })}
          </div>
        </>
      )}

      {phase === 'loading' && (
        <div style={{ fontSize: T.md, color: D.textFaint, letterSpacing: 2, textTransform: 'uppercase' }}>{t('display.pair.gettingCode')}</div>
      )}

      {phase === 'offline' && (
        <div style={{ fontSize: 'clamp(16px, 2vw, 28px)', color: alpha(C.white, 0.6), lineHeight: 1.6 }}>
          {t('display.pair.offline')}<br />
          <span style={{ color: D.textFaint, fontSize: '0.8em' }}>{t('display.pair.offlineHint')}</span>
        </div>
      )}

      {phase === 'paired' && (
        <div style={{ fontSize: 'clamp(18px, 2.4vw, 34px)', color: D.success }}>{t('display.pair.paired')}</div>
      )}
    </div>
  );
}
