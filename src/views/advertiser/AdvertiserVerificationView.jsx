import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';

const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_DOC_MB = 10;
const MIME_TO_EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export function AdvertiserVerificationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [businessDomain, setBusinessDomain] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docErr, setDocErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('advertiser_verifications')
      .select('id, status, tier, rejection_reason, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest(data ?? null);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDocFile = (file) => {
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) { setDocErr('Use JPG, PNG, or PDF.'); return; }
    if (file.size > MAX_DOC_MB * 1024 * 1024) { setDocErr(`File too large — max ${MAX_DOC_MB} MB.`); return; }
    setDocErr(null);
    setDocFile(file);
  };

  const submit = async () => {
    if (!companyName.trim() || !businessDomain.trim()) {
      toast.error('Company name and business domain are required.');
      return;
    }
    setSubmitting(true);

    let docStoragePath = null;
    if (docFile) {
      const dotExt = docFile.name.includes('.') ? docFile.name.split('.').pop().toLowerCase() : null;
      const ext = dotExt || MIME_TO_EXT[docFile.type] || 'pdf';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('advertiser-docs')
        .upload(path, docFile, { contentType: docFile.type, upsert: false });
      if (uploadErr) { toast.error(uploadErr.message); setSubmitting(false); return; }
      docStoragePath = path;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Session expired. Please log in again.'); setSubmitting(false); return; }

    const cleanupOrphan = () => {
      if (docStoragePath) {
        supabase.storage.from('advertiser-docs').remove([docStoragePath]).catch(() => {});
      }
    };

    let res;
    try {
      res = await fetch(`${SUPABASE_FUNCTIONS_URL}/submit-advertiser-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ companyName, businessNumber: businessNumber || null, businessDomain, docStoragePath }),
      });
    } catch {
      cleanupOrphan();
      setSubmitting(false);
      toast.error('Network error — please try again.');
      return;
    }
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      cleanupOrphan();
      toast.error(body?.error ?? 'Submission failed.');
      return;
    }
    toast.success(body.tier === 'domain_match' ? 'Verified!' : 'Submitted for review.');
    refresh();
  };

  if (loading) return null;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app/settings')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </Btn>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: F.display, marginBottom: 20 }}>
        Business Verification
      </h1>

      {profile?.is_verified_advertiser ? (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <Badge status="active">Verified advertiser</Badge>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>
            Operators see a verified badge on your campaigns and may auto-approve your work.
          </div>
        </Card>
      ) : latest?.status === 'pending_manual' ? (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <Badge status="pending">Under review</Badge>
          <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>
            We're reviewing your submission. You'll be notified once it's decided.
          </div>
        </Card>
      ) : (
        <>
          {latest?.status === 'rejected' && (
            <Card style={{ padding: 16, marginBottom: 20, borderColor: C.redBorder }}>
              <Badge status="rejected">Rejected</Badge>
              {latest.rejection_reason && (
                <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>{latest.rejection_reason}</div>
              )}
              <div style={{ fontSize: 12, color: C.textSub, fontFamily: F.sans, marginTop: 8 }}>You can resubmit below.</div>
            </Card>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Company name</div>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>Business domain</div>
            <input type="text" placeholder="acme.com" value={businessDomain} onChange={e => setBusinessDomain(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 13 }} />
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: F.sans, marginTop: 4 }}>
              Matches your account email domain? You're verified instantly.
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
              Business number <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional)</span>
            </div>
            <input type="text" value={businessNumber} onChange={e => setBusinessNumber(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: 13 }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textMid, fontFamily: F.sans, marginBottom: 6 }}>
              Business license/registration doc <span style={{ color: C.textMuted, fontWeight: 400 }}>(optional — if domain doesn't match)</span>
            </div>
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => handleDocFile(e.target.files?.[0])} />
            {docFile && <div style={{ fontSize: 12, color: C.text, fontFamily: F.sans, marginTop: 6 }}>{docFile.name}</div>}
            {docErr && <div style={{ fontSize: 12, color: C.red, fontFamily: F.sans, marginTop: 6 }}>{docErr}</div>}
          </div>

          <Btn variant="primary" disabled={submitting} onClick={submit}>
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </Btn>
        </>
      )}
    </div>
  );
}
