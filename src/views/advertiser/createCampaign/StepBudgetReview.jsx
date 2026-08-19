// src/views/advertiser/createCampaign/StepBudgetReview.jsx
import { C, F } from '../../../design/tokens.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { Btn } from '../../../components/primitives/Btn.jsx';
import { ErrorBanner } from '../../../components/primitives/ErrorBanner.jsx';
import { PillGroup } from './PillGroup.jsx';
import { formatCurrency } from '../../../lib/formatCurrency.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function StepBudgetReview({
  form, setForm, matchedScreens, profile, onSubmit, submitting, err, canChooseBilling, billedTo, setBilledTo,
}) {
  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const days = form.start_date && form.end_date
    ? Math.max(1, Math.round((new Date(form.end_date) - new Date(form.start_date)) / (1000 * 60 * 60 * 24)))
    : 30;
  const totalImpr = matchedScreens.reduce((a, s) => a + (s.impressions || 0), 0);
  const budgetMin = Math.round((totalImpr / 1000) * 3 * (days / 30));
  const budgetMax = Math.round((totalImpr / 1000) * 8 * (days / 30));
  const budget = parseFloat(form.budget) || 0;
  const tooLow = budget > 0 && matchedScreens.length > 0 && days > 0
    && (budget / matchedScreens.length / days) < 0.50;

  const overCapScreens = matchedScreens.filter(s =>
    typeof s.max_ad_duration === 'number' && Number(form.duration) > s.max_ad_duration
  );

  const isMulti = form.creatives.length > 1;
  const creativeLabel = (i) => form.creatives[i]?.label || `Creative ${i + 1}`;

  const rows = [
    ['Area', `${form.area_type === 'radius' ? `${form.radius_km}km radius` : form.city || form.state || form.country}`],
    ['Screens', `${form.selected_screen_ids.length} selected · ~${(totalImpr / 1000).toFixed(0)}K impr/mo`],
    ['Creatives', isMulti ? form.creatives.map((c, i) => creativeLabel(i)).join(', ') : creativeLabel(0)],
    ['Budget', `${form.budget ? formatCurrency(form.budget, profile?.preferred_currency) : '—'} (${form.budget_mode === 'daily' ? 'daily' : 'total'})`],
    ['Dates', form.start_date && form.end_date ? `${form.start_date} → ${form.end_date} (${days} days)` : '—'],
    ['Time', `${form.time_start} – ${form.time_end}`],
    ['Days', form.schedule_days.join(', ')],
    ['Ad Duration', `${form.duration}s per play`],
    ['Slot Share', `${form.slots}% of airtime`],
    ['Launch', form.start_when === 'partial' ? 'Go live as screens approve' : 'Wait for all screens'],
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 24px' }}>Budget & Schedule</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Budget type</div>
            <PillGroup
              options={[{ value: 'total', label: 'Total budget' }, { value: 'daily', label: 'Daily limit' }]}
              value={form.budget_mode}
              onChange={v => setField('budget_mode', v)}
            />
          </div>

          <Inp
            label={form.budget_mode === 'daily' ? `Daily limit (${(profile?.preferred_currency || 'cad').toUpperCase()})` : `Total budget (${(profile?.preferred_currency || 'cad').toUpperCase()})`}
            type="number" step="1" placeholder="e.g. 200"
            value={form.budget} onChange={e => setField('budget', e.target.value)}
            hint={totalImpr > 0 && days > 0 ? `Suggested for ${matchedScreens.length} screens over ${days} days: ${formatCurrency(budgetMin, profile?.preferred_currency)}–${formatCurrency(budgetMax, profile?.preferred_currency)}` : undefined}
          />

          {isMulti && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Budget applies to</div>
              <PillGroup
                options={[{ value: 'unified', label: 'Whole campaign' }, { value: 'per_creative', label: 'Split per creative' }]}
                value={form.budget_level}
                onChange={v => setField('budget_level', v)}
              />
              {form.budget_level === 'per_creative' && (
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 6 }}>
                  The budget above is still your overall spend cap — per-creative amounts track how that total is split, they don't add to it.
                </div>
              )}
            </div>
          )}

          {isMulti && form.budget_level === 'per_creative' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.creatives.map((c, i) => (
                <Inp
                  key={c.id}
                  label={`${creativeLabel(i)} budget (${(profile?.preferred_currency || 'cad').toUpperCase()})`}
                  type="number" step="1" placeholder="e.g. 100"
                  value={c.budget ?? ''}
                  onChange={e => setForm(s => ({ ...s, creatives: s.creatives.map(cc => cc.id === c.id ? { ...cc, budget: e.target.value } : cc) }))}
                />
              ))}
            </div>
          )}

          {tooLow && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ Budget may be too low to run consistently across all selected screens. Consider increasing your budget or reducing screen count.
            </div>
          )}

          {overCapScreens.length > 0 && (
            <div style={{ padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amber, fontFamily: F.sans }}>
              ⚠ {overCapScreens.length} of {matchedScreens.length} selected screens cap ad duration below {form.duration}s — your ad will play shorter there: {overCapScreens.slice(0, 3).map(s => s.name).join(', ')}{overCapScreens.length > 3 ? ` and ${overCapScreens.length - 3} more` : ''}.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Start date" type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            <Inp label="End date" type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Days of week</div>
            <PillGroup options={DAYS} value={form.schedule_days} onChange={v => setField('schedule_days', v)} multi={true} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="From" type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)} />
            <Inp label="Until" type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label="Ad play duration (seconds)" type="number" min="5" max="60" step="1"
              value={form.duration} onChange={e => setField('duration', e.target.value)}
              hint="How long your ad plays each time it's shown" />
            <Inp label="Slot share (% of screen airtime)" type="number" min="1" max="100" step="1"
              value={form.slots} onChange={e => setField('slots', e.target.value)}
              hint="Your ad's share of each screen's rotation" />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 8 }}>Launch mode</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'partial', title: 'Go live as screens approve', desc: "Your campaign starts running on each screen as soon as that screen's owner approves." },
                { value: 'all', title: 'Wait for all screens', desc: 'Campaign stays pending until every targeted screen owner has approved.' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setField('start_when', opt.value)} style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${form.start_when === opt.value ? C.purple : C.border}`,
                  background: form.start_when === opt.value ? C.purpleSoft : C.surface,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 2 }}>{opt.title}</div>
                  <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, margin: '0 0 16px' }}>Review</h2>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, fontFamily: F.sans, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 80, paddingTop: 1 }}>{label}</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: F.sans }}>{value}</div>
            </div>
          ))}

          {canChooseBilling && (
            <div style={{ marginTop: 16, marginBottom: 4, padding: '16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 12 }}>Bill to</div>
              {[
                { value: 'client', label: 'Client account', desc: "Uses client's payment method" },
                { value: 'agency', label: 'Agency account', desc: 'Uses your payment method' },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="radio" name="billedTo" value={opt.value} checked={billedTo === opt.value} onChange={() => setBilledTo(opt.value)} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontFamily: F.sans }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {err && <ErrorBanner message={err} onDismiss={() => {}} />}

          <Btn onClick={onSubmit} disabled={submitting} style={{ width: '100%', fontSize: 15, padding: '14px 24px', marginTop: 16 }}>
            {submitting ? 'Submitting…' : 'Submit Campaign →'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
