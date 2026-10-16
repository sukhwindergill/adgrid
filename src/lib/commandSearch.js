// Ranks items for the command palette: prefix matches on any word first,
// then substring matches; an empty query returns everything in order.
export function rankMatches(query, items, text) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return items;
  const scored = [];
  items.forEach((item, index) => {
    const t = (text(item) || '').toLowerCase();
    if (t.startsWith(q)) scored.push({ item, index, score: 0 });
    else if (t.split(/\s+/).some(w => w.startsWith(q))) scored.push({ item, index, score: 1 });
    else if (t.includes(q)) scored.push({ item, index, score: 2 });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map(s => s.item);
}
