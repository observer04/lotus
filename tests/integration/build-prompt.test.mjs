import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir,initRepo,commitAll,copyHarnessCore,run } from "../helpers/test-utils.mjs";
import { makeFailure,failureSignature } from "../../scripts/lib/diagnostics.mjs";

function setup(){
  const root=tempDir(); initRepo(root); copyHarnessCore(root);
  fs.mkdirSync(path.join(root,"src/routes"),{recursive:true});
  fs.writeFileSync(path.join(root,"src/routes/index.tsx"),Array.from({length:20},(_,i)=>`line ${i+1}`).join("\n"));
  fs.writeFileSync(path.join(root,"src/routeTree.gen.ts"),"export const routeTree = {} as any;\n");
  fs.writeFileSync(path.join(root,"harness.json"),JSON.stringify({schemaVersion:1,harnessVersion:"0.1.0",source:{kind:"local",identity:"fixture"},nodeVersion:process.version.slice(1),commands:{build:["true"],dev:["true"],typecheck:["true"],lint:["true"]},writableGlobs:["src/**"]}));
  commitAll(root,"fixture");
  return root;
}

test("build-prompt.sh loads unownedGlobs so the CLI packet matches cycle.mjs's exclusion behavior",()=>{
  const root=setup();
  const owned=makeFailure({gate:"lint",file:"src/routes/index.tsx",line:10,column:1,rule:"style/noNonNullAssertion",message:"Forbidden non-null assertion."},root);
  const unowned=makeFailure({gate:"standards",file:"src/routeTree.gen.ts",line:1,column:1,rule:"AS_ANY",message:"banned pattern"},root);
  const failures=[owned,unowned];
  const report={schemaVersion:1,runId:"run",tier:0,commit:"abc",status:"failed",failureCount:failures.length,failureSignature:failureSignature(failures),durationMs:1,gates:[{gate:"standards",status:"failed",durationMs:1,failures:[unowned]},{gate:"lint",status:"failed",durationMs:1,failures:[owned]}]};
  fs.writeFileSync(path.join(root,"gate-report.json"),JSON.stringify(report));
  const r=run(["bash","scripts/build-prompt.sh","gate-report.json"],{cwd:root});
  assert.match(r.stdout,/src\/routes\/index\.tsx:10/);
  assert.match(r.stdout,/## RELEVANT SOURCE/);
  assert.doesNotMatch(r.stdout,/### src\/routeTree\.gen\.ts/);
  assert.ok(r.stdout.includes("src/**/*.gen.ts"),"constraints must name the unowned globs, same as cycle.mjs's packet");
});
