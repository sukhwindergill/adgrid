const I = ({ size = 22, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconTrend    = p => <I {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></I>;
export const IconShield   = p => <I {...p}><path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/></I>;
export const IconChart    = p => <I {...p}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></I>;
export const IconBolt     = p => <I {...p}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></I>;
export const IconPin      = p => <I {...p}><path d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></I>;
export const IconTagPrice = p => <I {...p}><path d="M20 13l-7 7-9-9V4h7l9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></I>;
export const IconQr       = p => <I {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/></I>;
export const IconClock    = p => <I {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></I>;
export const IconDumbbell = p => <I {...p}><path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/></I>;
export const IconCoffee   = p => <I {...p}><path d="M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8z"/><path d="M17 9h2a2.5 2.5 0 010 5h-2"/><path d="M7 3v2M11 3v2M15 3v2"/></I>;
export const IconScissors = p => <I {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 19M8 16.5L20 5"/></I>;
export const IconCross    = p => <I {...p}><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z"/></I>;
export const IconBus      = p => <I {...p}><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 9h16"/><circle cx="8" cy="20" r="1.5"/><circle cx="16" cy="20" r="1.5"/></I>;
export const IconBag      = p => <I {...p}><path d="M5 8h14l-1 12H6L5 8z"/><path d="M8 8V6a4 4 0 018 0v2"/></I>;
export const IconBed      = p => <I {...p}><path d="M3 18V7"/><path d="M3 13h18v5"/><path d="M3 11h8V9a2 2 0 00-2-2H3"/></I>;
export const IconCap      = p => <I {...p}><path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></I>;
export const IconCheck    = p => <I {...p}><path d="M4 12l5 5L20 6"/></I>;
export const IconArrow    = p => <I {...p}><path d="M5 12h14M13 6l6 6-6 6"/></I>;
