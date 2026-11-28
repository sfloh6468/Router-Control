// Documentation-only packaging. Does not import application code or contact services.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const source = path.join(root, "docs/netpilot-handover");
const output = path.join(root, ".local/outputs/netpilot-handover");
const files = [
  "README.md",
  "PRODUCT-REQUIREMENTS.md",
  "CAROL-SUPPORT.md",
  "WORKFLOWS.md",
  "SECURITY-AND-SAFETY.md",
  "ACCEPTANCE-CRITERIA.md",
  "IMPLEMENTATION-STATUS.md",
  "BUILD-ROADMAP.md",
  "DECISIONS-AND-OPEN-QUESTIONS.md",
  "FEATURE-INVENTORY-AND-PACKAGING.md",
  "SOURCES-AND-COVERAGE.md",
  "DEEPSEEK-START-HERE.md",
];
const contents = new Map(await Promise.all(files.map(async (name) => [
  name, await fs.readFile(path.join(source, name), "utf8"),
])));
const errors = [];
const warnings = [];
const defined = new Set();
for (const text of contents.values()) {
  for (const match of text.matchAll(/(?:^\*\*|^## )(NP-[A-Z]+-\d{2})/gm)) {
    if (defined.has(match[1])) errors.push(`Duplicate requirement ${match[1]}`);
    defined.add(match[1]);
  }
}
for (const [name, text] of contents) {
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (!/^(https?:|#)/.test(target) && !contents.has(target)) {
      errors.push(`${name}: missing package link ${target}`);
    }
  }
  for (const match of text.matchAll(/\bNP-[A-Z]+-\d{2}\b/g)) {
    if (!defined.has(match[0])) errors.push(`${name}: undefined ${match[0]}`);
  }
  for (const pattern of [
    /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bAKIA[A-Z0-9]{16}\b/,
    /(?:postgres(?:ql)?|mysql):\/\/[^\s]+:[^\s]+@/,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  ]) {
    if (pattern.test(text)) errors.push(`${name}: possible credential or operational address`);
  }
}
const acceptance = [...contents.get("ACCEPTANCE-CRITERIA.md").matchAll(/^\| (AC-\d{2}) \|/gm)].map(m => m[1]);
if (acceptance.length !== 69 || new Set(acceptance).size !== 69) errors.push("Expected 69 unique acceptance cases");
for (let i = 1; i <= 69; i++) {
  if (!acceptance.includes(`AC-${String(i).padStart(2, "0")}`)) errors.push(`Missing acceptance case ${i}`);
}
const coverage = contents.get("SOURCES-AND-COVERAGE.md");
for (const id of Array.from({length: 48}, (_,i) => i+1)) {
  if (!coverage.includes(`| S-${id} |`)) errors.push(`Missing source coverage S-${id}`);
}
const inventory = coverage.split("## 3. Full task and planning-record audit")[1]?.split("### Additional older suggestions")[0] || "";
const inventorySources = [...inventory.matchAll(/^\| S-(\d+) \|/gm)].map(m => Number(m[1]));
if (inventorySources.length !== 48 || new Set(inventorySources).size !== 48 ||
    !Array.from({length:48}, (_,i)=>i+1).every(id => inventorySources.includes(id))) {
  errors.push(`Expected a complete unique 48-record task ledger; found ${inventorySources.length}`);
}
const acceptanceText = contents.get("ACCEPTANCE-CRITERIA.md");
for (const id of defined) {
  // Expand abbreviated ranges when checking the acceptance index.
  const family = id.slice(0, -2);
  const number = Number(id.slice(-2));
  const rangeCovered = [...acceptanceText.matchAll(new RegExp(`${family}(\\d{2})[–-](\\d{2})`, "g"))]
    .some(m => number >= Number(m[1]) && number <= Number(m[2]));
  if (!acceptanceText.includes(id) && !rangeCovered) errors.push(`Requirement lacks acceptance reference: ${id}`);
}
warnings.push("Documentation checks are not an application test or full repository secret audit.");
warnings.push("Original inaccessible chat history and live provider/hardware compatibility were not reconstructed or verified.");
if (errors.length) throw new Error(errors.join("\n"));

// Reuse the already installed Markdown renderer; no package installation.
const store = path.join(root, "node_modules/.pnpm");
const installed = (await fs.readdir(store)).filter(n => n.startsWith("markdown-it@")).sort().at(-1);
if (!installed) throw new Error("An installed markdown-it renderer is required; nothing was installed.");
const { default: MarkdownIt } = await import(pathToFileURL(path.join(store, installed, "node_modules/markdown-it/index.mjs")).href);
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
const escape = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const sectionId = name => name.replace(/\.md$/, "").toLowerCase();
const titles = new Map(files.map(name => [name, contents.get(name).split("\n")[0].replace(/^# /, "")]));
const navigation = files.map(name => `<a href="#${sectionId(name)}">${escape(titles.get(name))}</a>`).join("\n");
const sections = files.map(name => {
  const text = contents.get(name).replace(/\]\(([A-Z-]+\.md)\)/g, (_, target) => `](#${sectionId(target)})`);
  return `<section id="${sectionId(name)}"><div class="chapter">${escape(name)}</div>${md.render(text)}</section>`;
}).join("\n");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NetPilot — Product and Developer Handbook</title>
<meta name="description" content="Draft NetPilot requirements and DeepSeek development handover. Documentation only; no app implementation authorized.">
<style>
:root{color-scheme:light;--navy:#142337;--ink:#253348;--muted:#596779;--line:#dbe2eb;--accent:#1e5b83}
*{box-sizing:border-box}body{margin:0;background:#f5f7fa;color:var(--ink);font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}
header{padding:3rem max(1.5rem,calc((100vw - 1300px)/2));background:var(--navy);color:white}
header h1{margin:0;font-size:clamp(2rem,5vw,3.5rem);letter-spacing:-.04em;line-height:1.1}header p{max-width:760px}
.badge{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:#bcd8e8}
.layout{display:grid;grid-template-columns:255px minmax(0,1fr);gap:2rem;max-width:1360px;margin:auto;padding:2rem}
aside{position:sticky;top:1rem;align-self:start;max-height:94vh;overflow:auto;font-size:.86rem}
aside strong{display:block;margin:0 0 .7rem}aside a{display:block;margin:.25rem 0;padding:.4rem .55rem;text-decoration:none;border-left:2px solid var(--line)}
a{color:var(--accent)}aside a:hover{background:#e8eef4}main{min-width:0}
section{background:white;border:1px solid var(--line);border-radius:10px;padding:2rem;margin-bottom:2rem;scroll-margin-top:1rem}
.chapter{font-size:.7rem;letter-spacing:.08em;color:var(--muted)}h1,h2,h3{color:var(--navy);line-height:1.25}section h1{font-size:2rem;margin-top:.5rem}h2{margin-top:2rem;font-size:1.4rem}h3{font-size:1.15rem}p,li{overflow-wrap:anywhere}
table{display:block;overflow:auto;width:100%;border-collapse:collapse;margin:1rem 0;font-size:.86rem}
th,td{text-align:left;vertical-align:top;border:1px solid var(--line);padding:.65rem;min-width:130px}th{background:#edf2f7}tr:nth-child(even){background:#fafbfd}
code{font-size:.85em;background:#edf2f7;padding:.12rem .3rem;border-radius:3px;overflow-wrap:anywhere}pre{background:#142337;color:#e6eef5;padding:1rem;overflow:auto;border-radius:5px}pre code{background:none;color:inherit;padding:0}
blockquote{border-left:4px solid #98b9d0;margin:1rem 0;padding:.2rem 1rem;background:#f1f6fa}
.notice{padding:1rem 1.25rem;border-left:4px solid #ac7b2a;background:#fff9ed;border-radius:4px;margin-bottom:2rem}footer{max-width:1300px;margin:0 auto;padding:0 2rem 3rem;color:var(--muted);font-size:.85rem}
@media(max-width:900px){.layout{display:block;padding:1rem}aside{position:static;max-height:none;margin-bottom:1.5rem}section{padding:1.2rem}header{padding:2rem 1.5rem}}
@media print{body{background:white;font-size:10pt}header{padding:1rem;color:var(--navy);background:white}.layout{display:block;padding:0}aside{display:none}section{border:0;padding:0;border-radius:0;break-before:page}table{display:table;font-size:8pt}th,td{min-width:0;padding:.35rem}pre{white-space:pre-wrap}a{color:inherit;text-decoration:none}}
</style></head><body><header><div class="badge">Re-evaluated draft · 28 November 2026 · Owner review</div><h1>NetPilot Handbook</h1><p>Product requirements, Carol support operations, safety controls, explicit package entitlements, and a portable DeepSeek developer handover.</p></header>
<div class="layout"><aside><strong>Chapters</strong>${navigation}</aside><main><div class="notice"><strong>Documentation only.</strong> No app construction is authorized by this handbook. Planned features and acceptance scenarios are not claims of working functionality.</div>${sections}</main></div><footer>Prepared from available project plans and conversation decisions. No credentials or subscriber records are included. This document makes no measured model-superiority claim.</footer></body></html>`;

await fs.mkdir(output, { recursive: true });
const handbookName = "NetPilot-Handbook.html";
await fs.writeFile(path.join(output, handbookName), html);
const report = {
  status: "passed",
  documentCount: files.length,
  requirementCount: defined.size,
  acceptanceCaseCount: acceptance.length,
  coreRoadmapSources: 17,
  auditedTaskRecords: inventorySources.length,
  wordCount: [...contents.values()].join("\n").split(/\s+/).filter(Boolean).length,
  checks: ["local Markdown links", "unique declared requirement IDs", "defined requirement references",
    "acceptance references for each requirement", "69 unique sequential acceptance cases",
    "complete 48-record planning ledger", "17 core roadmap sources represented", "basic credential/address patterns",
    "HTML self-contained (inline styles, no scripts or remote assets)"],
  warnings,
  applicationTestsRun: false,
  applicationFilesModified: false,
};
await fs.writeFile(path.join(output, "documentation-checks.json"), JSON.stringify(report, null, 2) + "\n");
const entries = [];
for (const name of files) {
  const buffer = Buffer.from(contents.get(name));
  entries.push({ name, sha256: crypto.createHash("sha256").update(buffer).digest("hex") });
}
for (const name of [handbookName, "documentation-checks.json"]) {
  entries.push({ name, sha256: crypto.createHash("sha256").update(await fs.readFile(path.join(output, name))).digest("hex") });
}
await fs.writeFile(path.join(output, "SHA256SUMS.txt"), entries.map(e => `${e.sha256}  ${e.name}`).join("\n") + "\n");
// Explicit allowlist prevents operational files from entering the archive.
const archive = path.join(output, "NetPilot-DeepSeek-Handover.zip");
execFileSync("python", ["-c", `
import pathlib, sys, zipfile
source, output, archive = map(pathlib.Path, sys.argv[1:4])
names = sys.argv[4:]
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for name in names:
        p = source / name if name.endswith(".md") else output / name
        z.write(p, "NetPilot-Handover/" + name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(names)
`, source, output, archive, ...files, handbookName, "documentation-checks.json", "SHA256SUMS.txt"]);
console.log(JSON.stringify({ ...report, html: path.relative(root, path.join(output, handbookName)), archive: path.relative(root, archive) }, null, 2));
