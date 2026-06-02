import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { SUPABASE_FUNCTIONS_URL } from '../../lib/constants.js';
import { C, F } from '../../design/tokens.js';
import { Card } from '../../components/primitives/Card.jsx';
import { Btn } from '../../components/primitives/Btn.jsx';
import { PageHeader } from '../../components/primitives/PageHeader.jsx';
import { Badge } from '../../components/primitives/Badge.jsx';
import { InviteOperatorModal } from '../../components/operator/InviteOperatorModal.jsx';

function statusLabel(s) {
  switch (s) {
    case 'unverified':     return { label: 'Unverified',    color: C.textMuted, bg: C.surfaceAlt };
    case 'pending_stripe': return { label: 'Pending Stripe', color: C.amber,    bg: C.amberSoft };
    case 'pending_manual': return { label: 'Needs review',  color: C.blue,      bg: C.blueSoft };
    case 'verified':       return { label: 'Verified',      color: C.green,     bg: C.greenSoft };
    case 'rejected':       return { label: 'Rejected',      color: C.red,       bg: C.redSoft };
    default:               return { label: s,               color: C.textMuted, bg: C.surfaceAlt };
  }
}

function StatusChip({ status }) {
  const { label, color, bg } = statusLabel(status);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      background: bg, color, fontFamily: F.sans, fontSize: 11, fontWeight: 600,
    }}>{label}</span>
  );
}

function ReviewModal({ operator, onClose, onDecision }) {
  const [decision, setDecision] = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const submit = async () => {
    if (!decision) { setError('Select a decision.'); return; }
    setSaving(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manual-review-operator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ operatorId: operator.id, decision, notes }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? 'Failed to submit review.'); return; }
    onDecision(operator.id, decision === 'approved' ? 'verified' : 'rejected', notes);
    onClose();
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 16, color: C.text }}>
            Review: {operator.name ?? operator.email}
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Email</div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.text }}>{operator.email}</div>
        </div>

        {operator.company_name && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Company</div>
            <div style={{ fontFamily: F.sans, fontSize: 13, color: C.text }}>{operator.company_name}</div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Current status</div>
          <StatusChip status={operator.verification_status} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>Decision</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['approved', 'rejected'].map(d => (
              <button
                key={d}
                onClick={() => setDecision(d)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontFamily: F.sans,
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  border: `2px solid ${decision === d ? (d === 'approved' ? C.green : C.red) : C.border}`,
                  background: decision === d ? (d === 'approved' ? C.greenSoft : C.redSoft) : C.surface,
                  color: decision === d ? (d === 'approved' ? C.green : C.red) : C.textSub,
                }}
              >
                {d === 'approved' ? '✓ Approve' : '✗ Reject'}
              </button>
            ))}
          </div>
        </div>

        {decision === 'rejected' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
              Reason (shown to operator)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. ID photo was blurry — please resubmit with a clearer image."
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', borderRadius: 8,
                border: `1px solid ${C.border}`, padding: '10px 12px',
                fontFamily: F.sans, fontSize: 13, color: C.text, resize: 'vertical',
                background: C.surface,
              }}
            />
          </div>
        )}

        {decision === 'approved' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontFamily: F.sans, fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>
              Notes (internal)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional internal notes..."
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', borderRadius: 8,
                border: `1px solid ${C.border}`, padding: '10px 12px',
                fontFamily: F.sans, fontSize: 13, color: C.text, resize: 'vertical',
                background: C.surface,
              }}
            />
          </div>
        )}

        {error && (
          <div style={{
            background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontFamily: F.sans, fontSize: 13, color: C.red,
          }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} loading={saving} disabled={!decision}>Submit decision</Btn>
        </div>
      </div>
    </div>
  );
}

export function VerificationQueue() {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [inviting, setInviting]   = useState(false);
  const [reviewing, setReviewing] = useState(null); // operator object

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, name, company_name, verification_status, verified_at, created_at')
      .eq('role', 'operator')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperators(data ?? []);
        setLoading(false);
      });
  }, []);

  const handleDecision = (id, newStatus) => {
    setOperators(prev => prev.map(op => op.id === id ? { ...op, verification_status: newStatus } : op));
  };

  const pending = operators.filter(op =>
    op.verification_status === 'pending_manual' || op.verification_status === 'pending_stripe'
  );
  const others = operators.filter(op =>
    op.verification_status !== 'pending_manual' && op.verification_status !== 'pending_stripe'
  );

  return (
    <div>
      <PageHeader
        title="Operator verification"
        subtitle="Review identity submissions and invite new screen operators"
        action={<Btn onClick={() => setInviting(true)}>Invite operator</Btn>}
      />

      {pending.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>
            Needs review ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(op => (
              <Card key={op.id} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 14, color: C.text }}>
                    {op.name ?? op.email}
                  </div>
                  {op.name && (
                    <div style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {op.email}
                    </div>
                  )}
                </div>
                <StatusChip status={op.verification_status} />
                <Btn size="sm" onClick={() => setReviewing(op)}>Review</Btn>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>
          All operators ({operators.length})
        </div>
        {loading ? (
          <Card style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontFamily: F.sans, fontSize: 13 }}>
            Loading…
          </Card>
        ) : operators.length === 0 ? (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textMuted, marginBottom: 16 }}>
              No operators yet. Invite your first screen owner.
            </div>
            <Btn onClick={() => setInviting(true)}>Invite operator</Btn>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {others.map(op => (
              <Card key={op.id} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 13, color: C.text }}>
                    {op.name ?? op.email}
                  </div>
                  {op.name && (
                    <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                      {op.email}
                    </div>
                  )}
                </div>
                <StatusChip status={op.verification_status} />
                {op.verification_status === 'pending_manual' && (
                  <Btn size="sm" onClick={() => setReviewing(op)}>Review</Btn>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {inviting && (
        <InviteOperatorModal
          onClose={() => setInviting(false)}
          onInvited={() => {}}
        />
      )}
      {reviewing && (
        <ReviewModal
          operator={reviewing}
          onClose={() => setReviewing(null)}
          onDecision={handleDecision}
        />
      )}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modal = {
  background: C.surface, borderRadius: 14, padding: 28, width: '100%', maxWidth: 480,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto',
};

const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: C.textMuted, fontSize: 16, padding: 4, lineHeight: 1,
};
