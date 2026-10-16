// Dependency-free i18n core: catalog lookup, interpolation, plurals and the
// current-locale store. React bindings live in useT.js; Intl formatting in
// format.js.
//
// Catalogs are nested JSON (src/locales/<locale>.json) addressed by dotted
// keys: t('marketing.nav.signIn'). A value can be:
//   - a string, with {var} placeholders:   "Hi {name}"
//   - a plural object, picked by vars.count via Intl.PluralRules:
//       { "zero": "No screens", "one": "{count} screen", "other": "{count} screens" }
//     "zero" is optional and only used when count === 0 (French treats 0 as
//     "one", so a French "zero" is just as optional).
// Missing keys fall back to English, then to the key itself.
import en from '../locales/en.json';
import frCA from '../locales/fr-CA.json';

export const LOCALES = ['en', 'fr-CA'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'adgrid.locale';

// Intl wants a region for the right number and date conventions; plain "en"
// formats like the US ("10/16/2026"). AdGrid is Canadian on both sides.
export const INTL_LOCALE = { en: 'en-CA', 'fr-CA': 'fr-CA' };

const catalogs = { en, 'fr-CA': frCA };

export function normalizeLocale(value) {
  if (!value || typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('fr')) return 'fr-CA';
  if (lower.startsWith('en')) return 'en';
  return null;
}

function readStored() {
  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

// Saved choice first, then the browser's preference list, then English.
export function detectLocale() {
  const stored = readStored();
  if (stored) return stored;
  if (typeof navigator !== 'undefined') {
    const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const pref of prefs) {
      const match = normalizeLocale(pref);
      if (match) return match;
    }
  }
  return DEFAULT_LOCALE;
}

let current = typeof window === 'undefined' ? DEFAULT_LOCALE : detectLocale();
const listeners = new Set();

function applyDocumentLang(locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
applyDocumentLang(current);

export function getLocale() {
  return current;
}

export function setLocale(locale, { persist = true } = {}) {
  const next = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  if (persist) {
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* private mode */ }
  }
  if (next === current) return;
  current = next;
  applyDocumentLang(next);
  listeners.forEach(fn => fn());
}

export function subscribeLocale(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function lookup(catalog, key) {
  let node = catalog;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

const pluralRulesCache = {};
function pluralCategory(locale, count) {
  const intl = INTL_LOCALE[locale] ?? locale;
  pluralRulesCache[intl] ??= new Intl.PluralRules(intl);
  return pluralRulesCache[intl].select(count);
}

function interpolate(str, vars, locale) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => {
    if (!(name in vars)) return match;
    const v = vars[name];
    if (typeof v === 'number') return new Intl.NumberFormat(INTL_LOCALE[locale] ?? locale).format(v);
    return v == null ? '' : String(v);
  });
}

function resolve(key, vars, locale) {
  let value = lookup(catalogs[locale], key);
  let usedLocale = locale;
  if (value === undefined && locale !== DEFAULT_LOCALE) {
    value = lookup(catalogs[DEFAULT_LOCALE], key);
    usedLocale = DEFAULT_LOCALE;
  }
  if (value === undefined) {
    if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') console.warn(`[i18n] missing key: ${key}`);
    return { str: key, usedLocale };
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const count = Number(vars?.count ?? 0);
    const form = count === 0 && value.zero != null
      ? value.zero
      : value[pluralCategory(usedLocale, count)] ?? value.other;
    return { str: form ?? key, usedLocale };
  }
  return { str: value, usedLocale };
}

export function t(key, vars, locale = current) {
  const { str, usedLocale } = resolve(key, vars, locale);
  if (typeof str !== 'string') return key;
  return interpolate(str, vars, usedLocale);
}

// Arrays and objects stored in the catalog (e.g. a list of legal bullet
// points), returned raw. Falls back to English like t().
export function tList(key, locale = current) {
  const value = lookup(catalogs[locale], key) ?? lookup(catalogs[DEFAULT_LOCALE], key);
  return Array.isArray(value) ? value : [];
}

export function hasKey(key, locale = current) {
  return lookup(catalogs[locale], key) !== undefined;
}
