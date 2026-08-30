import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir, copyHarnessCore, run } from "../helpers/test-utils.mjs";

function fakeProject(overrides = {}) {
  const src = tempDir("lotus-evidence-source-");
  const record = { schemaVersion: 1, cycleId: "20260830T000000000Z-abc1234", startedAt: "2026-08-30T00:00:00.000Z", finishedAt: "2026-08-30T00:01:00.000Z", tier: 1, startCommit: "abc1234", endCommit: "abc1234", initialSignature: null, finalSignature: null, signatureHistory: [], attemptHistory: [], attempts: 0, outcome: "green", reason: "all_gates_passed", durationSec: 60, harnessDurationSec: 60, invocationWaitSec: 0, filesChanged: [], attemptedPaths: [], discardedFailureIds: [], dyad: { version: null, mode: "gui-build", provider: null, model: null, reasoningEffort: null, metadataSource: "undeclared" } };
  fs.writeFileSync(path.join(src, "cycles.jsonl"), overrides.cycles ?? JSON.stringify(record) + "\n");
  fs.writeFileSync(path.join(src, "gate-report.json"), overrides.gateReport ?? JSON.stringify({ schemaVersion: 1, runId: "run", tier: 0, commit: "abc", status: "passed", failureCount: 0, failureSignature: null, durationMs: 1, gates: [] }));
  fs.writeFileSync(path.join(src, "import-report.md"), overrides.importReport ?? "# Lovable Import Report\n");
  fs.writeFileSync(path.join(src, "harness.json"), overrides.harness ?? JSON.stringify({ schemaVersion: 1, harnessVersion: "0.1.0", source: { kind: "local", identity: "x" }, nodeVersion: "22.16.0", commands: { build: ["true"], dev: ["true"], typecheck: ["true"], lint: ["true"] }, writableGlobs: ["src/**"] }));
  return src;
}

test("evidence.sh copies validated, secret-clean evidence into evidence/<project>/",()=>{
  const root=tempDir(); copyHarnessCore(root);
  const source=fakeProject();
  const r=run(["bash","scripts/evidence.sh","coffee",source],{cwd:root,allowFailure:true});
  assert.equal(r.status,0,r.stderr||r.stdout);
  for(const f of ["cycles.jsonl","gate-report.json","import-report.md","harness.json"]) assert.equal(fs.existsSync(path.join(root,"evidence","coffee",f)),true,`${f} missing`);
});

test("evidence.sh refuses on an invalid cycles.jsonl line without copying anything",()=>{
  const root=tempDir(); copyHarnessCore(root);
  const source=fakeProject({cycles:"{not valid json\n"});
  const r=run(["bash","scripts/evidence.sh","coffee",source],{cwd:root,allowFailure:true});
  assert.notEqual(r.status,0);
  assert.equal(fs.existsSync(path.join(root,"evidence","coffee")),false);
});

test("evidence.sh refuses and never prints the matched value when a copied file contains a high-confidence secret",()=>{
  const root=tempDir(); copyHarnessCore(root);
  const secret=["sk","proj","abcdefghijklmnopqrstuvwxyz123456"].join("-");
  const source=fakeProject({importReport:`# Lovable Import Report\ntoken=${secret}\n`});
  const r=run(["bash","scripts/evidence.sh","coffee",source],{cwd:root,allowFailure:true});
  assert.notEqual(r.status,0);
  const output=`${r.stderr}${r.stdout}`;
  assert.match(output,/OPENAI_KEY/);
  assert.doesNotMatch(output,new RegExp(secret));
  assert.equal(fs.existsSync(path.join(root,"evidence","coffee")),false);
});
