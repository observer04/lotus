#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertCycleRecord } from "./lib/schema.mjs";
import { scanSecrets } from "./lib/secrets.mjs";

const ROOT = process.cwd();
const [project, sourceArg] = process.argv.slice(2);
if (!project || !sourceArg) { console.error("usage: scripts/evidence.sh <project-name> <imported-project-path>"); process.exit(2); }
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(project)) { console.error("project name must be a simple identifier"); process.exit(2); }
const sourceRoot = path.resolve(sourceArg);
const FILES = ["cycles.jsonl", "gate-report.json", "import-report.md", "harness.json"];

const missing = FILES.filter(f => !fs.existsSync(path.join(sourceRoot, f)));
if (missing.length) { console.error(`missing evidence files in ${sourceRoot}: ${missing.join(", ")}`); process.exit(1); }

// Stage first, validate the stage, then copy -- the same transactional shape
// as the importer, so a rejected validation or secret scan never touches
// evidence/ at all.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lotus-evidence-"));
try {
  for (const f of FILES) fs.copyFileSync(path.join(sourceRoot, f), path.join(tmp, f));

  const cyclesText = fs.readFileSync(path.join(tmp, "cycles.jsonl"), "utf8");
  const lines = cyclesText.split(/\r?\n/).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    let record;
    try { record = JSON.parse(line); }
    catch (error) { console.error(`cycles.jsonl line ${i + 1} is not valid JSON: ${error.message}`); process.exit(1); }
    try { assertCycleRecord(record); }
    catch (error) { console.error(`cycles.jsonl line ${i + 1} failed schema validation: ${error.message}`); process.exit(1); }
  }

  const findings = scanSecrets({ cwd: tmp, policyPath: path.join(ROOT, "config", "secret-patterns.json") });
  if (findings.length) {
    const locations = findings.map(f => `${f.id} ${f.path}:${f.line}`).join(", ");
    console.error(`refusing to copy evidence; possible committed secrets found: ${locations}`);
    process.exit(1);
  }

  const destDir = path.join(ROOT, "evidence", project);
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of FILES) fs.copyFileSync(path.join(tmp, f), path.join(destDir, f));
  console.log(`Evidence copied to evidence/${project}/ (${FILES.length} files, ${lines.length} cycle record(s) schema-valid)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
