import { useState, useEffect } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useToast } from "../../components/primitives/Toast.jsx";
import { useConfirm } from "../../components/primitives/ConfirmModal.jsx";
import { useBreakpoint } from "../../lib/useBreakpoint.js";
import { useAuth } from "../../context/AuthContext.jsx";

const STATUS_COLORS = {
  paid: { bg: "#f0fdf4", color: "#16a34a" },
  open: { bg: "#fffbeb", color: "#d97706" },
  failed: { bg: "#fef2f2", color: "#dc2626" },
  void: { bg: "#f9fafb", color: "#6b7280" },
};

const REASON_LABEL = {
  screen_offline: "Screen was offline",
  underdelivered: "Screen under-delivered",
};

function Badge({ status }) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.void;
  return (
    <span style={{
      padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: style.bg, color: style.color, textTransform: "capitalize",
    }}>{status}</span>
  );
}

// profiles.credits is written by supabase/functions/reconcile-delivery when a
// screen under-delivers, but nothing in the advertiser UI ever showed the
// resulting balance or explained which day earned it — an advertiser could
// be sitting on real account credit with no way to know it exists.
function useDeliveryCredits() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes delivery_reconciliation to the caller's own campaigns
      // (advertiser_view_own_reconciliation), so no explicit filter needed.
      const { data: recon } = await supabase
        .from("delivery_reconciliation")
        .select("campaign_id, screen_id, day, reason, credit_amount, currency, credited_at")
        .gt("credit_amount", 0)
        .not("credited_at", "is", null)
        .order("day", { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (!recon || recon.length === 0) { setRows([]); setLoading(false); return; }

      // delivery_reconciliation stores raw campaign/screen ids — resolve the
      // human-readable names from bookings in a second pass rather than
      // relying on a PostgREST FK embed (bookings.id is referenced by more
      // than one table, which makes embeds ambiguous).
      const campaignIds = [...new Set(recon.map(r => r.campaign_id))];
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, campaign_name, screen_name")
        .in("id", campaignIds);
      const byId = Object.fromEntries((bookings ?? []).map(b => [b.id, b]));

      if (cancelled) return;
      setRows(recon.map(r => ({
        ...r,
        campaignName: byId[r.campaign_id]?.campaign_name ?? "Campaign",
        screenName: byId[r.campaign_id]?.screen_name ?? "Screen",
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading };
}

export default function BillingView() {
  const { isMobile } = useBreakpoint();
  const { profile } = useAuth();
  const { rows: creditRows, loading: creditsLoading } = useDeliveryCredits();
  const accountCredit = Number(profile?.credits ?? 0);
  const [data, setData] = useState({ invoices: [], paymentMethods: [], portalUrl: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [pmBusyId, setPmBusyId] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/stripe-billing`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      setError("Failed to load billing data.");
      setLoading(false);
      return;
    }

    setData(await res.json());
    setLoading(false);
  }

  async function startSetup() {
    setSetupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/setup-billing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href.split("?")[0] }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? "Failed to start setup");
      window.location.href = body.url;
    } catch (e) {
      toast.error(e.message);
      setSetupLoading(false);
    }
  }

  async function callManagePaymentMethod(action, paymentMethodId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Session expired. Please log in again."); return false; }
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-payment-method`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, payment_method_id: paymentMethodId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body?.error ?? "Failed to update payment method."); return false; }
    return true;
  }

  async function setDefault(pm) {
    setPmBusyId(pm.id);
    const ok = await callManagePaymentMethod("set_default", pm.id);
    setPmBusyId(null);
    if (!ok) return;
    toast.success(`${pm.brand} ···· ${pm.last4} is now your default payment method.`);
    load();
  }

  async function removeMethod(pm) {
    const ok = await confirm({
      title: "Remove payment method?",
      message: `Remove ${pm.brand} ···· ${pm.last4} from your account?${pm.isDefault ? " This is your current default — future charges will need a different method on file." : ""}`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setPmBusyId(pm.id);
    const removed = await callManagePaymentMethod("detach", pm.id);
    setPmBusyId(null);
    if (!removed) return;
    toast.success(`${pm.brand} ···· ${pm.last4} removed.`);
    load();
  }

  useEffect(() => {
    // Show toast if returning from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    const setup = params.get("setup");
    if (setup === "success") {
      toast.success("Payment method added successfully.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (setup === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading billing…</div>
  );

  if (error) return (
    <div style={{ padding: 40, fontFamily: F.sans }}>
      <div style={{ color: C.red, marginBottom: 12 }}>{error}</div>
      <button
        onClick={() => load()}
        style={{
          padding: '7px 16px', borderRadius: 8, border: 'none',
          background: C.purple, color: '#fff', fontSize: 13, cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? "20px 16px" : "32px 40px", fontFamily: F.sans, maxWidth: 900 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 28px" }}>Billing</h2>

      {accountCredit > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
          padding: "16px 24px", marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", marginBottom: 2 }}>Account Credit</div>
            <div style={{ fontSize: 12, color: C.textSub }}>
              Applied automatically to your next charge. Comes from delivery shortfalls credited below.
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#16a34a", fontFamily: F.mono }}>
            ${accountCredit.toFixed(2)}
          </div>
        </div>
      )}

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Payment Methods
        </div>
        {data.paymentMethods.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>No payment methods on file.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.paymentMethods.map((pm) => (
              <div key={pm.id} style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: "12px 16px", background: C.bg, borderRadius: 8,
                border: `1px solid ${pm.isDefault ? C.blue : C.border}`,
              }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text, textTransform: "capitalize" }}>
                  {pm.brand} ···· {pm.last4}
                </span>
                <span style={{ fontSize: 13, color: C.textSub }}>
                  Expires {pm.expMonth}/{pm.expYear}
                </span>
                {pm.isDefault && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: C.blue, background: "rgba(37,99,235,0.1)",
                    padding: "2px 8px", borderRadius: 10,
                  }}>Default</span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {!pm.isDefault && (
                    <button onClick={() => setDefault(pm)} disabled={pmBusyId === pm.id} style={{
                      padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
                      background: C.surface, color: C.text, fontSize: 12, cursor: "pointer",
                    }}>{pmBusyId === pm.id ? "…" : "Set as default"}</button>
                  )}
                  <button onClick={() => removeMethod(pm)} disabled={pmBusyId === pm.id} style={{
                    padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
                    background: C.surface, color: C.red, fontSize: 12, cursor: "pointer",
                  }}>{pmBusyId === pm.id ? "…" : "Remove"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          {data.portalUrl ? (
            <a
              href={data.portalUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block", padding: "8px 18px", borderRadius: 8,
                background: C.blue, color: "#fff", fontSize: 13, fontWeight: 500,
                textDecoration: "none",
              }}
            >
              + Add Payment Method →
            </a>
          ) : (
            <button
              onClick={startSetup}
              disabled={setupLoading}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "none",
                background: setupLoading ? C.textMuted : C.purple,
                color: "#fff", fontSize: 13, fontWeight: 500,
                cursor: setupLoading ? "not-allowed" : "pointer",
              }}
            >
              {setupLoading ? "Redirecting…" : "＋ Add Payment Method"}
            </button>
          )}
        </div>
      </div>

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 600, color: C.text }}>
          Invoice History
        </div>
        {data.invoices.length === 0 ? (
          <div style={{ padding: "32px 24px", color: C.textMuted, fontSize: 13 }}>
            No invoices yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Date", "Description", "Amount", "Status", "PDF"].map((h) => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 20px", color: C.text, fontFamily: F.mono, fontSize: 12 }}>
                    {new Date(inv.date * 1000).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 20px", color: C.text }}>{inv.description}</td>
                  <td style={{ padding: "12px 20px", color: C.text, fontWeight: 600 }}>
                    ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                  </td>
                  <td style={{ padding: "12px 20px" }}><Badge status={inv.status} /></td>
                  <td style={{ padding: "12px 20px" }}>
                    {inv.pdf ? (
                      <a href={inv.pdf} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 12 }}>
                        Download
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {!creditsLoading && creditRows.length > 0 && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: "hidden", marginTop: 24,
        }}>
          <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, fontSize: 15, fontWeight: 600, color: C.text }}>
            Delivery Credits
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {["Day", "Campaign", "Screen", "Reason", "Credited"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creditRows.map((r) => (
                  <tr key={`${r.campaign_id}-${r.screen_id}-${r.day}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 20px", color: C.text, fontFamily: F.mono, fontSize: 12 }}>{r.day}</td>
                    <td style={{ padding: "12px 20px", color: C.text }}>{r.campaignName}</td>
                    <td style={{ padding: "12px 20px", color: C.text }}>{r.screenName}</td>
                    <td style={{ padding: "12px 20px", color: C.textSub }}>{REASON_LABEL[r.reason] ?? r.reason}</td>
                    <td style={{ padding: "12px 20px", color: "#16a34a", fontWeight: 600, fontFamily: F.mono }}>
                      +${Number(r.credit_amount).toFixed(2)} {String(r.currency ?? "CAD").toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
