import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPrompt,redact } from "../../scripts/lib/prompt.mjs";
import { makeFailure,failureSignature } from "../../scripts/lib/diagnostics.mjs";
import { tempDir } from "../helpers/test-utils.mjs";

function report(root,failures){return {schemaVersion:1,runId:"run",tier:1,commit:"abc123",status:"failed",failureCount:failures.length,failureSignature:failureSignature(failures),durationMs:1,gates:[{gate:"e2e",status:"failed",durationMs:1,failures}]};}

test("PRM deterministic packet includes bounded source and prior attempts",()=>{
  const root=tempDir(); fs.mkdirSync(path.join(root,"src"));
  fs.writeFileSync(path.join(root,"src/a.ts"),Array.from({length:50},(_,i)=>`line ${i+1}`).join("\n"));
  const f=makeFailure({gate:"typecheck",file:"src/a.ts",line:25,rule:"TS1",message:"broken"},root);
  const r={...report(root,[f]),tier:0,gates:[{gate:"typecheck",status:"failed",durationMs:1,failures:[f]}]};
  const opts={cwd:root,priorAttempts:[{attempt:1,beforeSha:"aaa",afterSha:"bbb",changedPaths:["src/a.ts"],resultingSignature:"sig",failureCount:1}]};
  const a=buildPrompt(r,opts),b=buildPrompt(r,opts);
  assert.equal(a,b);
  assert.match(a,/src\/a\.ts:25/);
  assert.match(a,/attempt 1: aaa -> bbb/);
  assert.match(a,/Writable paths only: src\/\*\*/);
});

test("PRM e2e packet maps nearby test id to candidate src context",()=>{
  const root=tempDir(); fs.mkdirSync(path.join(root,"src")); fs.mkdirSync(path.join(root,"e2e"));
  fs.writeFileSync(path.join(root,"src/App.tsx"),'<button data-testid="checkout-submit">Go</button>\n');
  fs.writeFileSync(path.join(root,"e2e/spec.ts"),'test("R1 — x", async ({page}) => { await page.getByTestId("checkout-submit").click(); });\n');
  const f=makeFailure({gate:"e2e",file:"e2e/spec.ts",line:1,rule:"R1",testId:"R1",message:"failed"},root);
  const text=buildPrompt(report(root,[f]),{cwd:root});
  assert.match(text,/candidate for data-testid=checkout-submit/);
  assert.match(text,/src\/App\.tsx/);
});

test("PRM redacts secrets and enforces UTF-8 byte ceiling",()=>{
  const secret="OPENAI_API_KEY=" + "sk-" + "abcdefghijklmnopqrstuvwxyz123456";
  assert.doesNotMatch(redact(secret),/abcdefghijklmnopqrstuvwxyz/);
  const root=tempDir(); const f=makeFailure({gate:"build",rule:"BUILD_EXIT",message:"🔥".repeat(5000)},root);
  const r={...report(root,[f]),gates:[{gate:"build",status:"failed",durationMs:1,failures:[f]}]};
  const text=buildPrompt(r,{cwd:root,byteCeiling:1024});
  assert.ok(Buffer.byteLength(text,"utf8")<=1024);
  assert.match(text,/TRUNCATED/);
});

test("PRM-003 packet shows only first 20 failures and marks truncation",()=>{
  const root=tempDir(); const failures=Array.from({length:25},(_,i)=>makeFailure({gate:"lint",file:`src/f${String(i).padStart(2,"0")}.ts`,rule:`R${i}`,message:`m${i}`},root));
  const r={...report(root,failures),tier:0,gates:[{gate:"lint",status:"failed",durationMs:1,failures}]}; const text=buildPrompt(r,{cwd:root}); assert.match(text,/FAILURES \(25, showing 20\)/); assert.doesNotMatch(text,/src\/f24\.ts/);
});

test("PRM-004 source context follows configured writable roots instead of hardcoding src",()=>{
  const root=tempDir(); fs.mkdirSync(path.join(root,"app"),{recursive:true});
  fs.writeFileSync(path.join(root,"app/main.ts"),"const one = 1;\nconst broken = nope;\n");
  const f=makeFailure({gate:"typecheck",file:"app/main.ts",line:2,rule:"TS1",message:"broken"},root);
  const r={...report(root,[f]),tier:0,gates:[{gate:"typecheck",status:"failed",durationMs:1,failures:[f]}]};
  const text=buildPrompt(r,{cwd:root,writableGlobs:["app/**"]});
  assert.match(text,/app\/main\.ts:2/);
  assert.match(text,/const broken/);
});

test("GATE-011 unowned source never yields a RELEVANT SOURCE block and constraints name the unowned globs",()=>{
  const root=tempDir(); fs.mkdirSync(path.join(root,"src"),{recursive:true});
  fs.writeFileSync(path.join(root,"src/routeTree.gen.ts"),Array.from({length:10},(_,i)=>`line ${i+1}`).join("\n"));
  const f=makeFailure({gate:"standards",file:"src/routeTree.gen.ts",line:3,rule:"AS_ANY",message:"banned pattern"},root);
  const r={...report(root,[f]),tier:0,gates:[{gate:"standards",status:"failed",durationMs:1,failures:[f]}]};
  const text=buildPrompt(r,{cwd:root,unownedGlobs:["src/**/*.gen.ts"]});
  assert.doesNotMatch(text,/RELEVANT SOURCE/);
  assert.ok(text.includes("src/**/*.gen.ts"),"constraints must name the unowned globs");
});
