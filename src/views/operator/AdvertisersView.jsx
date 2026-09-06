import { useState, useEffect } from "react";
import { C, F } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useToast } from "../../components/primitives/Toast.jsx";
import { useConfirm } from "../../components/primitives/ConfirmModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useOperatorCampaignIds } from "../../hooks/useOperatorCampaignIds.js";
import { PageHeader } from "../../components/primitives/PageHeader.jsx";
import { Btn } from "../../components/primitives/Btn.jsx";

function StatusBadge({ status }) {
  const styles = {
    active: { bg: C.greenSoft, color: C.green },
    suspended: { bg: C.redSoft, color: C.red },
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
      <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 400, maxWidth: "calc(100vw - 32px)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F.sans }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>{title}</div>
        {children}
        <Btn variant="secondary" size="sm" style={{ marginTop: 16 }} onClick={onClose}>Cancel</Btn>
      </div>
    </div>
  );
}

function DetailPanel({ adv, campaigns, scans, onClose, onUpdated, onImpersonate }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState("overview");
  const [creditsAmount, setCreditsAmount] = useState("");
  const [rateAmount, setRateAmount] = useState(adv.rate_override ?? "");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);

  const totalSpend = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  async function updateStatus(status) {
    const previousStatus = adv.status ?? "active";
    setSaving(true);
    const { error: statusError } = await supabase.from("profiles").update({ status }).eq("id", adv.id);
    setSaving(false);
    if (statusError) { toast.error("Failed to update status."); return; }
    onUpdated({ ...adv, status });
    setModal(null);
    if (status === "suspended") {
      toast.undo(`${adv.name}'s account suspended.`, async () => {
        const { error: undoError } = await supabase.from("profiles").update({ status: previousStatus }).eq("id", adv.id);
        if (undoError) { toast.error("Failed to undo suspension."); return; }
        onUpdated({ ...adv, status: previousStatus });
      });
    }
  }

  async function addCredits() {
    const amount = parseFloat(creditsAmount);
    if (isNaN(amount)) return;
    const ok = await confirm({
      title: 'Add credits?',
      message: `Add $${amount.toFixed(2)} in credits to ${adv.name}'s account?`,
      confirmLabel: 'Add Credits',
    });
    if (!ok) return;
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
    const ok = await confirm({
      title: 'Set custom CPM rate?',
      message: rate
        ? `Set ${adv.name}'s CPM rate to $${rate.toFixed(2)}, overriding the default rate?`
        : `Clear ${adv.name}'s custom CPM rate and revert to the default rate?`,
      confirmLabel: 'Save Rate',
    });
    if (!ok) return;
    setSaving(true);
    await supabase.from("profiles").update({ rate_override: rate }).eq("id", adv.id);
    setSaving(false);
    onUpdated({ ...adv, rate_override: rate });
    setModal(null);
  }

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, maxWidth: "100vw", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "-8px 0 32px rgba(0,0,0,0.08)", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: F.sans }}>
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
          <button key={t} onClick={() => setTab(t)} style={{ padding: "12px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: F.sans, fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? C.purple : C.textSub, textTransform: "capitalize", borderBottom: tab === t ? `2px solid ${C.purple}` : "2px solid transparent", transition: "color 0.15s" }}
            onMouseEnter={e => { if (tab !== t) e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { if (tab !== t) e.currentTarget.style.color = C.textSub; }}
          >{t}</button>
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
                  <a href={`https://dashboard.stripe.com/customers/${adv.stripe_customer_id}`} target="_blank" rel="noreferrer" style={{ color: C.purple }}>{adv.stripe_customer_id}</a>
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
              <Btn variant="success" onClick={() => setModal("credits")}>+ Add Credits</Btn>
              <Btn variant="secondary" onClick={() => setModal("rate")}>
                {adv.rate_override ? `CPM: $${adv.rate_override}` : "Set Custom CPM"}
              </Btn>
            </div>
          </>
        )}

        {tab === "actions" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Account Status</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>Currently: <StatusBadge status={adv.status} /></div>
              {(adv.status ?? "active") !== "suspended" ? (
                <Btn variant="danger" onClick={() => setModal("suspend")}>Suspend Account</Btn>
              ) : (
                <Btn variant="success" onClick={() => updateStatus("active")}>Reactivate Account</Btn>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>Impersonate</div>
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 12 }}>View the platform as this advertiser. Your session is unchanged.</div>
              <Btn onClick={() => onImpersonate(adv)}>View as {adv.name} →</Btn>
            </div>
          </>
        )}
      </div>

      {modal === "credits" && (
        <Modal title="Add Credits" onClose={() => setModal(null)}>
          <input type="number" min="0" step="0.01" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} placeholder="50.00"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s" }}
            onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          />
          <Btn variant="success" onClick={addCredits} loading={saving}>Add Credits</Btn>
        </Modal>
      )}
      {modal === "rate" && (
        <Modal title="Set Custom CPM Rate" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>Leave blank to use default rate.</div>
          <input type="number" min="0" step="0.01" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder="e.g. 12.50"
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 14, marginBottom: 12, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s" }}
            onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
            onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
          />
          <Btn onClick={saveRate} loading={saving}>Save Rate</Btn>
        </Modal>
      )}
      {modal === "suspend" && (
        <Modal title="Suspend Account?" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>{adv.name}'s campaigns will be paused and they will lose access to the platform.</div>
          <Btn variant="danger" onClick={() => updateStatus("suspended")} loading={saving}>Yes, Suspend</Btn>
        </Modal>
      )}
    </div>
  );
}

export default function AdvertisersView({ onImpersonate }) {
  const { user } = useAuth();
  const [advertisers, setAdvertisers] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [screenIds, setScreenIds] = useState([]);
  const [scans, setScans] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [checked, setChecked] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  // B27: `bookings` RLS grants read access via two separate policies --
  // "I'm the advertiser" and "I'm the operator of a targeted screen".
  // Fetching unfiltered here means this operator's OWN advertiser-side
  // bookings (if this is a dual-role account) get counted as spend
  // against themselves in this operator-facing advertiser directory.
  // Scope down to bookings that actually target one of this operator's
  // own screens via campaign_screens, same as App.jsx's operatorCampaigns.
  const operatorCampaignIds = useOperatorCampaignIds(screenIds);
  const campaigns = allBookings.filter(c => operatorCampaignIds.has(c.id));

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("*").or("role.eq.advertiser,active_mode.eq.advertiser"),
      supabase.from("bookings").select("*"),
      supabase.from("scans").select("advertiser_id"),
      supabase.from("screens").select("id").eq("operator_id", user.id),
    ]).then(([advRes, campRes, scansRes, screensRes]) => {
      // A failed fetch on any of these previously left advertisers empty
      // just like a genuine zero-advertisers network, showing "No
      // advertisers found." identically to a real empty result set.
      setLoadError(Boolean(advRes.error || campRes.error || scansRes.error || screensRes.error));
      setAdvertisers(advRes.data ?? []);
      setAllBookings(campRes.data ?? []);
      setScans(scansRes.data ?? []);
      setScreenIds((screensRes.data ?? []).map(s => s.id));
      setLoading(false);
    });
  }, [user]);

  function updateAdv(updated) {
    setAdvertisers((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    setSelected(updated);
  }

  const filtered = advertisers.filter((a) => {
    const matchSearch = !search || [a.name, a.email, a.company_name].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || (a.status ?? "active") === statusFilter;
    return matchSearch && matchStatus;
  });

  function toggleChecked(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllChecked() {
    setChecked((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id)));
  }

  async function bulkSetStatus(status) {
    const ids = [...checked];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: status === "suspended" ? "Suspend selected accounts?" : "Reactivate selected accounts?",
      message: `This will ${status === "suspended" ? "suspend" : "reactivate"} ${ids.length} advertiser${ids.length !== 1 ? "s" : ""}.`,
      confirmLabel: status === "suspended" ? "Suspend" : "Reactivate",
      danger: status === "suspended",
    });
    if (!ok) return;
    const previousStatuses = new Map(advertisers.filter((a) => ids.includes(a.id)).map((a) => [a.id, a.status ?? "active"]));
    setBulkBusy(true);
    const { error } = await supabase.from("profiles").update({ status }).in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error("Bulk update failed."); return; }
    setAdvertisers((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, status } : a));
    setChecked(new Set());
    const label = `${ids.length} advertiser${ids.length !== 1 ? "s" : ""} ${status === "suspended" ? "suspended" : "reactivated"}.`;
    if (status === "suspended") {
      toast.undo(label, async () => {
        const undoResults = await Promise.all(ids.map((id) =>
          supabase.from("profiles").update({ status: previousStatuses.get(id) }).eq("id", id)
        ));
        if (undoResults.some((r) => r.error)) { toast.error("Some accounts failed to restore."); }
        setAdvertisers((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, status: previousStatuses.get(a.id) } : a));
      });
    } else {
      toast.success(label);
    }
  }

  const selectedCampaigns = selected ? campaigns.filter((c) => c.advertiser_id === selected.id) : [];
  const selectedScans = selected ? scans.filter((s) => s.advertiser_id === selected.id) : [];

  if (loading) return <div style={{ padding: 40, fontFamily: F.sans, color: C.textSub }}>Loading advertisers…</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader title="Advertisers" subtitle="Every advertiser on your network — spend, status, and account actions" />
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input placeholder="Search name, email, company…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, outline: "none", transition: "border-color 0.15s" }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: F.sans, fontSize: 13, color: C.text, background: C.surface, outline: "none", transition: "border-color 0.15s" }}
          onFocus={e => { e.currentTarget.style.borderColor = C.purple; }}
          onBlur={e => { e.currentTarget.style.borderColor = C.border; }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {checked.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 12, background: C.purpleSoft, border: `1px solid ${C.purpleBorder}`, borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{checked.size} selected</span>
          <Btn variant="danger" size="sm" onClick={() => bulkSetStatus("suspended")} disabled={bulkBusy}>Suspend</Btn>
          <Btn variant="success" size="sm" onClick={() => bulkSetStatus("active")} disabled={bulkBusy}>Reactivate</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setChecked(new Set())}>Clear</Btn>
        </div>
      )}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, width: 32 }}>
                <input type="checkbox" checked={filtered.length > 0 && checked.size === filtered.length} onChange={toggleAllChecked} />
              </th>
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
                <tr key={a.id} onClick={() => setSelected(a)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected?.id === a.id ? C.purpleSoft : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (selected?.id !== a.id) e.currentTarget.style.background = C.surfaceAlt; }}
                  onMouseLeave={e => { if (selected?.id !== a.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggleChecked(a.id)} />
                  </td>
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
              <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: loadError ? C.red : C.textMuted }}>
                {loadError ? "Couldn't load advertisers — check your connection and try again." : "No advertisers found."}
              </td></tr>
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
