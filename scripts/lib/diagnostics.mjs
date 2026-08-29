import crypto from "node:crypto";
import path from "node:path";

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
  return { failureId, gate, file: normalizedFile, line, column, rule: identityRule, message: String(message).trim(), testId };
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

export function parseBiome(text, root = process.cwd()) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return text.trim() ? [makeFailure({gate:"lint", rule:"BIOME_EXIT", message:text.trim().slice(0,1000)}, root)] : []; }
  const diagnostics = parsed.diagnostics ?? parsed.summary?.diagnostics ?? [];
  return diagnostics.map(d => {
    const loc = d.location ?? {};
    const span = loc.span ?? {};
    const file = loc.path?.file ?? loc.path ?? d.filePath ?? "";
    const category = String(d.category ?? d.rule ?? "BIOME");
    const rule = category.replace(/^lint\//,"");
    const message = typeof d.message === "string" ? d.message : JSON.stringify(d.message ?? "");
    return makeFailure({ gate:"lint", file, line: span.start?.line ?? loc.line ?? null, column: span.start?.column ?? loc.column ?? null, rule, message }, root);
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

export function parseBuild(text, root=process.cwd()) {
  return [makeFailure({ gate:"build", rule:"BUILD_EXIT", message:text.trim() ? text.trim().split(/\r?\n/).slice(-10).join(" ") : "build command exited non-zero" }, root)];
}
