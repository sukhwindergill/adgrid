import { useState, useEffect, useRef } from "react";
import { C, F } from "../lib/constants.js";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";

const TYPE_ICONS = {
  campaign_approved: "✅",
  campaign_live: "▶",
  campaign_paused: "⏸",
  low_budget: "⚠️",
  campaign_ended: "🏁",
  scan_milestone: "🎯",
  weekly_report: "📊",
  payment_failed: "❌",
  new_advertiser: "👤",
  campaign_submitted: "📋",
  payout_completed: "💰",
  weekly_revenue: "📈",
  team_member_joined: "🤝",
  account_suspended: "🚫",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Initial fetch
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setNotifications(data ?? []));

    // Realtime subscription
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    if (unread === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32, height: 32, borderRadius: "50%", border: `1px solid ${C.border}`,
          background: C.surface, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 15, position: "relative",
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: C.red, color: "#fff", borderRadius: "50%",
            width: 16, height: 16, fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F.sans,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 40, right: 0, width: 320,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", zIndex: 1000, overflow: "hidden",
          fontFamily: F.sans,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: C.blue, background: "none", border: "none",
                cursor: "pointer", fontFamily: F.sans,
              }}>Mark all read</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: C.textMuted }}>
              No notifications yet
            </div>
          ) : notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              style={{
                display: "flex", gap: 10, padding: "12px 16px",
                borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                background: n.read ? C.surface : C.blueLight,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.read && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
