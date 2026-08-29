import test from "node:test";
import assert from "node:assert/strict";
import { assertGateReport,assertCycleRecord } from "../../scripts/lib/schema.mjs";

test("GATE-005 schema rejects inconsistent failure count",()=>{
  assert.throws(()=>assertGateReport({schemaVersion:1,runId:"x",tier:0,commit:"a",status:"failed",failureCount:2,failureSignature:"sha256:x",durationMs:1,gates:[{gate:"lint",status:"failed",failures:[],durationMs:1}]}),/does not match/);
});

test("CYC-016 cycle schema accepts declared outcomes only",()=>{
  const base={schemaVersion:1,cycleId:"c",startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),tier:0,startCommit:"a",endCommit:"b",attempts:1,outcome:"green",reason:"all_gates_passed",durationSec:1,filesChanged:[],dyad:{version:"1.12.0"}};
  assert.equal(assertCycleRecord(base),base);
  assert.throws(()=>assertCycleRecord({...base,outcome:"mystery"}),/invalid cycle outcome/);
});

test("IMP-010 harness schema requires argv-array commands",async()=>{
  const {assertHarness}=await import("../../scripts/lib/schema.mjs");
  const good={schemaVersion:1,harnessVersion:"0.1.0",source:{kind:"local",identity:"x"},nodeVersion:"22.16.0",commands:{build:["npm","run","build"],dev:["npm","run","dev"],typecheck:["npm","run","typecheck"],lint:["npx","biome"]},writableGlobs:["src/**"]};
  assert.equal(assertHarness(good),good);
  assert.throws(()=>assertHarness({...good,commands:{...good.commands,build:"npm run build"}}),/commands\.build/);
});
