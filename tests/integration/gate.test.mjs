import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir,initRepo,commitAll,copyHarnessCore,run,readJson,PROJECT_ROOT } from "../helpers/test-utils.mjs";

function setup(){
  const root=tempDir(); initRepo(root); copyHarnessCore(root); fs.mkdirSync(path.join(root,"src"),{recursive:true}); fs.writeFileSync(path.join(root,"src/state.txt"),"FIXED\n");
  fs.mkdirSync(path.join(root,"tests/helpers"),{recursive:true}); fs.cpSync(path.join(PROJECT_ROOT,"tests/helpers/gate-driver.mjs"),path.join(root,"tests/helpers/gate-driver.mjs"));
  const pass=[process.execPath,"tests/helpers/gate-driver.mjs","lint-pass"];
  const cfg={schemaVersion:1,harnessVersion:"0.1.0",source:{kind:"local",identity:"fixture"},nodeVersion:process.version.slice(1),commands:{lint:pass,typecheck:[process.execPath,"tests/helpers/gate-driver.mjs","typecheck"],build:[process.execPath,"tests/helpers/gate-driver.mjs","build-pass"],dev:[process.execPath,"-e","setInterval(()=>{},1000)"],e2e:[process.execPath,"-e","process.exit(0)"]},writableGlobs:["src/**"],serverReadyTimeoutMs:1000};
  fs.writeFileSync(path.join(root,"harness.json"),JSON.stringify(cfg,null,2)); fs.writeFileSync(path.join(root,"cycles.jsonl"),""); commitAll(root,"fixture"); return root;
}

test("GATE-001 through GATE-005 tier 0 runs ordered stages and passes",()=>{
  const root=setup(); const r=run(["bash","scripts/gate.sh","0"],{cwd:root,allowFailure:true}); assert.equal(r.status,0,r.stderr);
  const report=readJson(path.join(root,"gate-report.json"));
  assert.equal(report.status,"passed");
  assert.deepEqual(report.gates.map(g=>g.gate),["standards","lint","typecheck","build"]);
  assert.deepEqual(report.gates.map(g=>g.status),["passed","passed","passed","passed"]);
});

test("GATE-004 fail-fast records later stages as not_run",()=>{
  const root=setup(); fs.writeFileSync(path.join(root,"src/state.txt"),"BROKEN\n"); commitAll(root,"defect");
  const r=run(["bash","scripts/gate.sh","0"],{cwd:root,allowFailure:true}); assert.equal(r.status,1);
  const report=readJson(path.join(root,"gate-report.json"));
  assert.equal(report.status,"failed");
  assert.equal(report.gates[2].gate,"typecheck");
  assert.equal(report.gates[2].status,"failed");
  assert.equal(report.gates[3].status,"not_run");
  assert.equal(report.failureCount,1);
  assert.match(report.failureSignature,/^sha256:/);
});

test("GATE-001 invalid tier exits precondition code",()=>{
  const root=setup(); const r=run(["bash","scripts/gate.sh","9"],{cwd:root,allowFailure:true}); assert.equal(r.status,2);
});

test("GATE-011 tier 0 standards ignores generator-owned unowned paths",()=>{
  const root=setup();
  fs.mkdirSync(path.join(root,"src/components/ui"),{recursive:true});
  fs.writeFileSync(path.join(root,"src/routeTree.gen.ts"),"export const routeTree = {} as any;\n");
  fs.writeFileSync(path.join(root,"src/components/ui/button.tsx"),"const casted = props as any;\n");
  commitAll(root,"add generator-owned files");
  const r=run(["bash","scripts/gate.sh","0"],{cwd:root,allowFailure:true}); assert.equal(r.status,0,r.stderr);
  const report=readJson(path.join(root,"gate-report.json"));
  assert.equal(report.gates[0].gate,"standards");
  assert.equal(report.gates[0].status,"passed");
});
