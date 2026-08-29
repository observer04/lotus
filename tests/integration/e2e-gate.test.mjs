import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir,initRepo,commitAll,copyHarnessCore,run,readJson,PROJECT_ROOT } from "../helpers/test-utils.mjs";

function setup(){
  const root=tempDir("lotus-e2e-"); initRepo(root); copyHarnessCore(root); fs.mkdirSync(path.join(root,"src"),{recursive:true}); fs.writeFileSync(path.join(root,"src/a.js"),"ok\n");
  fs.mkdirSync(path.join(root,"tests/helpers"),{recursive:true});
  for(const f of ["gate-driver.mjs","dev-server.mjs","e2e-driver.mjs"]) fs.cpSync(path.join(PROJECT_ROOT,"tests/helpers",f),path.join(root,"tests/helpers",f));
  const cfg={schemaVersion:1,harnessVersion:"0.1.0",source:{kind:"local",identity:"e2e"},nodeVersion:process.version.slice(1),commands:{lint:[process.execPath,"tests/helpers/gate-driver.mjs","lint-pass"],typecheck:[process.execPath,"-e","process.exit(0)"],build:[process.execPath,"-e","process.exit(0)"],dev:[process.execPath,"tests/helpers/dev-server.mjs"],e2e:[process.execPath,"tests/helpers/e2e-driver.mjs"]},writableGlobs:["src/**"],serverReadyTimeoutMs:3000};
  fs.writeFileSync(path.join(root,"harness.json"),JSON.stringify(cfg,null,2)+"\n"); fs.writeFileSync(path.join(root,"cycles.jsonl"),""); commitAll(root,"fixture"); return root;
}

test("GATE-009/GATE-010 non-reproducible e2e is inconclusive and not a fix input",()=>{
  const root=setup(); const r=run(["bash","scripts/gate.sh","1"],{cwd:root,env:{HARNESS_E2E_DRIVER_MODE:"flaky"},timeout:15000,allowFailure:true});
  assert.equal(r.status,3,r.stderr); const report=readJson(path.join(root,"gate-report.json")); assert.equal(report.status,"inconclusive"); const e2e=report.gates.at(-1); assert.equal(e2e.status,"inconclusive"); assert.deepEqual(e2e.discardedFailureIds,["R4"]); assert.equal(report.failureCount,0);
});

test("GATE-009 reproducible e2e failure survives confirmation",()=>{
  const root=setup(); const r=run(["bash","scripts/gate.sh","1"],{cwd:root,env:{HARNESS_E2E_DRIVER_MODE:"confirmed"},timeout:15000,allowFailure:true});
  assert.equal(r.status,1,r.stderr); const report=readJson(path.join(root,"gate-report.json")); assert.equal(report.status,"failed"); const e2e=report.gates.at(-1); assert.equal(e2e.status,"failed"); assert.equal(e2e.failures[0].rule,"R4"); assert.equal(report.failureCount,1);
});
