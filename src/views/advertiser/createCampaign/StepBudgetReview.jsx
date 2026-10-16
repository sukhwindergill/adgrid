// src/views/advertiser/createCampaign/StepBudgetReview.jsx
import { C, F, T } from '../../../design/tokens.js';
import { TX } from '../../../design/text.js';
import { Card } from '../../../components/primitives/Card.jsx';
import { Inp } from '../../../components/primitives/Inp.jsx';
import { Btn } from '../../../components/primitives/Btn.jsx';
import { ErrorBanner } from '../../../components/primitives/ErrorBanner.jsx';
import { PillGroup } from './PillGroup.jsx';
import { syncDaypartingDays } from '../../../lib/dayparting.js';
import { IconWarning } from '../../../components/icons.jsx';
import { parseFrequencyCap } from '../../../lib/adGuardrails.js';
import { useT } from '../../../i18n/useT.js';

// Stored values (schedule_days, dayparting keys) stay English; only the
// labels are translated.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function StepBudgetReview({
  form, setForm, matchedScreens, profile, onSubmit, submitting, err, canChooseBilling, billedTo, setBilledTo, houseAdMode = false,
  categoryBlockedScreens = [], campaignCategory = null,
}) {
  const { t, formatMoney, formatNumber, formatDate } = useT();
  const formatCurrency = formatMoney;
  const dayLabel = d => t(`common.days.short.${d}`);
  const currencyCode = (profile?.preferred_currency || 'cad').toUpperCase();
  const nameList = list => list.slice(0, 3).map(s => s.name).join(', ');
  const moreSuffix = list => (list.length > 3 ? t('common.andMore', { count: list.length - 3 }) : '');
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

  const frequencyCap = parseFrequencyCap(form.frequency_cap);

  const isMulti = form.creatives.length > 1;
  const creativeLabel = (i) => form.creatives[i]?.label || t('create.creative.defaultLabel', { n: i + 1 });

  const rows = [
    [t('create.budget.area'), `${form.area_type === 'radius' ? t('create.budget.radiusArea', { km: form.radius_km }) : form.city || form.state || form.country}`],
    [t('create.budget.screens'), t('create.budget.screensSummary', { count: form.selected_screen_ids.length, k: formatNumber(Math.round(totalImpr / 1000)) })],
    [t('create.budget.creatives'), isMulti ? form.creatives.map((c, i) => creativeLabel(i)).join(', ') : creativeLabel(0)],
    ...(houseAdMode ? [] : [[t('create.budget.budget'), t('create.budget.budgetSummary', {
      amount: form.budget ? formatCurrency(form.budget, profile?.preferred_currency) : '—',
      mode: form.budget_mode === 'daily' ? t('create.budget.modeDaily') : t('create.budget.modeTotal'),
    })]]),
    [t('create.budget.dates'), form.start_date && form.end_date ? t('create.budget.dateRange', { start: formatDate(form.start_date), end: formatDate(form.end_date), days }) : '—'],
    [t('create.budget.time'), form.dayparting
      ? form.schedule_days.map(d => `${dayLabel(d)} ${form.dayparting[d]?.time_start}–${form.dayparting[d]?.time_end}`).join(', ')
      : `${form.time_start} – ${form.time_end}`],
    [t('create.budget.days'), form.schedule_days.map(dayLabel).join(', ')],
    [t('create.budget.duration'), t('create.budget.durationValue', { s: form.duration })],
    [t('create.budget.slotShare'), t('create.budget.slotValue', { pct: form.slots })],
    ...(houseAdMode ? [] : [[t('create.budget.frequency'), frequencyCap.value ? t('create.budget.frequencyValue', { n: frequencyCap.value }) : t('create.budget.noCap')]]),
    [t('create.budget.launch'), form.start_when === 'partial' ? t('create.budget.partialTitle') : t('create.budget.allTitle')],
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card style={{ padding: 32 }}>
        <h2 style={{ fontSize: T.xl, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 24px' }}>{t('create.budget.heading')}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!houseAdMode && (
            <div>
              <div style={{ ...TX.label, marginBottom: 8 }}>{t('create.budget.budgetType')}</div>
              <PillGroup
                options={[{ value: 'total', label: t('create.budget.totalBudget') }, { value: 'daily', label: t('create.budget.dailyLimit') }]}
                value={form.budget_mode}
                onChange={v => setField('budget_mode', v)}
              />
            </div>
          )}

          {!houseAdMode && (
            <Inp
              label={form.budget_mode === 'daily' ? t('create.budget.dailyLimitLabel', { currency: currencyCode }) : t('create.budget.totalBudgetLabel', { currency: currencyCode })}
              type="number" step="1" placeholder={t('create.budget.placeholder200')}
              value={form.budget} onChange={e => setField('budget', e.target.value)}
              hint={totalImpr > 0 && days > 0 ? t('create.budget.suggested', {
                screens: matchedScreens.length, days,
                min: formatCurrency(budgetMin, profile?.preferred_currency), max: formatCurrency(budgetMax, profile?.preferred_currency),
              }) : undefined}
            />
          )}

          {!houseAdMode && isMulti && (
            <div>
              <div style={{ ...TX.label, marginBottom: 8 }}>{t('create.budget.appliesTo')}</div>
              <PillGroup
                options={[{ value: 'unified', label: t('create.budget.wholeCampaign') }, { value: 'per_creative', label: t('create.budget.perCreative') }]}
                value={form.budget_level}
                onChange={v => setField('budget_level', v)}
              />
              {form.budget_level === 'per_creative' && (
                <div style={{ ...TX.caption, marginTop: 6 }}>
                  {t('create.budget.perCreativeHint')}
                </div>
              )}
            </div>
          )}

          {isMulti && form.budget_level === 'per_creative' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.creatives.map((c, i) => (
                <Inp
                  key={c.id}
                  label={t('create.budget.creativeBudget', { label: creativeLabel(i), currency: currencyCode })}
                  type="number" step="1" placeholder={t('create.budget.placeholder100')}
                  value={c.budget ?? ''}
                  onChange={e => setForm(s => ({ ...s, creatives: s.creatives.map(cc => cc.id === c.id ? { ...cc, budget: e.target.value } : cc) }))}
                />
              ))}
            </div>
          )}

          {tooLow && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: T.sm, color: C.amberText, fontFamily: F.sans }}>
              <span style={{ flexShrink: 0 }}><IconWarning size={14} /></span>
              <span>{t('create.budget.tooLow')}</span>
            </div>
          )}

          {overCapScreens.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: T.sm, color: C.amberText, fontFamily: F.sans }}>
              <span style={{ flexShrink: 0 }}><IconWarning size={14} /></span>
              <span>{t('create.budget.overCap', { count: overCapScreens.length, total: matchedScreens.length, s: form.duration, names: nameList(overCapScreens), more: moreSuffix(overCapScreens) })}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label={t('create.budget.startDate')} type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            <Inp label={t('create.budget.endDate')} type="date" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
          </div>

          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('create.budget.daysOfWeek')}</div>
            <PillGroup options={DAYS.map(d => ({ value: d, label: dayLabel(d) }))} value={form.schedule_days} onChange={v => setForm(s => ({
              ...s,
              schedule_days: v,
              // Keep the per-day grid in sync with the day selection -- a
              // newly-added day is seeded from the flat window, a removed
              // one drops its override. No-op while dayparting is off.
              dayparting: s.dayparting ? syncDaypartingDays(s.dayparting, v, s.time_start, s.time_end) : null,
            }))} multi={true} />
          </div>

          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('create.budget.playTimes')}</div>
            <PillGroup
              options={[{ value: 'same', label: t('create.budget.sameTime') }, { value: 'different', label: t('create.budget.differentTimes') }]}
              value={form.dayparting ? 'different' : 'same'}
              onChange={v => setForm(s => ({
                ...s,
                dayparting: v === 'different' ? syncDaypartingDays(s.dayparting, s.schedule_days, s.time_start, s.time_end) : null,
              }))}
            />
          </div>

          {form.dayparting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.schedule_days.map(day => (
                <div key={day} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr', gap: 10, alignItems: 'end' }}>
                  <div style={{ fontSize: T.sm, fontWeight: 600, color: C.textMid, fontFamily: F.sans, paddingBottom: 9 }}>{dayLabel(day)}</div>
                  <Inp type="time" value={form.dayparting[day]?.time_start ?? ''}
                    onChange={e => setField('dayparting', { ...form.dayparting, [day]: { ...form.dayparting[day], time_start: e.target.value } })} />
                  <Inp type="time" value={form.dayparting[day]?.time_end ?? ''}
                    onChange={e => setField('dayparting', { ...form.dayparting, [day]: { ...form.dayparting[day], time_end: e.target.value } })} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Inp label={t('create.budget.from')} type="time" value={form.time_start} onChange={e => setField('time_start', e.target.value)} />
              <Inp label={t('create.budget.until')} type="time" value={form.time_end} onChange={e => setField('time_end', e.target.value)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Inp label={t('create.budget.playDuration')} type="number" min="5" max="60" step="1"
              value={form.duration} onChange={e => setField('duration', e.target.value)}
              hint={t('create.budget.playDurationHint')} />
            <Inp label={t('create.budget.slotShareLabel')} type="number" min="1" max="100" step="1"
              value={form.slots} onChange={e => setField('slots', e.target.value)}
              hint={t('create.budget.slotShareHint')} />
          </div>

          {!houseAdMode && (
            <Inp label={t('create.budget.frequencyCap')} type="number" min="1" step="1" placeholder={t('create.budget.noCap')}
              value={form.frequency_cap ?? ''} onChange={e => setField('frequency_cap', e.target.value)}
              error={frequencyCap.error || undefined}
              hint={frequencyCap.error ? undefined : t('create.budget.frequencyHint')} />
          )}

          {categoryBlockedScreens.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: C.amberSoft, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: T.sm, color: C.amberText, fontFamily: F.sans }}>
              <span style={{ flexShrink: 0 }}><IconWarning size={14} /></span>
              <span>{t('create.budget.categoryBlocked', {
                count: categoryBlockedScreens.length,
                category: campaignCategory,
                names: nameList(categoryBlockedScreens),
                more: moreSuffix(categoryBlockedScreens),
              })}</span>
            </div>
          )}

          <div>
            <div style={{ ...TX.label, marginBottom: 8 }}>{t('create.budget.launchMode')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { value: 'partial', title: t('create.budget.partialTitle'), desc: t('create.budget.partialDesc') },
                { value: 'all', title: t('create.budget.allTitle'), desc: t('create.budget.allDesc') },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setField('start_when', opt.value)} style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `2px solid ${form.start_when === opt.value ? C.purple : C.border}`,
                  background: form.start_when === opt.value ? C.purpleSoft : C.surface,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ ...TX.strong, marginBottom: 2 }}>{opt.title}</div>
                  <div style={{ ...TX.helper, lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 16px' }}>{t('create.budget.review')}</h2>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ ...TX.caption, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 80, paddingTop: 1 }}>{label}</div>
              <div style={TX.body}>{value}</div>
            </div>
          ))}

          {canChooseBilling && (
            <div style={{ marginTop: 16, marginBottom: 4, padding: '16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ ...TX.strong, marginBottom: 12 }}>{t('create.budget.billTo')}</div>
              {[
                { value: 'client', label: t('create.budget.clientAccount'), desc: t('create.budget.clientDesc') },
                { value: 'agency', label: t('create.budget.agencyAccount'), desc: t('create.budget.agencyDesc') },
              ].map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="radio" name="billedTo" value={opt.value} checked={billedTo === opt.value} onChange={() => setBilledTo(opt.value)} />
                  <div>
                    <div style={{ ...TX.body, fontWeight: 500 }}>{opt.label}</div>
                    <div style={TX.helper}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {err && <ErrorBanner message={err} onDismiss={() => {}} />}

          <Btn onClick={onSubmit} disabled={submitting} style={{ width: '100%', fontSize: T.md, padding: '14px 24px', marginTop: 16 }}>
            {submitting ? t('common.submitting') : houseAdMode ? t('create.budget.createHouseAd') : t('create.budget.submit')}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
