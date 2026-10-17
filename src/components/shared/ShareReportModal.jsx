import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Modal } from '../primitives/Modal.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { CopyButton } from '../primitives/CopyButton.jsx';
import { useToast } from '../primitives/Toast.jsx';
import { ScheduledReportsSection } from './ScheduledReportsSection.jsx';
import { useT } from '../../i18n/useT.js';

// base64url token, generated client-side. The value is only ever a lookup key
// for the campaign-report function; it grants nothing on its own, and the
// function re-checks revocation and expiry on every request.
function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const DEFAULT_DAYS = 90;

export function ShareReportModal({ campaignId, userId, audience = 'advertiser', onClose }) {
  const toast = useToast();
  const { t, formatDate } = useT();
  const [links, setLinks] = useState([]);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('campaign_share_tokens')
      .select('token, expires_at, revoked_at, view_count, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
    setLoadError(Boolean(error));
    setLinks(data ?? []);
  };

  // Trips react-hooks/set-state-in-effect, the same way every other
  // data-loading view in this app does. Matching the established pattern
  // rather than introducing a one-off structure here.
  useEffect(() => { load(); }, [campaignId]);

  const create = async () => {
    const token = newToken();
    const expires = new Date(Date.now() + DEFAULT_DAYS * 86_400_000).toISOString();
    const { error } = await supabase.from('campaign_share_tokens').insert({
      token, campaign_id: campaignId, created_by: userId, expires_at: expires,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t('widgets.share.created'));
    load();
  };

  const revoke = async (token) => {
    const { error } = await supabase
      .from('campaign_share_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token);
    if (error) { toast.error(error.message); return; }
    toast.success(t('widgets.share.revokedToast'));
    load();
  };

  const urlFor = (token) => `${window.location.origin}/report/${token}`;

  return (
    <Modal title={t('widgets.share.title')} maxWidth={560} padding={24} zIndex={100} headerStyle={{ marginBottom: 4 }}
      panelStyle={{ borderRadius: 12, border: `1px solid ${C.border}`, maxHeight: '80vh', boxShadow: 'none' }}>
        <div style={{ ...TX.helperMuted, marginBottom: 18 }}>
          {t('widgets.share.body')}
          Links expire after {DEFAULT_DAYS} days and can be revoked at any time.
        </div>

        <Btn onClick={create} style={{ marginBottom: 18 }}>{t('widgets.share.create')}</Btn>

        {loadError && (
          <div style={{ ...TX.error, marginBottom: 12 }}>
            {t('widgets.share.loadError')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {links.map(l => {
            const dead = Boolean(l.revoked_at) || (l.expires_at && new Date(l.expires_at) <= new Date());
            return (
              <div key={l.token} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: T.xs, fontFamily: F.mono, color: dead ? C.textMuted : C.textSub, wordBreak: 'break-all', textDecoration: dead ? 'line-through' : 'none' }}>
                  {urlFor(l.token)}
                </div>
                <div style={{ ...TX.caption, margin: '4px 0 8px' }}>
                  {l.revoked_at ? t('widgets.share.revoked') : l.expires_at ? t('widgets.share.expires', { date: formatDate(l.expires_at) }) : t('widgets.share.noExpiry')}
                  {t('widgets.share.views', { count: l.view_count })}
                </div>
                {!dead && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CopyButton
                      value={urlFor(l.token)}
                      label={t('ui.copy')}
                      size="sm"
                      onCopied={() => toast.success(t('widgets.share.linkCopied'))}
                      onError={() => toast.error(t('widgets.share.copyFailed'))}
                    />
                    <Btn size="sm" variant="ghost" onClick={() => revoke(l.token)}>{t('widgets.share.revoke')}</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ScheduledReportsSection campaignId={campaignId} userId={userId} audience={audience} />

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Btn variant="secondary" onClick={onClose}>{t('common.close')}</Btn>
        </div>
    </Modal>
  );
}
