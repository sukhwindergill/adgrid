import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Inp } from '../../components/primitives/Inp.jsx';
import { SelInput } from '../../components/primitives/SelInput.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useBreakpoint } from '../../lib/useBreakpoint.js';

const METRIC_LABELS = {
  cost_per_scan:          'Cost per scan',
  pacing_ratio:           'Pacing (1.0 = on pace)',
  offline_screen_minutes: 'Screen offline (minutes)',
  billable_scans:         'Billable scans',
  plays:                  'Plays',
  delivery_pct:           'Delivery %',
};

const COMPARATOR_LABELS = { gt: 'is above', gte: 'is at or above', lt: 'is below', lte: 'is at or below' };

// Sensible starting rules, offered as one-click adds rather than silently
// created — a rule that can pause a campaign should never appear by surprise.
const SUGGESTED = [
  { name: 'Screen dark during my flight', metric: 'offline_screen_minutes', comparator: 'gt', threshold: 120, action: 'notify' },
  { name: 'Pacing behind schedule',       metric: 'pacing_ratio',           comparator: 'lt', threshold: 0.6, action: 'notify' },
  { name: 'Cost per scan too high',       metric: 'cost_per_scan',          comparator: 'gt', threshold: 5,   action: 'notify' },
];

const EMPTY_DRAFT = { name: '', metric: 'cost_per_scan', comparator: 'gt', threshold: '', action: 'notify' };

export function AutomationRulesView({ user, ownerSide = 'advertiser' }) {
  const toast = useToast();
  const { isMobile } = useBreakpoint();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  // `loading` starts true and is only cleared once, so a refresh after
  // add/toggle/remove just swaps the list rather than flashing a spinner.
  //
  // The mount effect below trips react-hooks/set-state-in-effect, the same way
  // every other data-loading view in this app does (App.jsx, ScreenDetail,
  // OperatorSettingsView). Matching the established pattern rather than
  // introducing a one-off structure here.
  const load = async () => {
    const { data } = await supabase
      .from('automation_rules')
      .select('id, name, metric, comparator, threshold, action, enabled, last_fired_at, last_fired_value')
      .order('created_at', { ascending: false });
    setRules(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addRule = async (rule) => {
    const threshold = Number(rule.threshold);
    if (!rule.name.trim() || rule.threshold === '' || !Number.isFinite(threshold)) {
      toast.error('Give the rule a name and a numeric threshold.');
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
    if (error) { toast.error(`Could not save rule: ${error.message}`); return; }
    toast.success('Rule added');
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
    toast.success('Rule removed');
    load();
  };

  return (
    <div>
      <PageHeader title="Alerts & Rules" subtitle="Get told when something is wrong — or have AdGrid act on it for you" />

      {!loading && rules.length === 0 && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Suggested rules</div>
          <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
            Add any of these in one click. You can change or remove them later.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUGGESTED.map(s => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: C.textSub, fontFamily: F.sans }}>
                  {s.name} — notify when {METRIC_LABELS[s.metric]} {COMPARATOR_LABELS[s.comparator]} {s.threshold}
                </span>
                <Btn size="sm" variant="secondary" onClick={() => addRule(s)}>Add</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: F.sans, marginBottom: 14 }}>New rule</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr 1fr 0.8fr 1fr auto',
          gap: 10, alignItems: 'end',
        }}>
          <Inp label="Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <SelInput label="When" value={draft.metric} onChange={e => setDraft(d => ({ ...d, metric: e.target.value }))}>
            {Object.entries(METRIC_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelInput>
          <SelInput label="Condition" value={draft.comparator} onChange={e => setDraft(d => ({ ...d, comparator: e.target.value }))}>
            {Object.entries(COMPARATOR_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </SelInput>
          <Inp label="Value" type="number" value={draft.threshold} onChange={e => setDraft(d => ({ ...d, threshold: e.target.value }))} />
          <SelInput label="Then" value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))}>
            <option value="notify">Notify me</option>
            <option value="pause_campaign">Pause the campaign</option>
          </SelInput>
          <Btn onClick={() => addRule(draft)}>Add rule</Btn>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map(r => (
          <Card key={r.id} style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: r.enabled ? C.text : C.textMuted, fontFamily: F.sans }}>{r.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 2 }}>
                {METRIC_LABELS[r.metric] ?? r.metric} {COMPARATOR_LABELS[r.comparator] ?? r.comparator} {r.threshold}
                {' · '}{r.action === 'pause_campaign' ? 'pauses the campaign' : 'notifies you'}
                {r.last_fired_at && ` · last fired ${new Date(r.last_fired_at).toLocaleString()}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn size="sm" variant="secondary" onClick={() => toggle(r)}>{r.enabled ? 'Disable' : 'Enable'}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => remove(r)}>Remove</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
