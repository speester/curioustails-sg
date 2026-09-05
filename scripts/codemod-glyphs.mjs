// One-shot codemod for the check-content typography contract:
//   - em dash in prose  -> spaced hyphen (comments are left alone; the gate skips them)
//   - straight apostrophe in a UI label -> curly
//   - HTML comments in markup -> removed (they ship to dist)
// Re-runnable: running it twice is a no-op.
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src'];
const EXT = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.has(path.extname(e.name))) files.push(p);
  }
})(ROOTS[0]);

const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);
let dashed = 0, curled = 0, stripped = 0, touched = 0;

for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  let lines = before.split('\n');
  lines = lines.map((l) => {
    if (isComment(l)) return l;
    let out = l;
    if (/—|&mdash;|&#8212;/.test(out)) {
      out = out.replace(/\s*(?:—|&mdash;|&#8212;)\s*/g, ' - ');
      dashed++;
    }
    if (/(?:label|heading|title|cta)\s*[:=]\s*"[^"]*[A-Za-z]'[a-z]/.test(out)) {
      out = out.replace(/([A-Za-z])'([a-z])/g, '$1’$2');
      curled++;
    }
    return out;
  });
  let text = lines.join('\n');
  if (f.endsWith('.astro')) {
    const n = (text.match(/<!--[\s\S]*?-->/g) || []).length;
    if (n) { text = text.replace(/<!--[\s\S]*?-->/g, ''); stripped += n; }
  }
  if (text !== before) { fs.writeFileSync(f, text); touched++; }
}
console.log(`codemod-glyphs: files=${touched} em-dash-lines=${dashed} apostrophe-lines=${curled} html-comments=${stripped}`);
