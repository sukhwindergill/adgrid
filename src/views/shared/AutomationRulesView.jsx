import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';
import { useT } from '../../i18n/useT.js';

const METRICS = ['cost_per_scan', 'pacing_ratio', 'offline_screen_minutes', 'billable_scans', 'plays', 'delivery_pct'];
const COMPARATORS = ['gt', 'gte', 'lt', 'lte'];

// Sensible starting rules, offered as one-click adds rather than silently
// created — a rule that can pause a campaign should never appear by surprise.
const SUGGESTED = [
  { key: 'dark', metric: 'offline_screen_minutes', comparator: 'gt', threshold: 120, action: 'notify' },
  { key: 'pacing', metric: 'pacing_ratio',           comparator: 'lt', threshold: 0.6, action: 'notify' },
  { key: 'cps', metric: 'cost_per_scan',          comparator: 'gt', threshold: 5,   action: 'notify' },
];

const EMPTY_DRAFT = { name: '', metric: 'cost_per_scan', comparator: 'gt', threshold: '', action: 'notify' };

export function AutomationRulesView({ user, ownerSide = 'advertiser', setNav }) {
  const toast = useToast();
  const { isMobile } = useBreakpoint();
  const { t, tx, tOr, formatDateTime, formatNumber } = useT();
  const metricLabel = m => tOr(`rules.metric.${m}`, m);
  const comparatorLabel = c => tOr(`rules.comparator.${c}`, c);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // `loading` starts true and is only cleared once, so a refresh after
  // add/toggle/remove just swaps the list rather than flashing a spinner.
  //
  // The mount effect below trips react-hooks/set-state-in-effect, the same way
  // every other data-loading view in this app does (App.jsx, ScreenDetail,
  // OperatorSettingsView). Matching the established pattern rather than
  // introducing a one-off structure here.
  const load = async () => {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('id, name, metric, comparator, threshold, action, enabled, last_fired_at, last_fired_value')
      .order('created_at', { ascending: false });
    // A failed fetch previously left rules empty just like a genuine
    // zero-rules account, showing "Suggested rules" as if nothing had ever
    // been configured -- misleading when the list simply never loaded.
    setLoadError(Boolean(error));
    setRules(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addRule = async (rule) => {
    const threshold = Number(rule.threshold);
    if (!rule.name.trim() || rule.threshold === '' || !Number.isFinite(threshold)) {
      toast.error(t('rules.needNameThreshold'));
      return;
    }
    const { error } = await supabase.from('automation_rules').insert({
      owner_id: user.id,
      owner_side: ownerSide,
      name: rule.name.trim(),
      metric: rule.metric,
      comparator: rule.comparator,
      threshold,
      action: rule.action,
    });
    if (error) { toast.error(t('rules.saveFailed', { error: error.message })); return; }
    toast.success(t('rules.added'));
    setDraft(EMPTY_DRAFT);
    load();
  };

  const toggle = async (rule) => {
    const { error } = await supabase.from('automation_rules').update({ enabled: !rule.enabled }).eq('id', rule.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const remove = async (rule) => {
    const { error } = await supabase.from('automation_rules').delete().eq('id', rule.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('rules.removed'));
    load();
  };

  return (
    <div>
      <PageHeader title={t('rules.title')} subtitle={t('rules.subtitle')} />

      {ownerSide === 'operator' && setNav && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          padding: '12px 16px', marginBottom: 20, background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, fontFamily: F.sans,
        }}>
          <div style={{ fontSize: T.sm, color: C.textSub, lineHeight: 1.5 }}>
            {tx('rules.opNote', { b: chunk => <strong>{chunk}</strong> })}
          </div>
          <Btn variant="outline" size="sm" onClick={() => setNav('op-settings')} style={{ padding: '6px 14px', borderRadius: 6, fontWeight: 600 }}>
            {t('rules.openSettings')}
          </Btn>
        </div>
      )}

      {!loading && loadError && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: T.base, color: C.redText, fontFamily: F.sans }}>{t('rules.loadError')}</div>
        </Card>
      )}

      {!loading && !loadError && rules.length === 0 && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ ...TX.title, marginBottom: 4 }}>{t('rules.suggestedTitle')}</div>
          <div style={{ ...TX.helperMuted, marginBottom: 14 }}>
            {t('rules.suggestedSub')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUGGESTED.map(s => ({ ...s, name: t(`rules.suggested.${s.key}`) })).map(s => (
              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={TX.bodySub}>
                  {t('rules.suggestedLine', { name: s.name, metric: metricLabel(s.metric), comparator: comparatorLabel(s.comparator), threshold: formatNumber(s.threshold) })}
                </span>
                <Btn size="sm" variant="secondary" onClick={() => addRule(s)}>{t('rules.add')}</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ ...TX.title, marginBottom: 14 }}>{t('rules.newRule')}</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr 1fr 0.8fr 1fr auto',
          gap: 10, alignItems: 'end',
        }}>
          <Inp label={t('rules.name')} value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <SelInput label={t('rules.when')} value={draft.metric} onChange={e => setDraft(d => ({ ...d, metric: e.target.value }))}>
            {METRICS.map(v => <option key={v} value={v}>{metricLabel(v)}</option>)}
          </SelInput>
          <SelInput label={t('rules.condition')} value={draft.comparator} onChange={e => setDraft(d => ({ ...d, comparator: e.target.value }))}>
            {COMPARATORS.map(v => <option key={v} value={v}>{comparatorLabel(v)}</option>)}
          </SelInput>
          <Inp label={t('rules.value')} type="number" value={draft.threshold} onChange={e => setDraft(d => ({ ...d, threshold: e.target.value }))} />
          <SelInput label={t('rules.then')} value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))}>
            <option value="notify">{t('rules.notify')}</option>
            <option value="pause_campaign">{t('rules.pause')}</option>
          </SelInput>
          <Btn onClick={() => addRule(draft)}>{t('rules.addRule')}</Btn>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map(r => (
          <Card key={r.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: T.base, fontWeight: 600, color: r.enabled ? C.text : C.textMuted, fontFamily: F.sans }}>{r.name}</div>
              <div style={{ ...TX.caption, marginTop: 2 }}>
                {metricLabel(r.metric)} {comparatorLabel(r.comparator)} {formatNumber(r.threshold)}
                {' · '}{r.action === 'pause_campaign' ? t('rules.pauses') : t('rules.notifies')}
                {r.last_fired_at && t('rules.lastFired', { date: formatDateTime(r.last_fired_at) })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="secondary" onClick={() => toggle(r)}>{r.enabled ? t('rules.disable') : t('rules.enable')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => remove(r)}>{t('common.remove')}</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
