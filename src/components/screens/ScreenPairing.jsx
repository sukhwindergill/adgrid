import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { Btn } from '../primitives/Btn.jsx';
import { CopyButton } from '../primitives/CopyButton.jsx';
import { callPairing, isValidPairingCode, normalizePairingCode, PAIRING_CODE_LENGTH } from '../../lib/screenPairing.js';

// Shared by the onboarding wizard's Setup step (ScreenOnboard.jsx) and the
// screen detail page's Setup Guide tab (ScreenDetail.jsx).
//
// Pairing is the default path: the display opens <origin>/pair (short, no
// secret in it, easy to type with a TV remote), shows a 6-character code,
// and the operator types that code here. The full /display/<token> URL is
// still offered, folded away, for setups that can't run /pair.

export function CopyBox({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: 12,
          color: C.text, wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {value}
        </div>
        <CopyButton value={value} copiedLabel="✓ Copied" style={{ flexShrink: 0, minWidth: 64 }} />
      </div>
    </div>
  );
}

function CodeBox({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: '#0a0a0a', borderRadius: 8, padding: '14px 16px',
          fontFamily: F.mono, fontSize: 11, color: '#a3e635',
          whiteSpace: 'pre', overflowX: 'auto', margin: 0,
        }}>{value}</pre>
        <CopyButton
          value={value}
          label="Copy"
          copiedLabel="✓"
          variant="ghost"
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 10px',
          }}
        />
      </div>
    </div>
  );
}

const kbd = { background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 };
const steps = { fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.8, paddingLeft: 20, margin: '0 0 16px' };

export function PairingCodeEntry({ screen, onPaired }) {
  const [code, setCode] = useState('');
  const [state, setState] = useState('idle'); // 'idle' | 'submitting' | 'paired'
  const [err, setErr] = useState(null);

  const normalized = normalizePairingCode(code);
  const valid = isValidPairingCode(normalized);

  async function submit(e) {
    e?.preventDefault();
    if (!valid || state === 'submitting') return;
    setState('submitting');
    setErr(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setErr('Your session expired. Sign in again.'); setState('idle'); return; }
    const r = await callPairing(
      { action: 'claim', code: normalized, screen_id: screen.id },
      { functionsUrl: SUPABASE_FUNCTIONS_URL, accessToken: session.access_token },
    );
    if (r.ok) {
      setState('paired');
      onPaired?.(r.data);
      return;
    }
    setState('idle');
    setErr(
      r.status === 429 ? 'Too many attempts. Wait a few minutes and try again.'
      : r.status === 0 ? "Couldn't reach AdGrid. Check your connection and try again."
      : r.data.error ?? 'Pairing failed. Try again.',
    );
  }

  if (state === 'paired') {
    return (
      <div role="status" style={{
        padding: '14px 16px', borderRadius: 10, background: C.greenSoft, border: `1px solid ${C.greenBorder}`,
        fontSize: 13, color: C.text, fontFamily: F.sans, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.green }}>Paired.</strong> {screen.name} will switch from the code to your ads
        within a few seconds. If it doesn't, check the screen is still on the pairing page.
        <div>
          <button type="button" onClick={() => { setCode(''); setState('idle'); }} style={{
            background: 'none', border: 'none', padding: 0, marginTop: 6, fontSize: 12,
            color: C.textMuted, cursor: 'pointer', fontFamily: F.sans, textDecoration: 'underline',
          }}>Pair another display to this screen</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`pair-code-${screen.id}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 8 }}>
        Enter pairing code
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          id={`pair-code-${screen.id}`}
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setErr(null); }}
          placeholder="ABC 234"
          maxLength={PAIRING_CODE_LENGTH + 2}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-invalid={!!err}
          style={{
            flex: '1 1 160px', minWidth: 0, padding: '10px 14px',
            border: `1px solid ${err ? C.red : C.border}`, borderRadius: 8,
            fontFamily: F.mono, fontSize: 20, letterSpacing: '0.15em', color: C.text,
            background: C.surface, outline: 'none', textTransform: 'uppercase',
          }}
        />
        {/* Btn renders a plain <button>, which submits the form by default. */}
        <Btn disabled={!valid || state === 'submitting'} style={{ flex: '0 0 auto' }}>
          {state === 'submitting' ? 'Pairing…' : 'Pair screen'}
        </Btn>
      </div>
      {err && <div role="alert" style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 6 }}>{err}</div>}
    </form>
  );
}

// How to get <origin>/pair onto each kind of hardware. Every path ends the
// same way: the screen shows a code, the operator types it into
// PairingCodeEntry.
export function HardwareInstructions({ hardware, screen, onPaired }) {
  const origin = window.location.origin;
  const pairUrl = `${origin}/pair`;
  const host = window.location.host;
  const playerUrl = `${origin}/display/${screen.screen_token}`;
  const kioskFlags = '--kiosk --noerrdialogs --disable-infobars --no-first-run --password-store=basic';

  // Raspberry Pi OS Bookworm: Wayland with the labwc compositor (default
  // since late 2024), Chromium package/binary is `chromium`. The old
  // /etc/xdg/lxsession/LXDE-pi/autostart + xset approach does nothing
  // there. The loop restarts Chromium if it ever crashes or is closed.
  const piSetup = `sudo apt install -y chromium
sudo raspi-config nonint do_blanking 1   # never blank the screen
mkdir -p ~/.config/labwc
cat >> ~/.config/labwc/autostart <<'EOF'
# AdGrid display (restarts Chromium if it exits)
while true; do
  chromium ${kioskFlags} --ozone-platform=wayland ${pairUrl}
  sleep 5
done &
EOF
sudo reboot`;

  const miniPcSetup = `mkdir -p ~/.config/autostart
cat > ~/.config/autostart/adgrid-display.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=AdGrid Display
Exec=chromium ${kioskFlags} ${pairUrl}
X-GNOME-Autostart-enabled=true
EOF`;

  let howToOpen;
  if (hardware === 'Raspberry Pi 5') {
    howToOpen = (
      <>
        <ol style={steps}>
          <li>On the Pi (Raspberry Pi OS Bookworm, desktop version), open <strong>Terminal</strong>.</li>
          <li>Paste the commands below and press Enter. The Pi reboots straight into the pairing page.</li>
          <li>Type the code it shows into the box above.</li>
        </ol>
        <CodeBox label="Paste into the Pi's terminal" value={piSetup} />
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, lineHeight: 1.6, marginBottom: 16 }}>
          Older Bookworm installs that still use Wayfire: switch to labwc first with{' '}
          <code style={kbd}>sudo raspi-config</code> → Advanced Options → Wayland → labwc, then run the commands.
        </div>
      </>
    );
  } else if (hardware === 'Mini PC') {
    howToOpen = (
      <>
        <ol style={steps}>
          <li>Install Chromium (Ubuntu: <code style={kbd}>sudo snap install chromium</code>, Debian: <code style={kbd}>sudo apt install chromium</code>). Google Chrome works too — use <code style={kbd}>google-chrome</code> in the command below.</li>
          <li>Turn off screen blanking and sleep in your desktop's <strong>Settings → Power</strong>.</li>
          <li>Paste the commands below into a terminal so the display opens on every login, then log out and back in (or reboot).</li>
          <li>Type the code it shows into the box above.</li>
        </ol>
        <CodeBox label="Open the pairing page on login" value={miniPcSetup} />
      </>
    );
  } else if (hardware === 'Android TV') {
    howToOpen = (
      <ol style={steps}>
        <li>Install <strong>Fully Kiosk Browser</strong> from the Google Play Store on the TV.</li>
        <li>Open it, go to Settings → Web Content → Start URL, and enter <code style={kbd}>{host}/pair</code>.</li>
        <li>Enable Settings → Other → Kiosk Mode and "Start on boot" so it opens on every power-up.</li>
        <li>Type the code it shows into the box above.</li>
      </ol>
    );
  } else {
    howToOpen = (
      <ol style={steps}>
        <li>On the screen, open its web browser (Chrome, Edge or the TV's built-in browser).</li>
        <li>Go to <code style={kbd}>{host}/pair</code>. A 6-character code appears.</li>
        <li>Type the code into the box above.</li>
        <li>Make the browser fullscreen (<kbd style={kbd}>F11</kbd> on a computer). Ads start automatically when campaigns run.</li>
      </ol>
    );
  }

  return (
    <div>
      <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, marginBottom: 14 }}>
          On the screen, open <strong style={{ color: C.text, fontFamily: F.mono }}>{host}/pair</strong>. It shows a
          short code — type it here to connect the screen to <strong style={{ color: C.text }}>{screen.name}</strong>.
        </div>
        <PairingCodeEntry screen={screen} onPaired={onPaired} />
      </div>

      {howToOpen}

      <details style={{ fontFamily: F.sans, fontSize: 13, color: C.textSub, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <summary style={{ cursor: 'pointer', color: C.textMid, fontWeight: 500 }}>
          Advanced: use the full player URL instead
        </summary>
        <div style={{ marginTop: 12, lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 12px' }}>
            For provisioning tools or devices that can't run the pairing page, point the browser straight
            at this URL — no code needed. It contains your screen token, so treat it like a password.
          </p>
          {screen.screen_token
            ? <CopyBox label="Player URL" value={playerUrl} />
            : <div style={{ color: C.textMuted }}>Loading…</div>}
        </div>
      </details>
    </div>
  );
}
