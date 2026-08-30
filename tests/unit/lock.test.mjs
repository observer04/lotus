import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { acquireLock, releaseLock } from "../../scripts/lib/lock.mjs";
import { tempDir } from "../helpers/test-utils.mjs";

test("CYC-019 acquireLock succeeds when no lock file exists and writes pid/start time",()=>{
  const root=tempDir(); const lockPath=path.join(root,".harness","cycle.lock");
  const result=acquireLock({lockPath,pid:12345});
  assert.equal(result.ok,true);
  const written=JSON.parse(fs.readFileSync(lockPath,"utf8"));
  assert.equal(written.pid,12345);
  assert.ok(written.startedAt);
});

test("CYC-019 acquireLock refuses while the owning pid is still alive",()=>{
  const root=tempDir(); const lockPath=path.join(root,".harness","cycle.lock");
  // Our own test process pid is guaranteed alive for the duration of this test.
  fs.mkdirSync(path.dirname(lockPath),{recursive:true});
  fs.writeFileSync(lockPath,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  const result=acquireLock({lockPath,pid:99999});
  assert.equal(result.ok,false);
  assert.equal(result.existing.pid,process.pid);
});

test("CYC-019 acquireLock reclaims a stale lock whose pid is no longer running",()=>{
  const root=tempDir(); const lockPath=path.join(root,".harness","cycle.lock");
  const child=spawnSync(process.execPath,["-e","process.exit(0)"]);
  const deadPid=child.pid;
  fs.mkdirSync(path.dirname(lockPath),{recursive:true});
  fs.writeFileSync(lockPath,JSON.stringify({pid:deadPid,startedAt:new Date().toISOString()}));
  const result=acquireLock({lockPath,pid:42});
  assert.equal(result.ok,true);
  assert.equal(JSON.parse(fs.readFileSync(lockPath,"utf8")).pid,42);
});

test("CYC-019 releaseLock removes the lock file and tolerates it already being gone",()=>{
  const root=tempDir(); const lockPath=path.join(root,".harness","cycle.lock");
  acquireLock({lockPath,pid:1});
  assert.equal(fs.existsSync(lockPath),true);
  releaseLock({lockPath});
  assert.equal(fs.existsSync(lockPath),false);
  assert.doesNotThrow(()=>releaseLock({lockPath}));
});
