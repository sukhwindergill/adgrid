import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T, SH } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../primitives/Btn.jsx';
import { Chip } from '../primitives/Chip.jsx';
import { Modal } from '../primitives/Modal.jsx';
import { Inp } from '../primitives/Inp.jsx';
import { SelInput } from '../primitives/SelInput.jsx';
import { OperatingHoursFields } from './OperatingHoursFields.jsx';
import { hoursFormFromScreen, hoursUpdates, hoursError } from '../../lib/operatingHours.js';
import { useT } from '../../i18n/useT.js';

const FORMAT_OPTIONS = ['jpg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'];

function FormatChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {FORMAT_OPTIONS.map(fmt => {
        const active = value.includes(fmt);
        return (
          <Chip key={fmt} selected={active} onClick={() => {
            onChange(active ? value.filter(f => f !== fmt) : [...value, fmt]);
          }}>{fmt}</Chip>
        );
      })}
    </div>
  );
}

export function EditScreenModal({ screen, onClose, onSaved }) {
  const { t } = useT();
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
  const [hours, setHours] = useState(() => hoursFormFromScreen(screen));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.name.trim()) return;
    const hErr = hoursError(hours);
    if (hErr) { setErr(hErr); return; }
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
      ...hoursUpdates(hours),
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
    <Modal title={t('scr.edit.title')} onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <Inp label={t('scr.edit.name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Inp label={t('scr.edit.location')} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <SelInput label={t('scr.edit.city')} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
            {['Toronto', 'London', 'Manchester', 'Birmingham', 'Vancouver', 'Edinburgh'].map(c => <option key={c}>{c}</option>)}
          </SelInput>
          <Inp label={t('scr.edit.displaySize')} placeholder={t('scr.edit.displaySizePlaceholder')} value={form.display_size} onChange={e => setForm(f => ({ ...f, display_size: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label={t('scr.edit.latitude')} type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            <Inp label={t('scr.edit.longitude')} type="number" step="any" value={form.lon} onChange={e => setForm(f => ({ ...f, lon: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label={t('scr.edit.footfall')} type="number" value={form.monthly_traffic_estimate} onChange={e => setForm(f => ({ ...f, monthly_traffic_estimate: e.target.value }))} />
            <Inp label={t('scr.edit.cpmFloor')} type="number" step="0.50" value={form.cpm_floor} onChange={e => setForm(f => ({ ...f, cpm_floor: e.target.value }))} />
          </div>
          <OperatingHoursFields value={hours} onChange={setHours} />
          <div style={{ marginTop: 4 }}>
            <div style={{ ...TX.label, marginBottom: 4 }}>
              {t('scr.edit.spec')} <span style={{ color: C.textMuted, fontWeight: 400 }}>{t('common.optional')}</span>
            </div>
            <div style={{ ...TX.caption, marginBottom: 10, lineHeight: 1.5 }}>
              {t('scr.edit.specHint')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Inp label={t('scr.edit.resW')} type="number" min="1" placeholder={t('scr.edit.eg1080')}
                value={form.resolution_w} onChange={e => setForm(f => ({ ...f, resolution_w: e.target.value }))} />
              <Inp label={t('scr.edit.resH')} type="number" min="1" placeholder={t('scr.edit.eg1920')}
                value={form.resolution_h} onChange={e => setForm(f => ({ ...f, resolution_h: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...TX.helper, marginBottom: 6 }}>{t('scr.edit.formats')}</div>
              <FormatChips value={form.accepted_formats} onChange={v => setForm(f => ({ ...f, accepted_formats: v }))} />
            </div>
            <Inp label={t('scr.edit.maxMb')} type="number" min="1" placeholder={t('scr.edit.eg20')}
              value={form.max_file_mb} onChange={e => setForm(f => ({ ...f, max_file_mb: e.target.value }))} />
          </div>
        </div>
        {err && <div style={{ ...TX.error, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
          <Btn onClick={save} disabled={!form.name || saving}>{saving ? t('common.saving') : t('scr.edit.saveChanges')}</Btn>
        </div>
    </Modal>
  );
}
