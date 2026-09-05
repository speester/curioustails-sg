// Replaces the build-date literal in each page's schema dateModified with the page's
// LAST REVISION DATE from git, and passes it to BaseLayout so the page renders a
// visible dateline. A dateModified that moves on every build is a claim about the
// content that the content did not earn. Re-runnable.
import fs from 'node:fs';
import path from 'node:path';

const LIT = "new Date().toISOString().split('T')[0]";
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.astro')) files.push(p);
  }
})('src/pages');

let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes(LIT)) continue;
  if (!s.includes("updatedFor")) {
    const rel = path.relative(path.dirname(f), 'src/lib/page-updated').split(String.fromCharCode(92)).join('/');
    const imp = `import { fileURLToPath } from 'node:url';\nimport { updatedFor } from '${rel.startsWith('.') ? rel : './' + rel}';\nconst lastUpdated = updatedFor(fileURLToPath(import.meta.url));\n`;
    const i = s.indexOf('\n', s.indexOf('---')) + 1;
    s = s.slice(0, i) + imp + s.slice(i);
  }
  s = s.split(LIT).join('lastUpdated');
  s = s.replace(/<BaseLayout(\s)/, '<BaseLayout updated={lastUpdated}$1');
  fs.writeFileSync(f, s);
  n++;
}
console.log(`codemod-datelines: pages=${n}`);
