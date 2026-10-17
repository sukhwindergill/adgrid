import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Btn } from '../primitives/Btn.jsx';
import { Inp } from '../primitives/Inp.jsx';
import { SelInput } from '../primitives/SelInput.jsx';
import { useToast } from '../primitives/Toast.jsx';
import { MAX_RECIPIENTS, nextRunAt, parseRecipients } from '../../lib/reportSchedule.js';
import { useT } from '../../i18n/useT.js';

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
  const { t, formatDate } = useT();
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
    toast.success(t('widgets.reports.scheduled'));
    setRecipients('');
    load();
  };

  const remove = async (id) => {
    const { error } = await supabase.from('report_schedules').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('widgets.reports.removed'));
    load();
  };

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 18 }}>
      <div style={{ fontSize: T.md, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>{t('widgets.reports.title')}</div>
      <div style={{ ...TX.helperMuted, marginBottom: 14 }}>
        {t('widgets.reports.body', { max: MAX_RECIPIENTS })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <SelInput label={t('widgets.reports.frequency')} aria-label={t('widgets.reports.frequency')} value={frequency} onChange={e => setFrequency(e.target.value)}>
          <option value="weekly">{t('widgets.reports.weekly')}</option>
          <option value="monthly">{t('widgets.reports.monthly')}</option>
        </SelInput>
        <SelInput label={t('widgets.reports.covers')} aria-label={t('widgets.reports.covers')} value={scope} onChange={e => setScope(e.target.value)}>
          <option value="campaign">{t('widgets.reports.thisCampaign')}</option>
          <option value="all">{audience === 'operator' ? t('widgets.reports.allOnMyScreens') : t('widgets.reports.allMine')}</option>
        </SelInput>
      </div>
      <Inp
        label={t('widgets.reports.recipients')}
        placeholder={t('widgets.reports.recipientsPlaceholder')}
        value={recipients}
        onChange={e => { setRecipients(e.target.value); setFormError(null); }}
        hint={t('widgets.reports.recipientsHint', { max: MAX_RECIPIENTS })}
        error={formError}
      />
      <Btn onClick={create} disabled={saving} style={{ marginTop: 10 }}>{saving ? t('widgets.reports.scheduling') : t('widgets.reports.schedule')}</Btn>

      {loadError && (
        <div style={{ ...TX.error, marginTop: 12 }}>
          {t('widgets.reports.loadError')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {schedules.map(s => (
          <div key={s.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={TX.strong}>
                {s.frequency === 'weekly' ? t('widgets.reports.everyMonday') : t('widgets.reports.monthlyFirst')} · {s.scope === 'all' ? t('widgets.reports.scopeAll') : t('widgets.reports.scopeCampaign')}
              </div>
              <div style={{ ...TX.mono, wordBreak: 'break-all', margin: '2px 0' }}>
                {(s.recipients ?? []).join(', ')}
              </div>
              <div style={TX.caption}>
                {t('widgets.reports.next', { date: formatDate(s.next_run_at) })}
                {s.last_sent_at ? t('widgets.reports.lastSent', { date: formatDate(s.last_sent_at) }) : ''}
              </div>
              {s.last_error && (
                <div style={{ fontSize: T.xs, color: C.redText, fontFamily: F.sans, marginTop: 2 }}>{t('widgets.reports.lastFailed')}</div>
              )}
            </div>
            <Btn size="sm" variant="ghost" onClick={() => remove(s.id)}>{t('common.remove')}</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}
