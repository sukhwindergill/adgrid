// Locale-aware number, currency and date formatting. Every helper takes an
// optional locale and otherwise uses the current one, so plain calls follow
// the language switcher. English is formatted as en-CA ("$1,234.56",
// "Oct 16, 2026"), French as fr-CA ("1 234,56 $", "16 oct. 2026").
import { getLocale, INTL_LOCALE } from './core.js';

const cache = new Map();
function cached(kind, locale, opts, make) {
  const key = `${kind}|${locale}|${JSON.stringify(opts ?? {})}`;
  if (!cache.has(key)) cache.set(key, make(INTL_LOCALE[locale] ?? locale, opts));
  return cache.get(key);
}

const num = (locale, opts) => cached('n', locale, opts, (l, o) => new Intl.NumberFormat(l, o));
const dt = (locale, opts) => cached('d', locale, opts, (l, o) => new Intl.DateTimeFormat(l, o));

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDate(value) {
  if (value == null || value === '') return null;
  // "2026-10-01" is a calendar date, not UTC midnight: parsed as UTC it
  // would show as Sep 30 anywhere west of Greenwich.
  const m = typeof value === 'string' && value.match(DATE_ONLY);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatNumber(value, opts, locale = getLocale()) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return num(locale, opts).format(n);
}

// formatCurrency(1234.5) -> "$1,234.50" (en) / "1 234,50 $" (fr-CA).
// Pass { decimals: 0 } for whole-dollar marketing figures.
export function formatCurrency(amount, { currency = 'CAD', decimals = 2, ...rest } = {}, locale = getLocale()) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return num(locale, {
    style: 'currency',
    currency: String(currency || 'CAD').toUpperCase(),
    // "US$" vs "$": keep the bare symbol for CAD, the app's home currency.
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...rest,
  }).format(n);
}

// formatMoney(12, 'usd') -> "$12.00 USD" (en) / "12,00 $ USD" (fr-CA). For
// amounts whose currency varies per account, so the code is always shown.
export function formatMoney(amount, currency = 'CAD', locale = getLocale()) {
  const code = String(currency || 'CAD').toUpperCase();
  const formatted = formatCurrency(amount, { currency: code }, locale);
  return formatted ? `${formatted} ${code}` : '';
}

// regionName('CA') -> "Canada"; regionName('US', 'fr-CA') -> "États-Unis".
export function regionName(code, locale = getLocale()) {
  if (!code) return '';
  try {
    return cached('r', locale, null, l => new Intl.DisplayNames([l], { type: 'region' })).of(code) ?? code;
  } catch {
    return code;
  }
}

// formatPercent(0.7) -> "70%" (en) / "70 %" (fr-CA).
export function formatPercent(ratio, { decimals = 0, ...rest } = {}, locale = getLocale()) {
  const n = Number(ratio);
  if (!Number.isFinite(n)) return '';
  return num(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: decimals, ...rest }).format(n);
}

export function formatDate(value, opts = { dateStyle: 'medium' }, locale = getLocale()) {
  const d = toDate(value);
  return d ? dt(locale, opts).format(d) : '';
}

export function formatTime(value, opts = { timeStyle: 'short' }, locale = getLocale()) {
  const d = toDate(value);
  return d ? dt(locale, opts).format(d) : '';
}

export function formatDateTime(value, opts = { dateStyle: 'medium', timeStyle: 'short' }, locale = getLocale()) {
  const d = toDate(value);
  return d ? dt(locale, opts).format(d) : '';
}
