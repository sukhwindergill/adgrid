import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T } from '../../design/tokens.js';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';
import { SelInput } from '../primitives/SelInput.jsx';
import { useToast } from '../primitives/Toast.jsx';
import { MAX_RECIPIENTS, nextRunAt, parseRecipients, describeSchedule } from '../../lib/reportSchedule.js';

// Recurring report emails (report_schedules, sent by report-schedule-cron).
// Lists this campaign's schedules plus the owner's all-campaigns ones, since
// those cover this campaign too. Editing is delete + create; the table has
// no client UPDATE grant.
function fetchSchedules(userId, audience, campaignId) {
  return supabase
    .from('report_schedules')
    .select('id, scope, campaign_id, frequency, recipients, next_run_at, last_sent_at, last_error')
    .eq('owner_id', userId)
    .eq('audience', audience)
    .or(`campaign_id.eq.${campaignId},scope.eq.all`)
    .order('created_at', { ascending: false });
}

export function ScheduledReportsSection({ campaignId, userId, audience }) {
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [scope, setScope] = useState('campaign');
  const [recipients, setRecipients] = useState('');
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const apply = ({ data, error }) => {
    setLoadError(Boolean(error));
    setSchedules(data ?? []);
  };
  const load = () => fetchSchedules(userId, audience, campaignId).then(apply);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    fetchSchedules(userId, audience, campaignId).then(res => {
      if (cancelled) return;
      setLoadError(Boolean(res.error));
      setSchedules(res.data ?? []);
    });
    return () => { cancelled = true; };
  }, [campaignId, userId, audience]);

  const create = async () => {
    const { emails, error } = parseRecipients(recipients);
    if (error) { setFormError(error); return; }
    setFormError(null);
    setSaving(true);
    const { error: insertError } = await supabase.from('report_schedules').insert({
      owner_id: userId,
      audience,
      scope,
      campaign_id: scope === 'campaign' ? campaignId : null,
      frequency,
      recipients: emails,
      next_run_at: nextRunAt(frequency).toISOString(),
    });
    setSaving(false);
    if (insertError) { toast.error(insertError.message); return; }
    toast.success('Report scheduled');
    setRecipients('');
    load();
  };

  const remove = async (id) => {
    const { error } = await supabase.from('report_schedules').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Schedule removed');
    load();
  };

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 18 }}>
      <div style={{ fontSize: T.md, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Scheduled reports</div>
      <div style={{ fontSize: T.sm, color: C.textMuted, fontFamily: F.sans, marginBottom: 14 }}>
        Email a KPI summary, a report link and a CSV of daily delivery to up to {MAX_RECIPIENTS} people.
        Weekly reports cover the previous seven days; monthly reports cover the previous calendar month.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <SelInput label="Frequency" aria-label="Frequency" value={frequency} onChange={e => setFrequency(e.target.value)}>
          <option value="weekly">Weekly (Mondays)</option>
          <option value="monthly">Monthly (1st)</option>
        </SelInput>
        <SelInput label="Covers" aria-label="Covers" value={scope} onChange={e => setScope(e.target.value)}>
          <option value="campaign">This campaign</option>
          <option value="all">{audience === 'operator' ? 'All campaigns on my screens' : 'All my campaigns'}</option>
        </SelInput>
      </div>
      <Inp
        label="Recipients"
        placeholder="name@agency.com, client@brand.ca"
        value={recipients}
        onChange={e => { setRecipients(e.target.value); setFormError(null); }}
        hint={`Separate addresses with commas. Up to ${MAX_RECIPIENTS}.`}
        error={formError}
      />
      <Btn onClick={create} disabled={saving} style={{ marginTop: 10 }}>{saving ? 'Scheduling…' : 'Schedule report'}</Btn>

      {loadError && (
        <div style={{ fontSize: T.sm, color: C.red, fontFamily: F.sans, marginTop: 12 }}>
          Couldn't load scheduled reports — check your connection and try again.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {schedules.map(s => (
          <div key={s.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.base, color: C.text, fontFamily: F.sans, fontWeight: 600 }}>
                {describeSchedule(s.frequency)} · {s.scope === 'all' ? 'all campaigns' : 'this campaign'}
              </div>
              <div style={{ fontSize: T.xs, color: C.textSub, fontFamily: F.mono, wordBreak: 'break-all', margin: '2px 0' }}>
                {(s.recipients ?? []).join(', ')}
              </div>
              <div style={{ fontSize: T.xs, color: C.textMuted, fontFamily: F.sans }}>
                Next {new Date(s.next_run_at).toLocaleDateString()}
                {s.last_sent_at ? ` · last sent ${new Date(s.last_sent_at).toLocaleDateString()}` : ''}
              </div>
              {s.last_error && (
                <div style={{ fontSize: T.xs, color: C.red, fontFamily: F.sans, marginTop: 2 }}>Last send failed — it will try again next period.</div>
              )}
            </div>
            <Btn size="sm" variant="ghost" onClick={() => remove(s.id)}>Remove</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}
