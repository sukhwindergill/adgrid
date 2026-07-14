import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { ErrorBanner } from '../../components/primitives/ErrorBanner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { VENUE_TAXONOMY, COUNTRIES, STATE_LABEL, SCREEN_POSITION_OPTIONS, STATE_TIMEZONE } from '../../lib/venueTypes.js';

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function WizardProgress({ step, total, onCancel }) {
  const pct = ((step - 1) / (total - 1)) * 100;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans }}>
          Step {step} of {total}
        </div>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer', fontFamily: F.sans }}
        >
          Cancel
        </button>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: C.purple, borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {['Welcome', 'Register', 'Setup', 'Connect'].map((label, i) => (
          <div key={label} style={{
            fontSize: 11, fontFamily: F.sans,
            color: i + 1 <= step ? C.purple : C.textMuted,
            fontWeight: i + 1 === step ? 600 : 400,
          }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>📺</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, fontFamily: F.sans, marginBottom: 12, margin: '0 0 12px' }}>
          Let's get your screen on the network
        </h1>
        <p style={{ fontSize: 15, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, margin: '0 0 32px' }}>
          ADGRID connects your display to advertisers who pay to reach your audience. Setup takes about 5 minutes.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
          {[
            { icon: '📺', text: 'Works on any display — TV, monitor, or commercial screen' },
            { icon: '⚡', text: '5 minutes to set up' },
            { icon: '💰', text: 'Start earning from day one' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              padding: '16px 12px', background: C.surfaceAlt, borderRadius: 10,
              fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
              {text}
            </div>
          ))}
        </div>

        <Btn onClick={onNext} style={{ width: '100%', fontSize: 16, padding: '14px 24px' }}>
          Get Started →
        </Btn>
      </Card>
    </div>
  );
}

// ─── Placeholders for remaining steps (added in later tasks) ──────────────────

function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const l = typeof opt === 'string' ? opt : opt.label;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${active ? C.purple : C.border}`,
              background: active ? C.purpleSoft : C.surface,
              color: active ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, fontFamily: F.sans,
              transition: 'all 0.15s',
            }}
          >{l}</button>
        );
      })}
    </div>
  );
}

function StepRegister({ onBack, onScreenCreated }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', owner_name: '', country: 'CA', state: '', city: '',
    location: '', venue_category: '', venue_subtype: '', environment: '',
    screen_position: '', display_size: '', lat: '', lng: '', showLatLng: false,
    monthly_traffic_estimate: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (key, val) => setForm(s => ({ ...s, [key]: val }));

  const handleCategoryChange = (val) => {
    setForm(s => ({ ...s, venue_category: val, venue_subtype: '' }));
  };

  const subtypes = form.venue_category ? (VENUE_TAXONOMY[form.venue_category]?.subtypes ?? []) : [];

  const valid =
    form.name.trim() && form.owner_name.trim() && form.state.trim() &&
    form.city.trim() && form.location.trim() && form.venue_category &&
    (subtypes.length === 0 || form.venue_subtype) &&
    form.environment && form.screen_position && form.display_size.trim() &&
    Number(form.monthly_traffic_estimate) > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    const tzMap = STATE_TIMEZONE[form.country] ?? {};
    const timezone = tzMap[form.state.trim()] ?? tzMap['default'] ?? 'America/Toronto';

    const { data, error } = await supabase.from('screens').insert({
      id:              crypto.randomUUID(),
      name:            form.name.trim(),
      owner_name:      form.owner_name.trim(),
      owner_type:      'Business',
      country:         form.country,
      state:           form.state.trim(),
      city:            form.city.trim(),
      location:        form.location.trim(),
      venue_category:  form.venue_category,
      venue_subtype:   form.venue_subtype || null,
      environment:     form.environment,
      screen_position: form.screen_position,
      display_size:    form.display_size.trim(),
      status:          'pending',
      operator_id:     user.id,
      max_ad_duration: 30,
      lat:             form.lat ? parseFloat(form.lat) : null,
      lon:             form.lng ? parseFloat(form.lng) : null,
      timezone,
      monthly_traffic_estimate: Number(form.monthly_traffic_estimate),
    }).select('id, name').single();

    if (error) { setErr(error.message); setSaving(false); return; }

    // screen_token is a bearer secret and is not column-readable. Fetch it via
    // the owner-scoped RPC so the operator can wire up their display.
    const { data: token } = await supabase.rpc('get_screen_token', { p_screen_id: data.id });

    // Role promotion (advertiser → operator) is handled by the
    // trg_promote_operator_role DB trigger on screens INSERT.

    // Fire confirmation email — fire and forget
    const { data: { session } } = await supabase.auth.getSession();
    if (session && SUPABASE_FUNCTIONS_URL) {
      const playerUrl = `${window.location.origin}/display/${token}`;
      fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          userId: user.id,
          type: 'screen_registered',
          data: { screenName: data.name, playerUrl, appUrl: `${window.location.origin}/app/screens` },
        }),
      }).catch(() => {});
    }

    setSaving(false);
    onScreenCreated({ id: data.id, name: data.name, screen_token: token });
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>
          Tell us about your screen
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 28px' }}>
          These details help advertisers find and book your screen.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          <Inp label="Screen Name" placeholder="e.g. Corner Brew — King St"
            value={form.name} onChange={e => set('name', e.target.value)} />

          <Inp label="Business / Owner Name" placeholder="e.g. Corner Brew Coffee"
            value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />

          <SelInput label="Country" value={form.country} onChange={e => setForm(s => ({ ...s, country: e.target.value, state: '', city: '' }))}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </SelInput>

          <Inp
            label={STATE_LABEL[form.country] || 'Province / State'}
            placeholder="e.g. Ontario"
            value={form.state}
            onChange={e => set('state', e.target.value)}
          />

          <Inp label="City" placeholder="e.g. Toronto"
            value={form.city} onChange={e => set('city', e.target.value)} />

          <Inp label="Location / Address" placeholder="e.g. King St W & Bay St"
            value={form.location} onChange={e => set('location', e.target.value)} />

          <div>
            <SelInput label="Venue Category" value={form.venue_category} onChange={e => handleCategoryChange(e.target.value)}>
              <option value="">Select category…</option>
              {Object.entries(VENUE_TAXONOMY).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </SelInput>
          </div>

          {subtypes.length > 0 && (
            <SelInput label="Venue Type" value={form.venue_subtype} onChange={e => set('venue_subtype', e.target.value)}>
              <option value="">Select type…</option>
              {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </SelInput>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Environment</div>
            <PillGroup
              options={[{ value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
              value={form.environment}
              onChange={val => set('environment', val)}
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Screen Position</div>
            <PillGroup
              options={SCREEN_POSITION_OPTIONS}
              value={form.screen_position}
              onChange={val => set('screen_position', val)}
            />
          </div>

          <Inp label="Display Size" placeholder="e.g. 55 inch 4K, 72 inch LED"
            value={form.display_size} onChange={e => set('display_size', e.target.value)} />

          <Inp
            label="Estimated monthly foot traffic"
            type="number" min="0" step="1"
            placeholder="e.g. 8000"
            value={form.monthly_traffic_estimate}
            onChange={e => set('monthly_traffic_estimate', e.target.value)}
          />
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: -10 }}>
            Rough headcount past this screen per month. Drives the reach estimate advertisers see —
            an empty or zero value shows their campaign as having no audience.
          </div>

          <div>
            <button
              type="button"
              onClick={() => set('showLatLng', !form.showLatLng)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: C.purple, cursor: 'pointer', fontFamily: F.sans, padding: 0 }}
            >
              {form.showLatLng ? '▾' : '▸'} Add location coordinates (for radius targeting)
            </button>
            {form.showLatLng && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <Inp label="Latitude" type="number" step="any" placeholder="e.g. 43.6532"
                  value={form.lat} onChange={e => set('lat', e.target.value)} />
                <Inp label="Longitude" type="number" step="any" placeholder="e.g. -79.3832"
                  value={form.lng} onChange={e => set('lng', e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <ErrorBanner message={err} onDismiss={() => setErr(null)} />

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>← Back</Btn>
          <Btn onClick={handleSubmit} disabled={!valid || saving} style={{ flex: 1 }}>
            {saving ? 'Registering…' : 'Next →'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}

const HARDWARE_OPTIONS = ['Browser Kiosk', 'Raspberry Pi 5', 'Mini PC', 'Android TV'];

function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
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
        <Btn variant="secondary" size="sm" onClick={copy} style={{ flexShrink: 0, minWidth: 64 }}>
          {copied ? '✓ Copied' : 'Copy'}
        </Btn>
      </div>
    </div>
  );
}

function CodeBox({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
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
        <button onClick={copy} style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 10px',
          cursor: 'pointer', fontFamily: F.sans,
        }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function HardwareInstructions({ hardware, screen }) {
  const playerUrl = `${window.location.origin}/display/${screen.screen_token}`;
  const kioskCommand = `chromium-browser --no-sandbox --noerrdialogs --kiosk \\
  --disable-infobars --disable-restore-session-state \\
  --disable-session-crashed-bubble \\
  "${playerUrl}"`;
  const autostartSnippet = `# /etc/xdg/lxsession/LXDE-pi/autostart
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --no-sandbox --noerrdialogs --kiosk --disable-infobars \\
  --disable-restore-session-state "${playerUrl}"`;

  if (hardware === 'Browser Kiosk') return (
    <div>
      <CopyBox label="Player URL" value={playerUrl} />
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.7 }}>
        Open this URL fullscreen on your display.<br />
        On Chrome: press <kbd style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>F11</kbd> for fullscreen.<br />
        The screen will automatically show ads when campaigns are running.
      </div>
    </div>
  );

  if (hardware === 'Raspberry Pi 5' || hardware === 'Mini PC') return (
    <div>
      <CopyBox label="Player URL" value={playerUrl} />
      <CodeBox label="Run once (test)" value={kioskCommand} />
      <CodeBox label="Autostart on boot (Raspberry Pi OS)" value={autostartSnippet} />
      <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.8 }}>
        1. Install Chromium: <code style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>sudo apt install chromium-browser</code><br />
        2. Test with the "Run once" command above.<br />
        3. For autostart on boot, add the autostart snippet to your LXDE config.<br />
        4. Disable screen blanking via <code style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>xset s off</code>.<br />
        5. <strong>Recommended:</strong> the snippet above doesn't restart Chromium if it crashes. For unattended production screens, use the <code style={{ background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3, fontFamily: F.mono, fontSize: 11 }}>screen-agent/display/</code> systemd service in the AdGrid repo instead — it auto-restarts on crash and survives reboots.
      </div>
    </div>
  );

  // Android TV — no native app yet; use a kiosk browser app from the Play Store
  return (
    <div style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.8 }}>
      <CopyBox label="Player URL" value={playerUrl} />
      1. Install <strong>Fully Kiosk Browser</strong> from the Google Play Store on your Android TV.<br />
      2. Open it, go to Settings → Web Content → Start URL, and paste the Player URL above.<br />
      3. Enable Settings → Other → Kiosk Mode and "Start on boot" so it auto-launches.<br />
      4. Restart the device to confirm it boots straight into the display.
    </div>
  );
}

function PhotoUpload({ screen }) {
  const [photos, setPhotos] = useState(screen.screen_photos || []);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    if (photos.length >= 4) return;
    const toUpload = Array.from(files).slice(0, 4 - photos.length);
    setUploading(true);
    const newUrls = [];
    for (const file of toUpload) {
      const path = `${screen.id}/${crypto.randomUUID()}`;
      const { error } = await supabase.storage.from('screen-photos').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('screen-photos').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    const updated = [...photos, ...newUrls];
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
    setUploading(false);
  };

  const removePhoto = async (url) => {
    const updated = photos.filter(p => p !== url);
    setPhotos(updated);
    await supabase.from('screens').update({ screen_photos: updated }).eq('id', screen.id);
  };

  return (
    <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>
        Add photos of your screen
      </div>
      <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 12 }}>
        Advertisers use these to verify placement before booking. Up to 4 photos.
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {photos.map((url, i) => (
            <div key={url} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              <img src={url} alt={`Screen photo ${i + 1}`}
                style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
              <button onClick={() => removePhoto(url)} style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                width: 22, height: 22, color: '#fff', cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>×</button>
            </div>
          ))}
        </div>
      )}

      {photos.length < 4 && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${C.border}`, borderRadius: 10, padding: '20px',
          cursor: uploading ? 'default' : 'pointer', background: C.surfaceAlt,
          fontSize: 13, color: C.textSub, fontFamily: F.sans, gap: 8,
        }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleFiles(e.target.files)} />
          {uploading ? 'Uploading…' : '+ Add photos'}
        </label>
      )}
    </div>
  );
}

function StepSetup({ screen, onNext, onBack, onSkip }) {
  const [hardware, setHardware] = useState('Browser Kiosk');

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <Card style={{ padding: 36 }}>
        <PhotoUpload screen={screen} />

        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 4px' }}>
          Set up your display
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, margin: '0 0 24px' }}>
          Choose your hardware and follow the instructions below.
        </p>

        {/* Hardware selector */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {HARDWARE_OPTIONS.map(hw => (
            <button key={hw} onClick={() => setHardware(hw)} style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${hardware === hw ? C.purple : C.border}`,
              background: hardware === hw ? C.purpleSoft : C.surface,
              color: hardware === hw ? C.purple : C.textSub,
              fontSize: 12, fontWeight: 500, fontFamily: F.sans,
              transition: 'all 0.15s',
            }}>{hw}</button>
          ))}
        </div>

        {/* Token (always visible) */}
        <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
          <CopyBox label="Your Screen Token" value={screen.screen_token} />
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans }}>
            Keep this private — it authenticates your display.
          </div>
        </div>

        {/* Hardware-specific instructions */}
        <div style={{ marginBottom: 28 }}>
          <HardwareInstructions hardware={hardware} screen={screen} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack} style={{ flex: 1 }}>← Back</Btn>
          <Btn onClick={onNext} style={{ flex: 1 }}>I've completed setup →</Btn>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', fontSize: 12, color: C.textMuted,
            cursor: 'pointer', fontFamily: F.sans,
          }}>Do this later →</button>
        </div>
      </Card>
    </div>
  );
}

function StepConnect({ screen, onDone, onSkip, onBack }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'connected' | 'none'

  const check = async () => {
    setStatus('checking');
    try {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('display_heartbeats')
        .select('id')
        .eq('screen_id', screen.id)
        .gte('created_at', since)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        await supabase.from('screens').update({ status: 'live' }).eq('id', screen.id);
        setStatus('connected');
      } else {
        setStatus('none');
      }
    } catch {
      setStatus('none');
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>
          {status === 'connected' ? '✅' : status === 'none' ? '⚠️' : '📡'}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 12px' }}>
          {status === 'connected' ? 'Screen is live!' : 'Test your connection'}
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, margin: '0 0 28px' }}>
          {status === 'connected'
            ? `${screen.name} is connected and sending heartbeats. You're all set.`
            : status === 'none'
            ? 'No heartbeat detected yet. Make sure your display is running and try again.'
            : "Click the button below after your display is running. We'll check if it's sending a heartbeat to our servers."}
        </p>

        {status !== 'connected' && (
          <Btn
            onClick={check}
            disabled={status === 'checking'}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {status === 'checking' ? 'Checking…' : status === 'none' ? 'Retry' : 'Test Connection'}
          </Btn>
        )}

        {status === 'connected' && (
          <Btn onClick={onDone} style={{ width: '100%', marginBottom: 12 }}>
            Go to my screen →
          </Btn>
        )}

        <button onClick={onSkip} style={{
          background: 'none', border: 'none', fontSize: 12,
          color: C.textMuted, cursor: 'pointer', fontFamily: F.sans,
        }}>
          Skip for now →
        </button>
      </Card>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', fontSize: 12,
          color: C.textMuted, cursor: 'pointer', fontFamily: F.sans,
        }}>← Back to setup guide</button>
      </div>
    </div>
  );
}

// B14 fix (2026-07-14 ICP sweep): payouts never appeared anywhere in the
// operator onboarding wizard, so screens went live with no way to ever get
// paid. Makes Stripe Connect a first-class (skippable, not blocking —
// screens already live shouldn't get bricked by this) step.
function StepPayouts({ onDone, onSkip, onBack }) {
  const { profile } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const connectStatus = profile?.connect_status;

  async function startConnect() {
    setConnecting(true);
    setError(null);
    const state = crypto.randomUUID();
    sessionStorage.setItem('stripe_connect_state', state);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Session expired. Please log in again.'); setConnecting(false); return; }
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ returnUrl: window.location.origin + '/app/screens', state }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Failed to start Stripe Connect');
      window.location.href = json.url;
    } catch (e) {
      setError(e.message);
      setConnecting(false);
    }
  }

  if (connectStatus === 'active') {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 12px' }}>
            Payouts are set up
          </h2>
          <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, margin: '0 0 28px' }}>
            Your Stripe account is connected. You'll get paid automatically as campaigns run.
          </p>
          <Btn onClick={onDone} style={{ width: '100%' }}>Finish →</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>💳</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 12px' }}>
          Set up payouts
        </h2>
        <p style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans, lineHeight: 1.6, margin: '0 0 28px' }}>
          Connect a bank account via Stripe so you actually get paid when advertisers book your screen.
          Without this, your cut of every campaign is held and never transferred.
        </p>
        {error && <ErrorBanner message={error} />}
        <Btn onClick={startConnect} disabled={connecting} style={{ width: '100%', marginBottom: 12 }}>
          {connecting ? 'Redirecting to Stripe…' : 'Connect with Stripe'}
        </Btn>
        <button onClick={onSkip} style={{
          background: 'none', border: 'none', fontSize: 12,
          color: C.textMuted, cursor: 'pointer', fontFamily: F.sans,
        }}>
          Skip for now →
        </button>
      </Card>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', fontSize: 12,
          color: C.textMuted, cursor: 'pointer', fontFamily: F.sans,
        }}>← Back</button>
      </div>
    </div>
  );
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function ScreenOnboardView({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [newScreen, setNewScreen] = useState(null); // set after Step 2 insert

  const handleScreenCreated = (screen) => {
    setNewScreen(screen);
    setStep(3);
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <WizardProgress step={step} total={5} onCancel={onCancel} />

      {step === 1 && (
        <StepWelcome onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepRegister
          onBack={() => setStep(1)}
          onScreenCreated={handleScreenCreated}
        />
      )}
      {step === 3 && newScreen && (
        <StepSetup
          screen={newScreen}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
          onSkip={() => setStep(5)}
        />
      )}
      {step === 4 && newScreen && (
        <StepConnect
          screen={newScreen}
          onDone={() => setStep(5)}
          onSkip={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && newScreen && (
        <StepPayouts
          onDone={() => onComplete(newScreen)}
          onSkip={() => onComplete(newScreen)}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}
