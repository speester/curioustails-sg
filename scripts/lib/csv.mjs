// kit:csv@1.0.0 — the ONE RFC-4180 row parser. Every reader of research/site-blueprint.csv
// SHOULD import this, and three still do not: check-links.mjs, legacy-urls.mjs
// and check-form-purpose.mjs hand-roll a line splitter, so a quoted field
// containing a newline yields a phantom route in those three. Audited
// 2026-09-04: latent on every project on disk, because none has such a field.
// Import this here rather than restating the claim. `line.split(',')` on a quoted CSV is a defect (curio-2.7: one unquoted
// comma broke the parser and the run silently measured the wrong cells).
export function parseCsv(text) {
  const out = []; let row = [], flags = [], f = '', q = false, wasQ = false;
  const endField = () => { row.push(f); flags.push(wasQ); f = ''; wasQ = false; };
  const endRow = () => { out.push({ cells: row, quoted: flags }); row = []; flags = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') { q = true; wasQ = true; }
    else if (c === ',') endField();
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { endField(); endRow(); }
    else f += c;
  }
  if (f.length || row.length) { endField(); endRow(); }
  return out.filter((r) => !(r.cells.length === 1 && r.cells[0] === ''));
}
