// Shared icon set — consistent 1.5 stroke weight, matches views/marketing/sections/icons.jsx.
// Use these instead of emoji anywhere in the product UI.
const I = ({ size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {p.children}
  </svg>
);

export const IconChat      = p => <I {...p}><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></I>;
export const IconLock       = p => <I {...p}><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></I>;
export const IconChart      = p => <I {...p}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></I>;
export const IconTarget     = p => <I {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/></I>;
export const IconTrendUp    = p => <I {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></I>;
export const IconDollar     = p => <I {...p}><path d="M12 2v20"/><path d="M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.4-5 3.5S9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5"/></I>;
export const IconParty      = p => <I {...p}><path d="M5 3l1.5 3L10 5"/><path d="M4 21l14-5-9-9-5 14z"/><path d="M14 4l1 1"/><path d="M18 8l1 1"/><path d="M17 3l1 3"/></I>;
export const IconBolt       = p => <I {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></I>;
export const IconWave       = p => <I {...p}><path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></I>;
export const IconQr         = p => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></I>;
export const IconEye        = p => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></I>;
export const IconClock      = p => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></I>;
export const IconMail       = p => <I {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></I>;
export const IconGlobe      = p => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18 14 14 0 010-18z"/></I>;
export const IconClipboard  = p => <I {...p}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/><path d="M9 11h6M9 15h6"/></I>;
export const IconBank       = p => <I {...p}><path d="M3 21h18"/><path d="M4 21V10M20 21V10"/><path d="M2 10l10-6 10 6"/><path d="M8 21v-7M12 21v-7M16 21v-7"/></I>;
export const IconRecycle    = p => <I {...p}><path d="M7 19H4a2 2 0 01-1.7-3l3-5"/><path d="M10.6 5.5L13 3l2.4 2.5"/><path d="M17.6 21H21a2 2 0 001.7-3l-1.9-3.2"/><path d="M8 21l2-3.5"/><path d="M13.4 3L17 9l-3.5 2"/></I>;
export const IconScreen     = p => <I {...p}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></I>;
export const IconWarning    = p => <I {...p}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></I>;
export const IconCard       = p => <I {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></I>;
export const IconTagPrice   = p => <I {...p}><path d="M20 13l-7 7-9-9V4h7l9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></I>;
export const IconBookmark   = p => <I {...p}><path d="M6 3h12v18l-6-4-6 4V3z"/></I>;
export const IconEdit       = p => <I {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></I>;
export const IconCamera     = p => <I {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="4"/></I>;
export const IconCheckCircle = p => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></I>;
export const IconEyeOff      = p => <I {...p}><path d="M17.5 17.5A10 10 0 012 12s1.4-2.9 4.5-5m5-1.4A10 10 0 0122 12s-.7 1.5-2.2 3"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/><path d="M2 2l20 20"/></I>;
