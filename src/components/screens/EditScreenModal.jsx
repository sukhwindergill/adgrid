import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';
import { SelInput } from '../primitives/SelInput.jsx';

const FORMAT_OPTIONS = ['jpg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];

function FormatChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {FORMAT_OPTIONS.map(fmt => {
        const active = value.includes(fmt);
        return (
          <button key={fmt} type="button" onClick={() => {
            onChange(active ? value.filter(f => f !== fmt) : [...value, fmt]);
          }} style={{
            padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
            border: `1px solid ${active ? C.purple : C.border}`,
            background: active ? C.purpleSoft : C.surface,
            color: active ? C.purple : C.textSub,
            fontSize: 12, fontFamily: F.sans,
          }}>{fmt}</button>
        );
      })}
    </div>
  );
}

export function EditScreenModal({ screen, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:                     screen.name || '',
    location:                 screen.location || '',
    city:                     screen.city || 'Toronto',
    display_size:             screen.display_size || '',
    cpm_floor:                screen.cpm_floor ?? screen.cpm ?? 3.00,
    monthly_traffic_estimate: screen.monthly_traffic_estimate || '',
    lat:                      screen.lat || '',
    lon:                      screen.lon || '',
    resolution_w:      screen.resolution_w || '',
    resolution_h:      screen.resolution_h || '',
    accepted_formats:  screen.accepted_formats || [],
    max_file_mb:       screen.max_file_mb || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setErr(null);
    const updates = {
      name:                     form.name.trim(),
      location:                 form.location.trim() || form.city,
      city:                     form.city,
      display_size:             form.display_size || null,
      cpm_floor:                parseFloat(form.cpm_floor) || 3.00,
      monthly_traffic_estimate: form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) : null,
      impressions:              form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) * 1000 : screen.impressions,
      lat:                      form.lat ? parseFloat(form.lat) : null,
      lon:                      form.lon ? parseFloat(form.lon) : null,
      resolution_w:      Number(form.resolution_w) > 0 ? parseInt(form.resolution_w, 10) : null,
      resolution_h:      Number(form.resolution_h) > 0 ? parseInt(form.resolution_h, 10) : null,
      accepted_formats:  form.accepted_formats.length > 0 ? form.accepted_formats : null,
      max_file_mb:       Number(form.max_file_mb) > 0 ? parseInt(form.max_file_mb, 10) : null,
    };
    // No .select() on the update: screens' SELECT grant is column-scoped
    // (screen_token is deliberately excluded), and .select() defaults to
    // requesting every column, which fails with a permission error even
    // when the write itself succeeds. Merge the known update locally instead.
    const { error } = await supabase
      .from('screens')
      .update(updates)
      .eq('id', screen.id);

    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved({ ...screen, ...updates });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: C.surface, borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans }}>Edit Screen</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: C.textMuted, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <Inp label="Screen Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Inp label="Location / Address" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <SelInput label="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
            {['Toronto', 'London', 'Manchester', 'Birmingham', 'Vancouver', 'Edinburgh'].map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <Inp label="Display Size" placeholder="e.g. 55 inch 4K" value={form.display_size} onChange={e => setForm(f => ({ ...f, display_size: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Latitude" type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            <Inp label="Longitude" type="number" step="any" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Monthly Footfall (thousands)" type="number" value={form.monthly_traffic_estimate} onChange={e => setForm(f => ({ ...f, monthly_traffic_estimate: e.target.value }))} />
            <Inp label="CPM Floor (£)" type="number" step="0.50" value={form.cpm_floor} onChange={e => setForm(f => ({ ...f, cpm_floor: e.target.value }))} />
          </div>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 4 }}>
              Creative spec <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginBottom: 10, lineHeight: 1.5 }}>
              Lets advertisers know before they upload whether their creative fits your screen.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Inp label="Resolution width (px)" type="number" min="1" placeholder="e.g. 1080"
                value={form.resolution_w} onChange={e => setForm(f => ({ ...f, resolution_w: e.target.value }))} />
              <Inp label="Resolution height (px)" type="number" min="1" placeholder="e.g. 1920"
                value={form.resolution_h} onChange={e => setForm(f => ({ ...f, resolution_h: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginBottom: 6 }}>Accepted file formats</div>
              <FormatChips value={form.accepted_formats} onChange={v => setForm(f => ({ ...f, accepted_formats: v }))} />
            </div>
            <Inp label="Max file size (MB)" type="number" min="1" placeholder="e.g. 20"
              value={form.max_file_mb} onChange={e => setForm(f => ({ ...f, max_file_mb: e.target.value }))} />
          </div>
        </div>
        {err && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={!form.name || saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
        </div>
      </div>
    </div>
  );
}
