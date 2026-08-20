import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../primitives/Card.jsx';
import { Btn } from '../primitives/Btn.jsx';
import { CopyButton } from '../primitives/CopyButton.jsx';
import { useToast } from '../primitives/Toast.jsx';

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

export function ShareReportModal({ campaignId, userId, onClose }) {
  const toast = useToast();
  const [links, setLinks] = useState([]);

  const load = async () => {
    const { data } = await supabase
      .from('campaign_share_tokens')
      .select('token, expires_at, revoked_at, view_count, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });
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
    toast.success('Share link created');
    load();
  };

  const revoke = async (token) => {
    const { error } = await supabase
      .from('campaign_share_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token);
    if (error) { toast.error(error.message); return; }
    toast.success('Link revoked');
    load();
  };

  const urlFor = (token) => `${window.location.origin}/report/${token}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <Card style={{ padding: 24, width: 'min(560px, 92vw)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: F.sans, marginBottom: 4 }}>Share this report</div>
        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: F.sans, marginBottom: 18 }}>
          Anyone with the link can view delivery results for this campaign — no sign-in, and no account or billing data.
          Links expire after {DEFAULT_DAYS} days and can be revoked at any time.
        </div>

        <Btn onClick={create} style={{ marginBottom: 18 }}>Create share link</Btn>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {links.map(l => {
            const dead = Boolean(l.revoked_at) || (l.expires_at && new Date(l.expires_at) <= new Date());
            return (
              <div key={l.token} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontFamily: F.mono, color: dead ? C.textMuted : C.textSub, wordBreak: 'break-all', textDecoration: dead ? 'line-through' : 'none' }}>
                  {urlFor(l.token)}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, margin: '4px 0 8px' }}>
                  {l.revoked_at ? 'Revoked' : l.expires_at ? `Expires ${new Date(l.expires_at).toLocaleDateString()}` : 'No expiry'}
                  {' · '}{l.view_count} view{l.view_count === 1 ? '' : 's'}
                </div>
                {!dead && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CopyButton
                      value={urlFor(l.token)}
                      label="Copy"
                      size="sm"
                      onCopied={() => toast.success('Link copied')}
                    />
                    <Btn size="sm" variant="ghost" onClick={() => revoke(l.token)}>Revoke</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </Card>
    </div>
  );
}
