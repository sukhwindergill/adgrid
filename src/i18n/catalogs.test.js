import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import frCA from '../locales/fr-CA.json';

// Every key path, including array indices and plural forms, so a French
// catalog that drops a sentence, a legal paragraph or a plural form fails
// here rather than silently falling back to English in production.
function paths(node, prefix = '') {
  if (Array.isArray(node)) return node.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function leaves(node, prefix = '', out = {}) {
  if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k, out));
  else out[prefix] = node;
  return out;
}

const vars = str => new Set([...String(str).matchAll(/\{(\w+)\}/g)].map(m => m[1]));
const tags = str => new Set([...String(str).matchAll(/<(\w+)>.*?<\/\1>/g)].map(m => m[1]));

describe('locale catalogs', () => {
  it('en and fr-CA have identical key sets', () => {
    const enPaths = paths(en).sort();
    const frPaths = paths(frCA).sort();
    expect(frPaths.filter(p => !enPaths.includes(p))).toEqual([]);
    expect(enPaths.filter(p => !frPaths.includes(p))).toEqual([]);
  });

  it('fr-CA only uses placeholders that the English string provides', () => {
    const enLeaves = leaves(en);
    const frLeaves = leaves(frCA);
    const problems = [];
    for (const [path, frValue] of Object.entries(frLeaves)) {
      const enVars = vars(enLeaves[path]);
      const extra = [...vars(frValue)].filter(v => !enVars.has(v));
      if (extra.length) problems.push(`${path}: {${extra.join('}, {')}}`);
    }
    expect(problems).toEqual([]);
  });

  it('fr-CA keeps the same inline tags (links, emphasis) as English', () => {
    const enLeaves = leaves(en);
    const frLeaves = leaves(frCA);
    const problems = [];
    for (const [path, frValue] of Object.entries(frLeaves)) {
      const a = [...tags(enLeaves[path])].sort().join(',');
      const b = [...tags(frValue)].sort().join(',');
      if (a !== b) problems.push(`${path}: en <${a}> fr <${b}>`);
    }
    expect(problems).toEqual([]);
  });

  it('fr-CA has no empty strings where English has text', () => {
    const enLeaves = leaves(en);
    const empty = Object.entries(leaves(frCA))
      .filter(([path, v]) => v === '' && enLeaves[path] !== '')
      .map(([path]) => path);
    expect(empty).toEqual([]);
  });
});
