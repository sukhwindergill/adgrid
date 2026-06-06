import { useState, useEffect } from "react";
import { C, F } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useToast } from "../../components/primitives/Toast.jsx";

function StatusBadge({ status }) {
  const styles = {
    active: { bg: "#f0fdf4", color: "#16a34a" },
    suspended: { bg: "#fef2f2", color: "#dc2626" },
  };
  const s = styles[status] ?? styles.active;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, textTransform: "capitalize" }}>
      {status ?? "active"}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F.sans }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>{title}</div>
        {children}
        <button onClick={onClose} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontFamily: F.sans, fontSize: 13, color: C.textSub }}>Cancel</button>
      </div>
    </div>
  );
}

function DetailPanel({ adv, campaigns, scans, onClose, onUpdated, onImpersonate }) {
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [creditsAmount, setCreditsAmount] = useState("");
  const [rateAmount, setRateAmount] = useState(adv.rate_override ?? "");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);

  const totalSpend = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  async function updateStatus(status) {
    setSaving(true);
    const { error: statusError } = await supabase.from("profiles").update({ status }).eq("id", adv.id);
    setSaving(false);
    if (statusError) { toast.error("Failed to update status."); return; }
    onUpdated({ ...adv, status });
    setModal(null);
  }

  async function addCredits() {
    const amount = parseFloat(creditsAmount);
    if (isNaN(amount)) return;
    setSaving(true);
    const newCredits = (adv.credits ?? 0) + amount;
    const { error } = await supabase.from("profiles").update({ credits: newCredits }).eq("id", adv.id);
    setSaving(false);
    if (error) { toast.error("Failed to add credits."); return; }
    onUpdated({ ...adv, credits: newCredits });
    setCreditsAmount("");
    setModal(null);
  }

  async function saveRate() {
    const rate = parseFloat(rateAmount) || null;
    setSaving(true);
    await supabase.from("profiles").update({ rate_override: rate }).eq("id", adv.id);
    setSaving(false);
    onUpdated({ ...adv, rate_override: rate });
    setModal(null);
  }

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "-8px 0 32px rgba(0,0,0,0.08)", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: F.sans }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{adv.name}</div>
          <div style={{ fontSize: 13, color: C.textSub }}>{adv.email} · {adv.company_name ?? "No company"}</div>
        </div>
        <StatusBadge status={adv.status} />
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: C.textSub }}>✕</button>
      </div>

      <div style={{ display: "flex", padding: "0 24px", borderBottom: `1px solid ${C.border}` }}>
        {["overview", "billing", "actions"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? C.blue : C.textSub, textTransform: "capitalize", borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent" }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {tab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Spend", value: `$${totalSpend.toLocaleString()}` },
                { label: "Active Campaigns", value: activeCampaigns },
                { label: "Total Scans", value: scans.length },
                { label: "Credits", value: `$${(adv.credits ?? 0).toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: C.textSub }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Campaigns</div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted }}>No campaigns yet.</div>
            ) : campaigns.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{c.advertiser_name}</div>
                  <div style={{ fontSize: 12, color: C.textSub }}>${c.budget ?? 0} budget</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </>
        )}

        {tab === "billing" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 4 }}>Stripe Customer ID</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: F.mono }}>
                {adv.stripe_customer_id ? (
                  <a href={`https://dashboard.stripe.com/customers/${adv.stripe_customer_id}`} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{adv.stripe_customer_id}</a>
                ) : "Not set"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: C.textSub }}>Total Spend</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>${totalSpend.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: C.textSub }}>Credits Balance</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>${(adv.credits ?? 0).toFixed(2)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal("credits")} style={{ padding: "9px 16px", borderRadius: 8, background: C.green, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>+ Add Credits</button>
              <button onClick={() => setModal("rate")} style={{ padding: "9px 16px", borderRadius: 8, background: C.surface, color: C.text, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: F.sans, fontSize: 13 }}>
                {adv.rate_override ? `CPM: $${adv.rate_override}` : "Set Custom CPM"}
              </button>
            </div>
          </>
        )}

        {tab === "actions" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Account Status</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Currently: <StatusBadge status={adv.status} /></div>
              {(adv.status ?? "active") !== "suspended" ? (
                <button onClick={() => setModal("suspend")} style={{ padding: "9px 16px", borderRadius: 8, background: C.red, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>Suspend Account</button>
              ) : (
                <button onClick={() => updateStatus("active")} style={{ padding: "9px 16px", borderRadius: 8, background: C.green, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>Reactivate Account</button>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Impersonate</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>View the platform as this advertiser. Your session is unchanged.</div>
              <button onClick={() => onImpersonate(adv)} style={{ padding: "9px 16px", borderRadius: 8, background: C.purple, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>View as {adv.name} →</button>
            </div>
          </>
        )}
      </div>

      {modal === "credits" && (
        <Modal title="Add Credits" onClose={() => setModal(null)}>
          <input type="number" min="0" step="0.01" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} placeholder="50.00"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />
          <button onClick={addCredits} disabled={saving} style={{ padding: "9px 20px", borderRadius: 8, background: C.green, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>{saving ? "Saving…" : "Add Credits"}</button>
        </Modal>
      )}
      {modal === "rate" && (
        <Modal title="Set Custom CPM Rate" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Leave blank to use default rate.</div>
          <input type="number" min="0" step="0.01" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder="e.g. 12.50"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }} />
          <button onClick={saveRate} disabled={saving} style={{ padding: "9px 20px", borderRadius: 8, background: C.blue, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>{saving ? "Saving…" : "Save Rate"}</button>
        </Modal>
      )}
      {modal === "suspend" && (
        <Modal title="Suspend Account?" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>{adv.name}'s campaigns will be paused and they will lose access to the platform.</div>
          <button onClick={() => updateStatus("suspended")} disabled={saving} style={{ padding: "9px 20px", borderRadius: 8, background: C.red, color: "#fff", border: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: 500 }}>{saving ? "Suspending…" : "Yes, Suspend"}</button>
        </Modal>
      )}
    </div>
  );
}

export default function AdvertisersView({ onImpersonate }) {
  const [advertisers, setAdvertisers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [scans, setScans] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*").or("role.eq.advertiser,active_mode.eq.advertiser"),
      supabase.from("bookings").select("*"),
      supabase.from("scans").select("advertiser_id"),
    ]).then(([advRes, campRes, scansRes]) => {
      setAdvertisers(advRes.data ?? []);
      setCampaigns(campRes.data ?? []);
      setScans(scansRes.data ?? []);
      setLoading(false);
    });
  }, []);

  function updateAdv(updated) {
    setAdvertisers((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setSelected(updated);
  }

  const filtered = advertisers.filter((a) => {
    const matchSearch = !search || [a.name, a.email, a.company_name].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || (a.status ?? "active") === statusFilter;
    return matchSearch && matchStatus;
  });

  const selectedCampaigns = selected ? campaigns.filter((c) => c.advertiser_id === selected.id) : [];
  const selectedScans = selected ? scans.filter((s) => s.advertiser_id === selected.id) : [];

  if (loading) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading advertisers…</div>;

  return (
    <div style={{ padding: "32px 40px", fontFamily: F.sans, maxWidth: 1100 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 24px" }}>Advertisers</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input placeholder="Search name, email, company…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface }}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {["Name", "Email", "Company", "Status", "Total Spend", "Active Campaigns", "Joined"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const advCamps = campaigns.filter((c) => c.advertiser_id === a.id);
              const spend = advCamps.reduce((s, c) => s + (c.budget ?? 0), 0);
              const active = advCamps.filter((c) => c.status === "active").length;
              return (
                <tr key={a.id} onClick={() => setSelected(a)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected?.id === a.id ? C.blueLight : "transparent" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: C.text }}>{a.name ?? "—"}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{a.email}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub }}>{a.company_name ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={a.status} /></td>
                  <td style={{ padding: "12px 16px", color: C.text }}>${spend.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", color: C.text }}>{active}</td>
                  <td style={{ padding: "12px 16px", color: C.textSub, fontSize: 12 }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: C.textMuted }}>No advertisers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <DetailPanel adv={selected} campaigns={selectedCampaigns} scans={selectedScans} onClose={() => setSelected(null)} onUpdated={updateAdv} onImpersonate={onImpersonate} />
      )}
    </div>
  );
}
