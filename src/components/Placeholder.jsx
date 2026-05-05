import { C, F } from "../lib/constants.js";

export default function Placeholder({ title, subtitle, icon }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", minHeight: 400,
      fontFamily: F.sans, color: C.textSub, gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 14 }}>{subtitle}</div>}
      <div style={{
        marginTop: 8, fontSize: 13, color: C.textMuted,
        background: C.bg, padding: "6px 14px", borderRadius: 20,
        border: `1px solid ${C.border}`,
      }}>Coming soon</div>
    </div>
  );
}
