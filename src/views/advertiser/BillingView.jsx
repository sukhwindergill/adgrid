import { useState, useEffect } from "react";
import { C, F, SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useToast } from "../../components/primitives/Toast.jsx";

const STATUS_COLORS = {
  paid: { bg: "#f0fdf4", color: "#16a34a" },
  open: { bg: "#fffbeb", color: "#d97706" },
  failed: { bg: "#fef2f2", color: "#dc2626" },
  void: { bg: "#f9fafb", color: "#6b7280" },
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

export default function BillingView() {
  const [data, setData] = useState({ invoices: [], paymentMethods: [], portalUrl: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const toast = useToast();

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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error ?? "Failed to start setup");
      window.location.href = body.url;
    } catch (e) {
      toast.error(e.message);
      setSetupLoading(false);
    }
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
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 900 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 28px" }}>Billing</h2>

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
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", background: C.bg, borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text, textTransform: "capitalize" }}>
                  {pm.brand} ···· {pm.last4}
                </span>
                <span style={{ fontSize: 13, color: C.textSub }}>
                  Expires {pm.expMonth}/{pm.expYear}
                </span>
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
              Manage Payment Methods →
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
        )}
      </div>
    </div>
  );
}
