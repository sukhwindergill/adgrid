import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';
import { SelInput } from '../primitives/SelInput.jsx';

export function EditScreenModal({ screen, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:                     screen.name || '',
    location:                 screen.location || '',
    city:                     screen.city || 'Toronto',
    display_size:             screen.display_size || '',
    cpm_floor:                screen.cpm_floor ?? screen.cpm ?? 3.00,
    monthly_traffic_estimate: screen.monthly_traffic_estimate || '',
    lat:                      screen.lat || '',
    lng:                      screen.lng || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase
      .from('screens')
      .update({
        name:                     form.name.trim(),
        location:                 form.location.trim() || form.city,
        city:                     form.city,
        display_size:             form.display_size || null,
        cpm_floor:                parseFloat(form.cpm_floor) || 3.00,
        cpm:                      parseFloat(form.cpm_floor) || 3.00,
        monthly_traffic_estimate: form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) : null,
        impressions:              form.monthly_traffic_estimate ? parseInt(form.monthly_traffic_estimate) * 1000 : screen.impressions,
        lat:                      form.lat ? parseFloat(form.lat) : null,
        lng:                      form.lng ? parseFloat(form.lng) : null,
      })
      .eq('id', screen.id)
      .select()
      .single();

    if (error) { setErr(error.message); setSaving(false); return; }
    onSaved(data);
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
            <Inp label="Longitude" type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Monthly Footfall (thousands)" type="number" value={form.monthly_traffic_estimate} onChange={e => setForm(f => ({ ...f, monthly_traffic_estimate: e.target.value }))} />
            <Inp label="CPM Floor (£)" type="number" step="0.50" value={form.cpm_floor} onChange={e => setForm(f => ({ ...f, cpm_floor: e.target.value }))} />
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
