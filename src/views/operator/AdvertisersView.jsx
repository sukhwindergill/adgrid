import { useState, useEffect } from "react";
import { SUPABASE_FUNCTIONS_URL } from "../../lib/constants.js";
import { supabase } from "../../lib/supabase.js";
import { useToast } from "../../components/primitives/Toast.jsx";
import { useConfirm } from "../../components/primitives/ConfirmModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useOperatorCampaignIds } from "../../hooks/useOperatorCampaignIds.js";
import { PageHeader } from "../../components/primitives/PageHeader.jsx";
import { Btn } from "../../components/primitives/Btn.jsx";
import { Card } from "../../components/primitives/Card.jsx";
import { Pill } from "../../components/primitives/Pill.jsx";
import { Hover } from "../../components/primitives/Hover.jsx";
import { Inp } from "../../components/primitives/Inp.jsx";
import { SelInput } from "../../components/primitives/SelInput.jsx";
import { Modal, CloseButton } from "../../components/primitives/Modal.jsx";
import { T, SH, C, F } from '../../design/tokens.js';
import { TX } from '../../design/text.js';
import { useT } from "../../i18n/useT.js";
import { t as tNow } from "../../i18n/core.js";

// profiles.status/credits/rate_override are pinned by a BEFORE UPDATE
// trigger (20260909194813_pin_profile_admin_columns.sql) to everyone
// except service_role -- a direct supabase-js .update() from here silently
// reverts the column instead of erroring, so these actions must go through
// operator-manage-advertiser instead of writing to `profiles` directly.
async function callManageAdvertiser(action, payload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: tNow('settings.sessionExpired') };
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/operator-manage-advertiser`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body?.error ?? tNow('op.advertisers.requestFailed') };
  return { ok: true };
}

function StatusBadge({ status }) {
  const { tOr } = useT();
  const s = status ?? "active";
  return (
    <Pill tone={status === "suspended" ? "red" : "green"} style={{ textTransform: "capitalize" }}>
      {tOr(`op.advertisers.status.${s}`, s)}
    </Pill>
  );
}

function ActionModal({ title, onClose, children }) {
  const { t } = useT();
  return (
    <Modal title={title} onBackdropClick={onClose} maxWidth={400} zIndex={1000} panelStyle={{ borderRadius: 16 }}>
      {children}
      <Btn variant="secondary" size="sm" style={{ marginTop: 16 }} onClick={onClose}>{t('common.cancel')}</Btn>
    </Modal>
  );
}

const statTile = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" };
const amountField = { fontSize: T.md, transition: "border-color 0.15s" };
const td = { padding: "12px 16px" };

function DetailPanel({ adv, campaigns, scans, onClose, onUpdated, onImpersonate }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { t, formatCurrency, formatNumber } = useT();
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
    const { ok, error } = await callManageAdvertiser("set_status", { advertiserIds: [adv.id], status });
    setSaving(false);
    if (!ok) { toast.error(error ?? t('op.advertisers.statusFailed')); return; }
    onUpdated({ ...adv, status });
    setModal(null);
    if (status === "suspended") {
      toast.undo(t('op.advertisers.suspendedToast', { name: adv.name }), async () => {
        const undo = await callManageAdvertiser("set_status", { advertiserIds: [adv.id], status: previousStatus });
        if (!undo.ok) { toast.error(undo.error ?? t('op.advertisers.undoFailed')); return; }
        onUpdated({ ...adv, status: previousStatus });
      });
    }
  }

  async function addCredits() {
    const amount = parseFloat(creditsAmount);
    if (isNaN(amount)) return;
    const ok = await confirm({
      title: t('op.advertisers.addCreditsTitle'),
      message: t('op.advertisers.addCreditsMessage', { amount: formatCurrency(amount), name: adv.name }),
      confirmLabel: t('op.advertisers.addCredits'),
    });
    if (!ok) return;
    setSaving(true);
    const { ok: succeeded, error } = await callManageAdvertiser("add_credits", { advertiserIds: [adv.id], amount });
    setSaving(false);
    if (!succeeded) { toast.error(error ?? t('op.advertisers.creditsFailed')); return; }
    onUpdated({ ...adv, credits: (adv.credits ?? 0) + amount });
    setCreditsAmount("");
    setModal(null);
  }

  async function saveRate() {
    const rate = parseFloat(rateAmount) || null;
    const ok = await confirm({
      title: t('op.advertisers.rateTitle'),
      message: rate
        ? t('op.advertisers.rateSet', { name: adv.name, rate: formatCurrency(rate) })
        : t('op.advertisers.rateClear', { name: adv.name }),
      confirmLabel: t('op.advertisers.saveRate'),
    });
    if (!ok) return;
    setSaving(true);
    const { ok: succeeded, error } = await callManageAdvertiser("set_rate_override", { advertiserIds: [adv.id], rate });
    setSaving(false);
    if (!succeeded) { toast.error(error ?? t('op.advertisers.rateFailed')); return; }
    onUpdated({ ...adv, rate_override: rate });
    setModal(null);
  }

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, maxWidth: "100vw", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: SH.drawer, zIndex: 200, display: "flex", flexDirection: "column", fontFamily: F.sans }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: T.lg, fontWeight: 700, color: C.text }}>{adv.name}</div>
          <div style={{ fontSize: T.base, color: C.textSub }}>{adv.email} · {adv.company_name ?? t('op.advertisers.noCompany')}</div>
        </div>
        <StatusBadge status={adv.status} />
        <CloseButton onClick={onClose} style={{ color: C.textSub }} />
      </div>

      <div style={{ display: "flex", padding: "0 24px", borderBottom: `1px solid ${C.border}` }}>
        {["overview", "billing", "actions"].map((tb) => (
          <Btn variant="unstyled" key={tb} onClick={() => setTab(tb)} hoverStyle={tab === tb ? undefined : { color: C.text }} style={{ padding: "12px 16px", fontFamily: F.sans, fontSize: T.base, fontWeight: tab === tb ? 600 : 400, color: tab === tb ? C.purple : C.textSub, textTransform: "capitalize", borderBottom: tab === t ? `2px solid ${C.purple}` : "2px solid transparent", transition: "color 0.15s" }}
          >{t(`op.advertisers.tab.${tb}`)}</Btn>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {tab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: t('op.advertisers.totalSpend'), value: formatCurrency(totalSpend, { minimumFractionDigits: 0 }) },
                { label: t('op.advertisers.activeCampaigns'), value: activeCampaigns },
                { label: t('op.advertisers.totalScans'), value: formatNumber(scans.length) },
                { label: t('op.advertisers.credits'), value: formatCurrency(adv.credits ?? 0) },
              ].map(({ label, value }) => (
                <div key={label} style={statTile}>
                  <div style={{ fontSize: T.sm, color: C.textSub }}>{label}</div>
                  <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.text, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 10 }}>{t('op.advertisers.campaigns')}</div>
            {campaigns.length === 0 ? (
              <div style={{ fontSize: T.base, color: C.textMuted }}>{t('op.advertisers.noCampaigns')}</div>
            ) : campaigns.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: T.base, fontWeight: 500, color: C.text }}>{c.advertiser_name}</div>
                  <div style={{ fontSize: T.sm, color: C.textSub }}>{t('op.advertisers.budgetLine', { amount: formatCurrency(c.budget ?? 0, { minimumFractionDigits: 0 }) })}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </>
        )}

        {tab === "billing" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 4 }}>{t('op.advertisers.stripeId')}</div>
              <div style={{ fontSize: T.base, color: C.text, fontFamily: F.mono }}>
                {adv.stripe_customer_id ? (
                  <a href={`https://dashboard.stripe.com/customers/${adv.stripe_customer_id}`} target="_blank" rel="noreferrer" style={{ color: C.purple }}>{adv.stripe_customer_id}</a>
                ) : t('op.advertisers.notSet')}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ ...statTile, flex: 1 }}>
                <div style={{ fontSize: T.sm, color: C.textSub }}>{t('op.advertisers.totalSpend')}</div>
                <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.text }}>{formatCurrency(totalSpend, { minimumFractionDigits: 0 })}</div>
              </div>
              <div style={{ ...statTile, flex: 1 }}>
                <div style={{ fontSize: T.sm, color: C.textSub }}>{t('op.advertisers.creditsBalance')}</div>
                <div style={{ fontSize: T.xxl, fontWeight: 700, color: C.text }}>{formatCurrency(adv.credits ?? 0)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="success" onClick={() => setModal("credits")}>{t('op.advertisers.addCreditsBtn')}</Btn>
              <Btn variant="secondary" onClick={() => setModal("rate")}>
                {adv.rate_override ? t('op.advertisers.cpmValue', { rate: formatCurrency(adv.rate_override) }) : t('op.advertisers.setCustomCpm')}
              </Btn>
            </div>
          </>
        )}

        {tab === "actions" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('op.advertisers.accountStatus')}</div>
              <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 12 }}>{t('op.advertisers.currently')} <StatusBadge status={adv.status} /></div>
              {(adv.status ?? "active") !== "suspended" ? (
                <Btn variant="danger" onClick={() => setModal("suspend")}>{t('op.advertisers.suspend')}</Btn>
              ) : (
                <Btn variant="success" onClick={() => updateStatus("active")}>{t('op.advertisers.reactivate')}</Btn>
              )}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <div style={{ fontSize: T.md, fontWeight: 600, color: C.text, marginBottom: 8 }}>{t('op.advertisers.impersonate')}</div>
              <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 12 }}>{t('op.advertisers.impersonateBody')}</div>
              <Btn onClick={() => onImpersonate(adv)}>{t('op.advertisers.viewAs', { name: adv.name })}</Btn>
            </div>
          </>
        )}
      </div>

      {modal === "credits" && (
        <ActionModal title={t('op.advertisers.addCredits')} onClose={() => setModal(null)}>
          <Inp type="number" min="0" step="0.01" value={creditsAmount} onChange={(e) => setCreditsAmount(e.target.value)} placeholder="50.00"
            aria-label={t('op.advertisers.creditAmount')} wrapperStyle={{ marginBottom: 12 }} style={amountField} />
          <Btn variant="success" onClick={addCredits} loading={saving}>{t('op.advertisers.addCredits')}</Btn>
        </ActionModal>
      )}
      {modal === "rate" && (
        <ActionModal title={t('op.advertisers.customCpmTitle')} onClose={() => setModal(null)}>
          <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 10 }}>{t('op.advertisers.blankDefault')}</div>
          <Inp type="number" min="0" step="0.01" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder={t('op.advertisers.rateExample')}
            aria-label={t('op.advertisers.cpmRate')} wrapperStyle={{ marginBottom: 12 }} style={amountField} />
          <Btn onClick={saveRate} loading={saving}>{t('op.advertisers.saveRate')}</Btn>
        </ActionModal>
      )}
      {modal === "suspend" && (
        <ActionModal title={t('op.advertisers.suspendTitle')} onClose={() => setModal(null)}>
          <div style={{ fontSize: T.base, color: C.textSub, marginBottom: 16 }}>{t('op.advertisers.suspendBody', { name: adv.name })}</div>
          <Btn variant="danger" onClick={() => updateStatus("suspended")} loading={saving}>{t('op.advertisers.yesSuspend')}</Btn>
        </ActionModal>
      )}
    </div>
  );
}

export default function AdvertisersView({ onImpersonate }) {
  const { user } = useAuth();
  const { t, formatCurrency, formatDate } = useT();
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
      title: status === "suspended" ? t('op.advertisers.bulkSuspendTitle') : t('op.advertisers.bulkReactivateTitle'),
      message: t(status === "suspended" ? 'op.advertisers.bulkSuspendMessage' : 'op.advertisers.bulkReactivateMessage', { count: ids.length }),
      confirmLabel: status === "suspended" ? t('op.advertisers.suspendBtn') : t('op.advertisers.reactivateBtn'),
      danger: status === "suspended",
    });
    if (!ok) return;
    const previousStatuses = new Map(advertisers.filter((a) => ids.includes(a.id)).map((a) => [a.id, a.status ?? "active"]));
    setBulkBusy(true);
    const { ok: succeeded, error } = await callManageAdvertiser("set_status", { advertiserIds: ids, status });
    setBulkBusy(false);
    if (!succeeded) { toast.error(error ?? t('op.advertisers.bulkFailed')); return; }
    setAdvertisers((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, status } : a));
    setChecked(new Set());
    const label = t(status === "suspended" ? 'op.advertisers.bulkSuspended' : 'op.advertisers.bulkReactivated', { count: ids.length });
    if (status === "suspended") {
      toast.undo(label, async () => {
        // Statuses being restored can differ per-row (a mixed
        // active/suspended selection before the bulk suspend), so this
        // can't be a single set_status call -- group ids by their prior
        // status and send one call per group.
        const byPrevStatus = new Map();
        for (const id of ids) {
          const prev = previousStatuses.get(id);
          if (!byPrevStatus.has(prev)) byPrevStatus.set(prev, []);
          byPrevStatus.get(prev).push(id);
        }
        const undoResults = await Promise.all(
          [...byPrevStatus.entries()].map(([prevStatus, groupIds]) =>
            callManageAdvertiser("set_status", { advertiserIds: groupIds, status: prevStatus })
          )
        );
        if (undoResults.some((r) => !r.ok)) { toast.error(t('op.advertisers.restoreFailed')); }
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
      <PageHeader title={t('op.advertisers.title')} subtitle={t('op.advertisers.subtitle')} />
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Inp placeholder={t('op.advertisers.searchPlaceholder')} aria-label={t('op.advertisers.searchLabel')} value={search} onChange={(e) => setSearch(e.target.value)}
          wrapperStyle={{ flex: 1 }} style={{ padding: "9px 14px", transition: "border-color 0.15s" }} />
        <SelInput aria-label={t('op.advertisers.statusFilter')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "9px 14px", transition: "border-color 0.15s" }}>
          <option value="all">{t('op.advertisers.allStatuses')}</option>
          <option value="active">{t('op.advertisers.active')}</option>
          <option value="suspended">{t('op.advertisers.suspended')}</option>
        </SelInput>
      </div>
      {checked.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", marginBottom: 12, background: C.purpleSoft, border: `1px solid ${C.purpleBorder}`, borderRadius: 10 }}>
          <span style={{ fontSize: T.base, color: C.text, fontWeight: 500 }}>{t('op.advertisers.selected', { count: checked.size })}</span>
          <Btn variant="danger" size="sm" onClick={() => bulkSetStatus("suspended")} disabled={bulkBusy}>{t('op.advertisers.suspendBtn')}</Btn>
          <Btn variant="success" size="sm" onClick={() => bulkSetStatus("active")} disabled={bulkBusy}>{t('op.advertisers.reactivateBtn')}</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setChecked(new Set())}>{t('op.advertisers.clear')}</Btn>
        </div>
      )}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.base }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, width: 32 }}>
                <input type="checkbox" checked={filtered.length > 0 && checked.size === filtered.length} onChange={toggleAllChecked} />
              </th>
              {["name", "email", "company", "status", "spend", "active", "joined"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textSub, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{t(`op.advertisers.col.${h}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const advCamps = campaigns.filter((c) => c.advertiser_id === a.id);
              const spend = advCamps.reduce((s, c) => s + (c.budget ?? 0), 0);
              const active = advCamps.filter((c) => c.status === "active").length;
              return (
                <Hover as="tr" key={a.id} onClick={() => setSelected(a)} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected?.id === a.id ? C.purpleSoft : "transparent", transition: "background 0.15s" }}
                  hoverStyle={{ background: C.surfaceAlt }} disabled={selected?.id === a.id}
                >
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggleChecked(a.id)} />
                  </td>
                  <td style={{ ...td, fontWeight: 500, color: C.text }}>{a.name ?? "—"}</td>
                  <td style={{ ...td, color: C.textSub }}>{a.email}</td>
                  <td style={{ ...td, color: C.textSub }}>{a.company_name ?? "—"}</td>
                  <td style={td}><StatusBadge status={a.status} /></td>
                  <td style={{ ...td, color: C.text }}>{formatCurrency(spend, { minimumFractionDigits: 0 })}</td>
                  <td style={{ ...td, color: C.text }}>{active}</td>
                  <td style={{ ...td, color: C.textSub, fontSize: T.sm }}>{a.created_at ? formatDate(a.created_at) : "—"}</td>
                </Hover>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: loadError ? C.redText : C.textMuted }}>
                {loadError ? t('op.advertisers.loadError') : t('op.advertisers.none')}
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
      {selected && (
        <DetailPanel adv={selected} campaigns={selectedCampaigns} scans={selectedScans} onClose={() => setSelected(null)} onUpdated={updateAdv} onImpersonate={onImpersonate} />
      )}
    </div>
  );
}
