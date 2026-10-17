import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { useToast } from '../../components/primitives/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { useT } from '../../i18n/useT.js';

const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_DOC_MB = 10;
const MIME_TO_EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export function AdvertiserVerificationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();
  const { t } = useT();
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
    if (!ALLOWED_DOC_TYPES.includes(file.type)) { setDocErr(t('verify.badType')); return; }
    if (file.size > MAX_DOC_MB * 1024 * 1024) { setDocErr(t('verify.tooLarge', { max: MAX_DOC_MB })); return; }
    setDocErr(null);
    setDocFile(file);
  };

  const submit = async () => {
    if (!companyName.trim() || !businessDomain.trim()) {
      toast.error(t('verify.required'));
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

    const cleanupOrphan = () => {
      if (docStoragePath) {
        supabase.storage.from('advertiser-docs').remove([docStoragePath]).catch(() => {});
      }
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { cleanupOrphan(); toast.error(t('verify.sessionExpired')); setSubmitting(false); return; }

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
      toast.error(t('verify.network'));
      return;
    }
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      cleanupOrphan();
      toast.error(body?.error ?? t('verify.failed'));
      return;
    }
    toast.success(body.tier === 'domain_match' ? t('verify.verified') : t('verify.submitted'));
    refresh();
  };

  if (loading) return null;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <Btn variant="ghost" onClick={() => navigate('/app/settings')} style={{ marginBottom: 16, paddingLeft: 0 }}>
        {t('verify.back')}
      </Btn>
      <h1 style={{ ...TX.pageTitle, marginBottom: 20 }}>
        {t('verify.title')}
      </h1>

      {profile?.is_verified_advertiser ? (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <Badge status="active">{t('verify.verifiedBadge')}</Badge>
          <div style={{ ...TX.helper, marginTop: 8 }}>
            {t('verify.verifiedBody')}
          </div>
        </Card>
      ) : latest?.status === 'pending_manual' ? (
        <Card style={{ padding: 16, marginBottom: 20 }}>
          <Badge status="pending">{t('verify.reviewBadge')}</Badge>
          <div style={{ ...TX.helper, marginTop: 8 }}>
            {t('verify.reviewBody')}
          </div>
        </Card>
      ) : (
        <>
          {latest?.status === 'rejected' && (
            <Card style={{ padding: 16, marginBottom: 20, borderColor: C.redBorder }}>
              <Badge status="rejected">{t('verify.rejectedBadge')}</Badge>
              {latest.rejection_reason && (
                <div style={{ ...TX.helper, marginTop: 8 }}>{latest.rejection_reason}</div>
              )}
              <div style={{ ...TX.helper, marginTop: 8 }}>{t('verify.resubmit')}</div>
            </Card>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ ...TX.label, marginBottom: 6 }}>{t('verify.companyName')}</div>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: T.base }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ ...TX.label, marginBottom: 6 }}>{t('verify.domain')}</div>
            <input type="text" placeholder={t('verify.domainPlaceholder')} value={businessDomain} onChange={e => setBusinessDomain(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: T.base }} />
            <div style={{ ...TX.caption, marginTop: 4 }}>
              {t('verify.domainHint')}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ ...TX.label, marginBottom: 6 }}>
              {t('verify.businessNumber')} <span style={{ color: C.textMuted, fontWeight: 400 }}>{t('common.optional')}</span>
            </div>
            <input type="text" value={businessNumber} onChange={e => setBusinessNumber(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: F.sans, fontSize: T.base }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ ...TX.label, marginBottom: 6 }}>
              {t('verify.doc')} <span style={{ color: C.textMuted, fontWeight: 400 }}>{t('verify.docOptional')}</span>
            </div>
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => handleDocFile(e.target.files?.[0])} />
            {docFile && <div style={{ fontSize: T.sm, color: C.text, fontFamily: F.sans, marginTop: 6 }}>{docFile.name}</div>}
            {docErr && <div style={{ ...TX.error, marginTop: 6 }}>{docErr}</div>}
          </div>

          <Btn variant="primary" disabled={submitting} onClick={submit}>
            {submitting ? t('common.submitting') : t('verify.submit')}
          </Btn>
        </>
      )}
    </div>
  );
}
