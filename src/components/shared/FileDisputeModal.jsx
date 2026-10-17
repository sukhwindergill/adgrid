// src/components/shared/FileDisputeModal.jsx
// Spec #2 (dispute & refund workflow), advertiser-facing filing surface.
// Inserts directly into `disputes` -- RLS (advertiser_files_own_disputes)
// scopes the insert to the caller's own advertiser_id, and there is
// deliberately no client UPDATE policy: resolution only ever happens
// through resolve-dispute (service role), so an advertiser can raise a
// claim but never resolve or refund it themselves.
import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { C, F, T } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { DISPUTE_REASONS, isValidDisputeReason } from '../../lib/disputeReasons.js';
import { Btn } from '../primitives/Btn.jsx';
import { Modal } from '../primitives/Modal.jsx';
import { SelInput } from '../primitives/SelInput.jsx';
import { TextArea } from '../primitives/Inp.jsx';
import { useT } from '../../i18n/useT.js';

const actionBtn = { padding: '9px 22px' };

export function FileDisputeModal({ bookingId, advertiserId, onClose, onFiled }) {
  const { t, tOr } = useT();
  const [reasonCode, setReasonCode] = useState(DISPUTE_REASONS[0].value);
  const [reasonText, setReasonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (!isValidDisputeReason(reasonCode)) { setError(t('widgets.dispute.chooseReason')); return; }
    setSaving(true);
    setError(null);

    const { error: insertErr } = await supabase.from('disputes').insert({
      booking_id: bookingId,
      advertiser_id: advertiserId,
      reason_code: reasonCode,
      reason_text: reasonText.trim() || null,
    });

    setSaving(false);
    if (insertErr) { setError(insertErr.message); return; }
    setSuccess(true);
  }

  return (
    <Modal onBackdropClick={onClose} label={t('widgets.dispute.title')} maxWidth={420} padding="32px 28px" zIndex={300}
      panelStyle={{ borderRadius: 20, border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 20px' }}>
          {t('widgets.dispute.title')}
        </h3>

        {success ? (
          <>
            <p style={{ fontSize: T.md, color: C.greenText, fontFamily: F.sans, margin: '0 0 20px' }}>
              {t('widgets.dispute.received')}
            </p>
            <Btn onClick={() => { onClose(); onFiled?.(); }} style={actionBtn}>
              {t('widgets.dispute.done')}
            </Btn>
          </>
        ) : (
          <>
            <SelInput
              label={t('widgets.dispute.what')}
              value={reasonCode}
              onChange={e => setReasonCode(e.target.value)}
              wrapperStyle={{ marginBottom: 16 }}
              style={{ width: '100%' }}
            >
              {DISPUTE_REASONS.map(r => <option key={r.value} value={r.value}>{tOr(`widgets.dispute.reason.${r.value}`, r.label)}</option>)}
            </SelInput>

            <TextArea
              label={t('widgets.dispute.details')}
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder={t('widgets.dispute.detailsPlaceholder')}
              wrapperStyle={{ marginBottom: 20 }}
            />

            {error && (
              <div role="alert" style={{ ...TX.error, fontSize: T.base, marginBottom: 14 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={onClose} style={{ padding: '9px 18px', color: C.textSub }}>
                {t('common.cancel')}
              </Btn>
              <Btn onClick={submit} disabled={saving} style={actionBtn}>
                {saving ? t('common.submitting') : t('widgets.dispute.submit')}
              </Btn>
            </div>
          </>
        )}
    </Modal>
  );
}
