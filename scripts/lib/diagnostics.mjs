import crypto from "node:crypto";
import path from "node:path";
import { parseJsonEnvelope } from "./biome-proof.mjs";

function sha(text) {
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

export function normalizeRepoPath(file, root = process.cwd()) {
  if (!file) return "";
  const absolute = path.isAbsolute(file) ? file : path.resolve(root, file);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  return relative.startsWith("../") ? file.split(path.sep).join("/") : relative;
}

export function makeFailure({ gate, file = "", line = null, column = null, rule, message = "", testId = null }, root = process.cwd()) {
  const normalizedFile = normalizeRepoPath(file, root);
  const identityRule = testId || rule || "UNKNOWN";
  const failureId = sha(`${gate}\n${normalizedFile}\n${identityRule}`);
  const failureClassId=failureId;
  // failureId is retained as a schema-v1 compatibility alias. Both fields
  // identify a stable failure class, not an individual diagnostic occurrence.
  return { failureId, failureClassId, gate, file: normalizedFile, line, column, rule: identityRule, message: String(message).trim(), testId };
}

export function failureSignature(failures) {
  if (!failures.length) return null;
  const tuples = [...new Set(failures.map(f => `${f.gate}\t${f.file}\t${f.rule}`))].sort();
  return sha(tuples.join("\n"));
}

export function parseTsc(text, root = process.cwd()) {
  const failures = [];
  const re = /^(.*)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
  for (const match of text.matchAll(re)) {
    failures.push(makeFailure({
      gate: "typecheck", file: match[1], line: Number(match[2]), column: Number(match[3]), rule: match[4], message: match[5]
    }, root));
  }
  if (!failures.length && text.trim()) {
    failures.push(makeFailure({ gate:"typecheck", rule:"TSC_EXIT", message:text.trim().split(/\r?\n/).slice(-5).join(" ") }, root));
  }
  return failures;
}

// Biome 1.9.4's JSON reporter emits `message` as an array of rich-text spans
// (`[{elements,content}]`), not a plain string; the flat human-readable text
// is `description`. `location.span` is a two-element array of UTF-8 BYTE
// offsets into `location.sourceCode`, not an object -- converting it through
// a JS string index (rather than a Buffer) would silently shift every line
// after the first multi-byte character. Older/object-shaped fixtures
// (`span.start.line`) are preserved as a fallback.
function flattenBiomeMessage(d) {
  if (typeof d.description === "string" && d.description.trim()) return d.description;
  if (typeof d.message === "string") return d.message;
  if (Array.isArray(d.message)) return d.message.map(part => part?.content ?? "").join("");
  return "";
}

function biomeSpanLocation(loc) {
  const span = loc.span;
  if (Array.isArray(span) && typeof span[0] === "number" && typeof loc.sourceCode === "string") {
    const prefix = Buffer.from(loc.sourceCode, "utf8").subarray(0, span[0]).toString("utf8");
    const lastNewline = prefix.lastIndexOf("\n");
    return { line: prefix.split("\n").length, column: prefix.length - lastNewline };
  }
  const objSpan = span && typeof span === "object" ? span : {};
  return { line: objSpan.start?.line ?? loc.line ?? null, column: objSpan.start?.column ?? loc.column ?? null };
}

export function parseBiome(text, root = process.cwd()) {
  const parsed=parseJsonEnvelope(text);
  if(!parsed) return text.trim() ? [makeFailure({gate:"lint", rule:"BIOME_EXIT", message:text.trim().slice(0,1000)}, root)] : [];
  const diagnostics = parsed.diagnostics ?? parsed.summary?.diagnostics ?? [];
  return diagnostics.map(d => {
    const loc = d.location ?? {};
    const file = loc.path?.file ?? loc.path ?? d.filePath ?? "";
    const category = String(d.category ?? d.rule ?? "BIOME");
    const rule = category.replace(/^lint\//,"");
    const message = flattenBiomeMessage(d);
    const { line, column } = biomeSpanLocation(loc);
    return makeFailure({ gate:"lint", file, line, column, rule, message }, root);
  });
}

function flattenPlaywrightSuites(suites, inheritedFile="", out=[]) {
  for (const suite of suites ?? []) {
    const file=suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) out.push({...spec,file:spec.file ?? file});
    flattenPlaywrightSuites(suite.suites,file,out);
  }
  return out;
}

export function parsePlaywright(text, root = process.cwd()) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return text.trim() ? [makeFailure({gate:"e2e", rule:"PLAYWRIGHT_EXIT", message:text.trim().slice(0,1000)}, root)] : []; }
  const failures = [];
  for (const spec of flattenPlaywrightSuites(parsed.suites)) {
    for (const test of spec.tests ?? []) {
      const bad = (test.results ?? []).find(r => !["passed","skipped"].includes(r.status));
      if (!bad) continue;
      const title = spec.title ?? test.title ?? "unknown";
      const ruleMatch = title.match(/^\s*(R[1-8])\b/);
      const rule = ruleMatch ? ruleMatch[1] : title;
      failures.push(makeFailure({ gate:"e2e", file: spec.file ?? "", line: spec.line ?? null, column: spec.column ?? null, rule, testId: rule, message: bad.error?.message ?? bad.error?.stack ?? `Playwright status ${bad.status}` }, root));
    }
  }
  return failures;
}

export function playwrightSelection(text){
  let parsed;
  try { parsed=JSON.parse(text); } catch { return {testCount:0,testIds:[]}; }
  const specs=flattenPlaywrightSuites(parsed.suites);
  const tests=specs.flatMap(spec=>(spec.tests??[]).map(test=>({spec,test})));
  const ids=[];
  for(const {spec} of tests){
    const match=String(spec.title??"").match(/^\s*(R[1-8])\b/);
    if(match) ids.push(match[1]);
  }
  return {testCount:tests.length,testIds:[...new Set(ids)].sort()};
}

export function parseBuild(text, root=process.cwd()) {
  const failures=[];
  const location=/^(.+?\.(?:[cm]?[jt]sx?|css|html)):(\d+):(\d+):\s*(.+)$/gm;
  for(const match of text.matchAll(location)){
    failures.push(makeFailure({gate:"build",file:match[1],line:Number(match[2]),column:Number(match[3]),rule:"BUILD_DIAGNOSTIC",message:match[4]},root));
  }
  const resolve=/\b(?:failed to resolve import|could not resolve)\s+["'][^"']+["']\s+(?:from|in)\s+["']([^"']+)["']/gi;
  for(const match of text.matchAll(resolve)){
    failures.push(makeFailure({gate:"build",file:match[1],rule:"BUILD_RESOLVE",message:match[0]},root));
  }
  if(failures.length) return failures;
  return [makeFailure({ gate:"build", rule:"BUILD_EXIT", message:text.trim() ? text.trim().split(/\r?\n/).slice(-10).join(" ") : "build command exited non-zero" }, root)];
}
