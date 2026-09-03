// Simplified brand marks for the integrations lists (AdvIntegrationsView,
// IntegrationsView) — the previous version used generic/mismatched emoji
// (📘 for Meta, 🔵 for Google, ☁️ for Salesforce, etc.) that didn't read as
// the actual platform. These are minimal inline-SVG glyphs on each brand's
// real color, not full trademarked logos (avoids reproducing copyrighted
// marks) but immediately recognizable by shape + color, same pattern any
// integrations marketplace uses for a compact icon badge.

// Box scales with the requested icon size (roughly 1.6x, floored at 20px) so
// a small inline size (e.g. 12px in a table row) doesn't sit inside a badge
// that stays fixed at 32px regardless of what was asked for.
const WRAP = (color, size, children) => {
  const box = Math.max(20, Math.round(size * 1.6));
  const radius = Math.max(4, Math.round(box * 0.25));
  return (
    <div style={{
      width: box, height: box, borderRadius: radius, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </div>
  );
};

const ICONS = {
  meta: (size) => WRAP('#0866FF', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M7 16.5c-2.2 0-3.5-2.8-3.5-6S4.8 4.5 7 4.5c1.3 0 2.3.9 3.4 2.6l1.6 2.5 1.6-2.5c1.1-1.7 2.1-2.6 3.4-2.6 2.2 0 3.5 2.8 3.5 6s-1.3 6-3.5 6c-1.3 0-2.3-.9-3.4-2.6L12 11.4l-1.6 2.5c-1.1 1.7-2.1 2.6-3.4 2.6Z" fill="#fff"/>
    </svg>
  )),
  google: (size) => WRAP('#fff', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ border: '1px solid #e5e5e5', borderRadius: 6 }}>
      <path d="M21.6 12.23c0-.68-.06-1.36-.18-2H12v3.79h5.4a4.62 4.62 0 0 1-2 3.03v2.5h3.24c1.9-1.75 3-4.32 3-7.32Z" fill="#4285F4"/>
      <path d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.24-2.5c-.9.6-2.06.96-3.39.96-2.6 0-4.8-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z" fill="#34A853"/>
      <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96l3.34-2.58Z" fill="#FBBC05"/>
      <path d="M12 5.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.96 9.96 0 0 0 12 2a10 10 0 0 0-8.94 5.52L6.4 10.1c.8-2.36 3-4.12 5.6-4.12Z" fill="#EA4335"/>
    </svg>
  )),
  shopify: (size) => WRAP('#95BF47', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15.3 6.4c-.1-.07-.24-.1-.36-.1l-1.5-.02-1.1-1.1c-.1-.1-.3-.15-.44-.11l-.55.17a3.9 3.9 0 0 0-.4-.98c-.6-1.1-1.47-1.68-2.5-1.68h-.02c-.07 0-.14 0-.2.02-.03-.04-.06-.08-.1-.1-.44-.48-1-.7-1.68-.68-1.3.04-2.6.98-3.64 2.65a10 10 0 0 0-1.3 3.24l-1.9.6c-.56.18-.58.2-.65.73L1 20.2 15.5 23l6-1.5-6.2-15.1Z" fill="#fff" opacity=".001"/>
      <path d="M15.6 6.3c-.1-.07-.24-.1-.36-.1l-1.5-.02-1.1-1.1c-.1-.1-.3-.15-.44-.11l-.63.2c-.4-1.2-1.4-2.4-2.9-2.4h-.03c-.44-.6-1-.86-1.66-.84C5.6 2 4.4 4.4 4 6.5l-1.86.58c-.56.18-.58.2-.65.73L0 19.6l13.2 2.5 6.3-1.4-3.9-14.4Zm-3.9-.9-.9.28c0-.6-.08-1.44-.36-2.15.9.17 1.34 1.2 1.26 1.87Zm-1.85.57L7.6 6.7c.28-1.06.8-2.1 1.44-2.78.24.63.34 1.5.3 2.34l.5-.15Zm-1.2-3c.17 0 .32.03.46.1-.6.28-1.24 1-1.6 2.4l-1.4.44c.36-1.3 1.28-2.9 2.54-2.94Z" fill="#5E8E3E"/>
      <path d="M15.24 6.2l-1.5-.02-1.1-1.1c-.1-.1-.3-.15-.44-.11L2.14 7.9c-.56.18-.58.2-.65.73L0 19.6l13.2 2.5V6.24c-.6-.03-.02-.03-.02-.03Z" fill="#95BF47"/>
      <path d="M13.2 22.1 19.5 20.7l-3.9-14.4c-.1-.07-.24-.1-.36-.1l-2 .04v15.86Z" fill="#3D6B27"/>
      <path d="M10.3 9.9l-.5 1.9s-.9-.4-2-.34c-1.6.1-1.6 1.1-1.6 1.36.1 1.4 3.7 1.7 3.9 4.9.15 2.5-1.3 4.2-3.4 4.35-2.5.16-3.9-1.32-3.9-1.32l.55-2.3s1.4 1.06 2.5 1c.72-.06 1-.65.97-1.06-.1-1.84-3.06-1.73-3.24-4.66-.15-2.46 1.4-4.94 4.9-5.16 1.36-.1 2.05.24 2.05.24Z" fill="#fff"/>
    </svg>
  )),
  salesforce: (size) => WRAP('#00A1E0', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10.5 6.8a3.6 3.6 0 0 1 2.6-1.1c1.3 0 2.4.7 3 1.8a4 4 0 0 1 1.6-.34c2.2 0 4 1.8 4 4.06 0 2.24-1.8 4.05-4 4.05-.28 0-.55-.03-.8-.08a2.9 2.9 0 0 1-2.55 1.5 3 3 0 0 1-1.3-.3 3.4 3.4 0 0 1-3.1 2 3.4 3.4 0 0 1-3.2-2.24 3 3 0 0 1-.6.06A3.05 3.05 0 0 1 3.1 12.8c0-1.16.66-2.16 1.6-2.66a3.5 3.5 0 0 1-.3-1.44A3.55 3.55 0 0 1 8 5.15c1 0 1.9.46 2.5 1.65Z" fill="#fff"/>
    </svg>
  )),
  hubspot: (size) => WRAP('#FF7A59', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="17.5" cy="15.5" r="3" stroke="#fff" strokeWidth="1.6"/>
      <path d="M13.5 12 9 9.3" stroke="#fff" strokeWidth="1.6"/>
      <circle cx="7" cy="7.5" r="2.3" stroke="#fff" strokeWidth="1.6"/>
      <path d="M14 6v5" stroke="#fff" strokeWidth="1.6"/>
    </svg>
  )),
  klaviyo: (size) => WRAP('#00B2A9', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 5h6L4 12l6 7H4l6-7-6-7Z" fill="#fff"/>
      <path d="M14 5h6l-6 7 6 7h-6l6-7-6-7Z" fill="#fff" opacity=".55"/>
    </svg>
  )),
  tiktok: (size) => WRAP('#000', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M15 3v10.6a2.6 2.6 0 1 1-2.2-2.57V8.7a5.3 5.3 0 1 0 4.5 5.24V9.9a6.6 6.6 0 0 0 3.7 1.13V8.3a3.7 3.7 0 0 1-2.7-1.1A3.9 3.9 0 0 1 17.2 3H15Z" fill="#25F4EE"/>
      <path d="M14.3 3v10.6a2.6 2.6 0 1 1-2.2-2.57V8a5.3 5.3 0 1 0 4.5 5.24V9.2a6.6 6.6 0 0 0 3.7 1.13V7.6a3.7 3.7 0 0 1-2.7-1.1A3.9 3.9 0 0 1 16.5 3h-2.2Z" fill="#FE2C55"/>
      <path d="M14.6 3v10.6a2.6 2.6 0 1 1-2.2-2.57V8.3a5.3 5.3 0 1 0 4.5 5.24V9.5a6.6 6.6 0 0 0 3.7 1.13V8a3.7 3.7 0 0 1-2.7-1.1A3.9 3.9 0 0 1 16.8 3h-2.2Z" fill="#fff"/>
    </svg>
  )),
  webhook: (size) => WRAP('#7c3aed', size, (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 12a3 3 0 1 1-2.6 4.5" />
      <path d="M12 8a3 3 0 0 1 5.2-2" />
      <path d="M16 16a3 3 0 0 1-5.2 2" />
      <path d="m10 13 4-4M9 9l2 2M13 15l2 2" />
    </svg>
  )),
};

export function BrandIcon({ id, size = 20 }) {
  const render = ICONS[id];
  if (!render) return WRAP('#8a8a9a', size, <span style={{ color: '#fff', fontSize: Math.max(9, Math.round(size * 0.55)), fontWeight: 700 }}>{(id || '?')[0]?.toUpperCase()}</span>);
  return render(size);
}
