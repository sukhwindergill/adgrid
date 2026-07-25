// CSV serialisation shared by every export surface.
//
// Values are quoted whenever they contain a delimiter, quote or newline, and
// any cell starting with = + - or @ is prefixed with an apostrophe: Excel and
// Google Sheets execute those as formulas, and exported scan/campaign data
// contains user-supplied text.

const NEEDS_QUOTING = /[",\n\r]/;
const FORMULA_START = /^[=+\-@]/;

function serialiseCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);

  // A cell starting with = + - or @ is executed as a formula by Excel and
  // Sheets. Prefix with an apostrophe AND quote the result, so the apostrophe
  // survives parsers that would otherwise strip or reinterpret a bare leading
  // quote character.
  if (FORMULA_START.test(s)) return `"'${s.replace(/"/g, '""')}"`;

  if (NEEDS_QUOTING.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const header = columns.map(c => serialiseCell(c.label)).join(',');
  const lines = (rows ?? []).map(row =>
    columns.map(c => serialiseCell(row?.[c.key])).join(',')
  );
  return [header, ...lines].join('\n');
}

// Triggers a browser download. Separated from toCsv so the serialiser stays
// pure and testable without a DOM.
export function downloadCsv(filename, columns, rows) {
  const blob = new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
