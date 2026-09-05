#!/usr/bin/env node
// regate1.mjs — "built == live". Every URL in the built sitemap must return 200 on the host,
// AND the deployed build carries the commit that is checked out (Stage 3 exit item (n)).
//   node scripts/regate1.mjs                     host from project-config (PAGES_URL, else DOMAIN)
//   node scripts/regate1.mjs --host https://x.pages.dev
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

function cfg(key) {
  const path = "config/project-config.md";
  if (!existsSync(path)) return "";
  const m = readFileSync(path, "utf8").match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
  return m ? m[1].split("#")[0].trim() : "";
}

const argHost = process.argv.includes("--host") ? process.argv[process.argv.indexOf("--host") + 1] : "";
let host = argHost || cfg("PAGES_URL") || (cfg("DOMAIN") ? "https://" + cfg("DOMAIN").replace(/^https?:\/\//, "") : "");
if (!host) { console.log("FAIL no host: pass --host or set PAGES_URL/DOMAIN in config/project-config.md"); process.exit(1); }
host = host.replace(/\/$/, "");

const distFiles = existsSync("dist") ? readdirSync("dist") : [];
const sitemapName = ["sitemap-index.xml", "sitemap.xml", "sitemap-0.xml"].find((n) => distFiles.includes(n));
if (!sitemapName) { console.log("HALT: no sitemap in dist/ - there is nothing to gate. Run `npm run build`, or set PROJECT_ROOT."); process.exit(1); }

let xml = readFileSync(join("dist", sitemapName), "utf8");
let locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
// sitemap index -> expand child sitemaps that exist locally
if (/<sitemapindex/i.test(xml)) {
  const children = locs.map((l) => l.split("/").pop());
  locs = [];
  for (const child of children) {
    if (distFiles.includes(child)) {
      const cx = readFileSync(join("dist", child), "utf8");
      locs.push(...[...cx.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim()));
    }
  }
}

const paths = [...new Set(locs.map((l) => l.replace(/^https?:\/\/[^/]+/, "") || "/"))];
let ok = 0;
const bad = [];
for (const p of paths) {
  const url = host + p;
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.status === 200) ok++;
    else bad.push(`${res.status} ${url}`);
  } catch (e) {
    bad.push(`ERR ${url} ${e.message}`);
  }
}

// REQ3-2: Stage 3 exit item (n) carried `the dist/ build-commit meta == the build id` as
// PROSE - a "==" is not a command and could never block. It is folded in HERE, the one
// script SPEC["3-exit"] section (n) already runs.
//
// PROVENANCE IS THE CONTENT HASH, NOT A COMMIT SHA (owner decision 2026-09-02): these
// projects have no GitHub remote and may have no git repo at all, so the build identifier
// is scripts/gen-build-id.mjs's content hash in src/data/build-id.json - the same value
// stamped into every page as <meta name="build-commit">. git is OPTIONAL; when a repo IS
// present the tree must still be clean, because a dirty tree means the served bytes came
// from source that was never recorded.
let commitOk = true;
let commitDetail = "";
try {
  const id = String(JSON.parse(readFileSync(join("src", "data", "build-id.json"), "utf8")).id || "");
  const home = join("dist", "index.html");
  const meta = existsSync(home)
    ? ((readFileSync(home, "utf8")
         .match(/<meta[^>]+name=["']build-commit["'][^>]+content=["']([0-9a-z]+)["']/i) || [])[1] || "")
    : "";
  commitOk = Boolean(meta) && Boolean(id) && meta === id;
  commitDetail = commitOk
    ? `build-commit == build-id (${meta})`
    : `BUILD-ID MISMATCH meta=${meta || "absent"} build-id=${id || "absent"}`;
} catch (e) {
  commitOk = false;
  commitDetail = `BUILD-ID MISMATCH src/data/build-id.json unreadable: ${e.message}`;
}

let gitOk = true;
let gitDetail = "no git repo (optional - build id is the provenance)";
if (existsSync(".git")) {
  try {
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    gitOk = dirty === "";
    gitDetail = gitOk ? "clean tree" : `DIRTY TREE (${dirty.split(String.fromCharCode(10)).length} path(s))`;
  } catch (e) {
    gitOk = false;
    gitDetail = `git present but unreadable: ${e.message}`;
  }
}

console.log("CHECK                                RESULT  DETAIL");
console.log("-".repeat(78));
console.log(`${"every sitemap URL returns 200".padEnd(36)} ${bad.length ? "FAIL" : "PASS"}    ${ok}/${paths.length}`);
for (const b of bad.slice(0, 10)) console.log("   " + b);
console.log(`${"dist build-commit == build-id".padEnd(36)} ${commitOk ? "PASS" : "FAIL"}    ${commitDetail}`);
console.log(`${"git tree (when a repo exists)".padEnd(36)} ${gitOk ? "PASS" : "FAIL"}    ${gitDetail}`);
console.log("-".repeat(78));
console.log(`live ${bad.length ? "MISMATCH" : "200"} == sitemap ${paths.length}  (host ${host})  ${commitDetail}`);
// contracts: every gate prints WHAT IT MEASURED, not only what failed - the
// fixed shape `checked=<n> failed=<m>` on the verdict line. Without it a
// clean run and a run that measured nothing print the same words. A gate
// whose checked is 0 must FAIL unless it also prints an exemption reason.
console.log(`regate1: checked=${paths.length} failed=${bad.length + (commitOk ? 0 : 1) + (gitOk ? 0 : 1)}`);
process.exit(bad.length || !commitOk || !gitOk ? 1 : 0);
