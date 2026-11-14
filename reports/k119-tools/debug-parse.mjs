import fs from 'node:fs';
// Reuse the gate's parser by importing it? It's a script; replicate minimal parse here.
const html = fs.readFileSync('dist/puppies/beagle/index.html', 'utf8');
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let body = bodyMatch ? bodyMatch[1] : html;
body = body.replace(/<!--[\s\S]*?-->/g, ' ');
for (const tag of ['script', 'style', 'template', 'svg', 'noscript']) body = body.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), ' ');
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr','path','circle','rect','line','polyline','polygon','ellipse','use','stop','image']);
const root = { tag: '#root', id: null, direct: '', parent: null, children: [] };
const stack = [root];
const elements = [];
const re = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|<\/([a-zA-Z][\w:-]*)>|([^<]+)/g;
let m;
while ((m = re.exec(body))) {
  if (m[1]) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? '';
    const idm = attrs.match(/\bid\s*=\s*"([^"]*)"/);
    const el = { tag, id: idm ? idm[1] : null, direct: '', parent: stack[stack.length - 1], children: [] };
    el.parent.children.push(el);
    elements.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(attrs)) stack.push(el);
  } else if (m[3]) {
    const tag = m[3].toLowerCase();
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].tag === tag) { stack.length = i; break; }
    }
  } else if (m[4]) {
    if (m[4].trim()) stack[stack.length - 1].direct += ' ' + m[4];
  }
}
let n = 0;
for (const el of elements) {
  if (!/all-in/i.test(el.direct)) continue;
  const chain = [];
  for (let p = el; p && p.tag !== '#root'; p = p.parent) chain.push(p.tag + (p.id ? '#' + p.id : ''));
  console.log(`[${n++}] "${el.direct.trim().slice(0, 60)}"`);
  console.log('    ' + chain.join(' < '));
}
console.log('divs with id:', elements.filter((e) => e.tag === 'div' && e.id).map((e) => e.id).join(','));
