import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { Btn } from '../primitives/Btn.jsx';
import { CopyButton } from '../primitives/CopyButton.jsx';
import { callPairing, isValidPairingCode, normalizePairingCode, PAIRING_CODE_LENGTH } from '../../lib/screenPairing.js';
import { T, C, F, alpha } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { rich, useT } from '../../i18n/useT.js';

// Shared by the onboarding wizard's Setup step (ScreenOnboard.jsx) and the
// screen detail page's Setup Guide tab (ScreenDetail.jsx).
//
// Pairing is the default path: the display opens <origin>/pair (short, no
// secret in it, easy to type with a TV remote), shows a 6-character code,
// and the operator types that code here. The full /display/<token> URL is
// still offered, folded away, for setups that can't run /pair.

export function CopyBox({ label, value }) {
  const { t } = useT();
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: T.xs, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          flex: 1, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 14px', fontFamily: F.mono, fontSize: T.sm,
          color: C.text, wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {value}
        </div>
        <CopyButton value={value} copiedLabel={t('scr.pairing.copied')} style={{ flexShrink: 0, minWidth: 64 }} />
      </div>
    </div>
  );
}

function CodeBox({ label, value }) {
  const { t } = useT();
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: T.xs, fontWeight: 600, color: C.textMid, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <pre style={{
          background: C.text, borderRadius: 8, padding: '14px 16px',
          fontFamily: F.mono, fontSize: T.xs, color: C.terminalText,
          whiteSpace: 'pre', overflowX: 'auto', margin: 0,
        }}>{value}</pre>
        <CopyButton
          value={value}
          label={t('ui.copy')}
          copiedLabel="✓"
          variant="ghost"
          style={{
            position: 'absolute', top: 8, right: 8,
            background: alpha(C.white, 0.1), border: `1px solid ${alpha(C.white, 0.2)}`,
            borderRadius: 4, color: C.white, fontSize: T.xs, padding: '3px 10px',
          }}
        />
      </div>
    </div>
  );
}

const kbd = { background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: T.xs };
const steps = { fontSize: T.base, color: C.textSub, fontFamily: F.sans, lineHeight: 1.8, paddingLeft: 20, margin: '0 0 16px' };

export function PairingCodeEntry({ screen, onPaired }) {
  const { t, tx } = useT();
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
    if (!session) { setErr(t('scr.pairing.sessionExpired')); setState('idle'); return; }
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
      r.status === 429 ? t('scr.pairing.tooMany')
      : r.status === 0 ? t('scr.pairing.unreachable')
      : r.data.error ?? t('scr.pairing.failed'),
    );
  }

  if (state === 'paired') {
    return (
      <div role="status" style={{
        padding: '14px 16px', borderRadius: 10, background: C.greenSoft, border: `1px solid ${C.greenBorder}`,
        fontSize: T.base, color: C.text, fontFamily: F.sans, lineHeight: 1.6,
      }}>
        {tx('scr.pairing.paired', { b: chunk => <strong style={{ color: C.greenText }}>{chunk}</strong>, name: screen.name })}
        <div>
          <Btn variant="unstyled" type="button" onClick={() => { setCode(''); setState('idle'); }} style={{
            marginTop: 6, fontSize: T.sm, color: C.textMuted, fontFamily: F.sans, textDecoration: 'underline',
          }}>{t('scr.pairing.pairAnother')}</Btn>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`pair-code-${screen.id}`} style={{ ...TX.strong, display: 'block', marginBottom: 8 }}>
        {t('scr.pairing.enterCode')}
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
            fontFamily: F.mono, fontSize: T.xl, letterSpacing: '0.15em', color: C.text,
            background: C.surface, outline: 'none', textTransform: 'uppercase',
          }}
        />
        {/* Btn renders a plain <button>, which submits the form by default. */}
        <Btn disabled={!valid || state === 'submitting'} style={{ flex: '0 0 auto' }}>
          {state === 'submitting' ? t('scr.pairing.pairing') : t('scr.pairing.pair')}
        </Btn>
      </div>
      {err && <div role="alert" style={{ ...TX.error, marginTop: 6 }}>{err}</div>}
    </form>
  );
}

// How to get <origin>/pair onto each kind of hardware. Every path ends the
// same way: the screen shows a code, the operator types it into
// PairingCodeEntry.
export function HardwareInstructions({ hardware, screen, onPaired }) {
  const { t, tList } = useT();
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

  const richVars = {
    b: chunk => <strong>{chunk}</strong>,
    code: chunk => <code style={kbd}>{chunk}</code>,
    kbd: chunk => <kbd style={kbd}>{chunk}</kbd>,
    pairUrl: <code style={kbd}>{host}/pair</code>,
  };

  let howToOpen;
  if (hardware === 'Raspberry Pi 5') {
    howToOpen = (
      <>
<ol style={steps}>
          {tList('scr.pairing.pi').map((s, i) => <li key={i}>{rich(s, richVars)}</li>)}
        </ol>
        <CodeBox label={t('scr.pairing.piBox')} value={piSetup} />
        <div style={{ ...TX.helperMuted, lineHeight: 1.6, marginBottom: 16 }}>
          {rich(t('scr.pairing.piWayfire'), richVars)}
        </div>
      </>
    );
  } else if (hardware === 'Mini PC') {
    howToOpen = (
      <>
<ol style={steps}>
          {tList('scr.pairing.miniPc').map((s, i) => <li key={i}>{rich(s, richVars)}</li>)}
        </ol>
        <CodeBox label={t('scr.pairing.miniPcBox')} value={miniPcSetup} />
      </>
    );
  } else if (hardware === 'Android TV') {
    howToOpen = (
<ol style={steps}>
        {tList('scr.pairing.androidTv').map((s, i) => <li key={i}>{rich(s, richVars)}</li>)}
      </ol>
    );
  } else {
    howToOpen = (
<ol style={steps}>
        {tList('scr.pairing.browser').map((s, i) => <li key={i}>{rich(s, richVars)}</li>)}
      </ol>
    );
  }

  return (
    <div>
      <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ ...TX.bodySub, lineHeight: 1.6, marginBottom: 14 }}>
          {rich(t('scr.pairing.intro', { screen: screen.name }), {
            pairHost: <strong style={{ color: C.text, fontFamily: F.mono }}>{host}/pair</strong>,
            name: chunk => <strong style={{ color: C.text }}>{chunk}</strong>,
          })}
        </div>
        <PairingCodeEntry screen={screen} onPaired={onPaired} />
      </div>

      {howToOpen}

      <details style={{ ...TX.bodySub, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <summary style={{ cursor: 'pointer', color: C.textMid, fontWeight: 500 }}>
          {t('scr.pairing.advanced')}
        </summary>
        <div style={{ marginTop: 12, lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 12px' }}>
            {t('scr.pairing.advancedBody')}
          </p>
          {screen.screen_token
            ? <CopyBox label={t('scr.pairing.playerUrl')} value={playerUrl} />
            : <div style={{ color: C.textMuted }}>{t('common.loading')}</div>}
        </div>
      </details>
    </div>
  );
}
