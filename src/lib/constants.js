export const C = {
  bg:"#f9fafb", surface:"#ffffff", surfaceAlt:"#f3f4f6", surfaceHover:"#f9fafb",
  border:"#e5e7eb", borderDark:"#d1d5db",
  text:"#111827", textMid:"#374151", textSub:"#6b7280", textMuted:"#9ca3af",
  blue:"#2563eb", blueSoft:"#eff6ff", blueBorder:"#bfdbfe", blueDark:"#1d4ed8",
  green:"#16a34a", greenSoft:"#f0fdf4", greenBorder:"#bbf7d0",
  amber:"#d97706", amberSoft:"#fffbeb", amberBorder:"#fde68a",
  red:"#dc2626",   redSoft:"#fef2f2",   redBorder:"#fecaca",
  purple:"#7c3aed",purpleSoft:"#f5f3ff",purpleBorder:"#ddd6fe",
  sidebar:"#111827", sidebarBorder:"rgba(255,255,255,0.08)",
  blueLight:"#eff6ff",
  greenLight:"#f0fdf4",
  redLight:"#fef2f2",
  purpleLight:"#f5f3ff",
};

export const F = { sans:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif", mono:"'SF Mono','Fira Code',monospace" };

export const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "";
