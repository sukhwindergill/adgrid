// React bindings for the i18n core. useT() re-renders the caller when the
// locale changes and returns t() plus the formatting helpers bound to the
// current locale.
import { cloneElement, createElement, Fragment, isValidElement, useMemo, useSyncExternalStore } from 'react';
import { getLocale, hasKey, setLocale, subscribeLocale, t as translate, tList as translateList } from './core.js';
import * as fmt from './format.js';

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

// Splits a translated string on <tag>…</tag> and {var} and swaps in React
// nodes, so links and emphasis stay inside one translatable sentence:
//   rich(t, 'login.agree', { terms: chunk => <Link to="/terms">{chunk}</Link> })
//   catalog: "I agree to the <terms>Terms of Service</terms>"
// A var can be a node (used as-is) or a function of the tag's inner text.
// Plain string/number vars are interpolated by t() before splitting.
export function rich(str, vars = {}) {
  const out = [];
  const re = /<(\w+)>(.*?)<\/\1>|\{(\w+)\}/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    const name = m[1] ?? m[3];
    const inner = m[2];
    const v = vars[name];
    let node;
    if (typeof v === 'function') node = v(inner);
    else if (v !== undefined) node = v;
    else node = m[1] ? inner : m[0];
    out.push(isValidElement(node) ? cloneElement(node, { key: `r${i++}` }) : createElement(Fragment, { key: `r${i++}` }, node));
    last = re.lastIndex;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => {
    const t = (key, vars) => translate(key, vars, locale);
    const plainVars = vars => vars && Object.fromEntries(
      Object.entries(vars).filter(([, v]) => typeof v === 'string' || typeof v === 'number'),
    );
    return {
      t,
      // t() for strings containing <tag>…</tag> or node-valued {vars}.
      tx: (key, vars) => rich(translate(key, plainVars(vars), locale), vars),
      tList: key => translateList(key, locale),
      // Label for a data value that may or may not have a catalog entry
      // (venue subtypes, categories): the translation if one exists, else
      // the raw value.
      tOr: (key, fallback, vars) => (hasKey(key, locale) || hasKey(key, 'en') ? translate(key, vars, locale) : fallback),
      locale,
      setLocale,
      formatNumber: (v, o) => fmt.formatNumber(v, o, locale),
      formatCurrency: (v, o) => fmt.formatCurrency(v, o, locale),
      formatPercent: (v, o) => fmt.formatPercent(v, o, locale),
      formatMoney: (v, currency) => fmt.formatMoney(v, currency, locale),
      regionName: code => fmt.regionName(code, locale),
      formatDate: (v, o) => fmt.formatDate(v, o, locale),
      formatTime: (v, o) => fmt.formatTime(v, o, locale),
      formatDateTime: (v, o) => fmt.formatDateTime(v, o, locale),
    };
  }, [locale]);
}
