import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { reconcileLockfile } from "../../scripts/lib/lockfile.mjs";
import { tempDir } from "../helpers/test-utils.mjs";

// Simulates `npm install --package-lock-only` (writes lockPath with the next
// scripted content) and `npm ci --dry-run` (returns the next scripted exit
// status) without shelling out to real npm.
function fakeRun(lockPath,{contents,dryRunStatuses}){
  let installCalls=0,ciCalls=0;
  const fn=(argv)=>{
    if(argv[0]==="npm"&&argv[1]==="install"){
      installCalls++;
      if(installCalls>contents.length) throw new Error("fake npm install called more times than scripted");
      fs.writeFileSync(lockPath,contents[installCalls-1]);
      return {status:0,stdout:"",stderr:""};
    }
    if(argv[0]==="npm"&&argv[1]==="ci"){
      ciCalls++;
      if(ciCalls>dryRunStatuses.length) throw new Error("fake npm ci called more times than scripted");
      const status=dryRunStatuses[ciCalls-1];
      return {status,stdout:"",stderr:status?"npm error Missing: ajv@6.15.0 from lock file":""};
    }
    throw new Error(`unexpected argv ${argv.join(" ")}`);
  };
  fn.calls=()=>({installCalls,ciCalls});
  return fn;
}

test("IMP-005 reconcileLockfile retries past an initially ci-invalid lock and confirms byte-stability",()=>{
  const root=tempDir(); const lockPath=path.join(root,"package-lock.json");
  // Mirrors the measured cozy-coffee-cart/daily-wins-tracker fixpoint: pass 1
  // is ci-invalid; passes 2 and 3 are ci-valid but still shifting content;
  // pass 4 repeats pass 3's content, confirming the fixpoint.
  const run=fakeRun(lockPath,{contents:["L1","L2","L3","L3"],dryRunStatuses:[1,0,0,0]});
  const result=reconcileLockfile({cwd:root,lockPath,run,hash:x=>x});
  assert.deepEqual(result,{passes:4,stable:true});
  assert.deepEqual(run.calls(),{installCalls:4,ciCalls:4});
});

test("IMP-005 reconcileLockfile still requires two consecutive identical passes even when pass 1 is already ci-valid",()=>{
  const root=tempDir(); const lockPath=path.join(root,"package-lock.json");
  const run=fakeRun(lockPath,{contents:["A","A"],dryRunStatuses:[0,0]});
  const result=reconcileLockfile({cwd:root,lockPath,run,hash:x=>x});
  assert.deepEqual(result,{passes:2,stable:true});
});

test("IMP-005 reconcileLockfile throws after the pass cap when the lock never becomes ci-valid",()=>{
  const root=tempDir(); const lockPath=path.join(root,"package-lock.json");
  const run=fakeRun(lockPath,{contents:["A","B","C"],dryRunStatuses:[1,1,1]});
  assert.throws(()=>reconcileLockfile({cwd:root,lockPath,run,hash:x=>x,maxPasses:3}),/Missing: ajv/);
  assert.deepEqual(run.calls(),{installCalls:3,ciCalls:3});
});

test("IMP-005 reconcileLockfile throws after the pass cap when content never stabilizes despite being ci-valid",()=>{
  const root=tempDir(); const lockPath=path.join(root,"package-lock.json");
  const run=fakeRun(lockPath,{contents:["A","B","C"],dryRunStatuses:[0,0,0]});
  assert.throws(()=>reconcileLockfile({cwd:root,lockPath,run,hash:x=>x,maxPasses:3}),/stable/);
  assert.deepEqual(run.calls(),{installCalls:3,ciCalls:3});
});

test("IMP-005 reconcileLockfile propagates a hard install failure immediately",()=>{
  const root=tempDir(); const lockPath=path.join(root,"package-lock.json");
  const run=(argv)=>{
    if(argv[1]==="install") return {status:1,stdout:"",stderr:"npm error network timeout"};
    throw new Error("ci should not be reached after a failed install");
  };
  assert.throws(()=>reconcileLockfile({cwd:root,lockPath,run,hash:x=>x}),/network timeout/);
});
