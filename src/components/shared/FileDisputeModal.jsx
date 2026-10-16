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

export function FileDisputeModal({ bookingId, advertiserId, onClose, onFiled }) {
  const [reasonCode, setReasonCode] = useState(DISPUTE_REASONS[0].value);
  const [reasonText, setReasonText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (!isValidDisputeReason(reasonCode)) { setError('Choose a reason.'); return; }
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
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 299 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: '32px 28px', width: 420, zIndex: 300,
      }}>
        <h3 style={{ fontSize: T.lg, fontWeight: 700, color: C.text, fontFamily: F.display, margin: '0 0 20px' }}>
          Report a Problem
        </h3>

        {success ? (
          <>
            <p style={{ fontSize: T.md, color: C.greenText, fontFamily: F.sans, margin: '0 0 20px' }}>
              ✓ We've received your report and will follow up by email.
            </p>
            <button onClick={() => { onClose(); onFiled?.(); }} style={{ padding: '9px 22px', borderRadius: 8, background: C.purple, color: C.white, border: 'none', fontFamily: F.sans, fontSize: T.base, cursor: 'pointer' }}>
              Done
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...TX.body, display: 'block', fontWeight: 500, marginBottom: 6 }}>
                What happened?
              </label>
              <select
                value={reasonCode}
                onChange={e => setReasonCode(e.target.value)}
                style={{ ...TX.body, width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, outline: 'none' }}
              >
                {DISPUTE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ ...TX.body, display: 'block', fontWeight: 500, marginBottom: 6 }}>
                Details (optional)
              </label>
              <textarea
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Anything that helps us look into it — dates, what you expected to see, etc."
                style={{ ...TX.body, width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
              />
            </div>

            {error && (
              <div style={{ fontSize: T.base, color: C.redText, fontFamily: F.sans, marginBottom: 14 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ ...TX.bodySub, padding: '9px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving} style={{ padding: '9px 22px', borderRadius: 8, background: C.purple, color: C.white, border: 'none', fontFamily: F.sans, fontSize: T.base, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
