import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { tempDir,initRepo,commitAll,copyHarnessCore,run,readJsonl,PROJECT_ROOT,git } from "../helpers/test-utils.mjs";

function setupCycle(initialState){
  const root=tempDir("lotus-cycle-"); initRepo(root); copyHarnessCore(root);
  fs.mkdirSync(path.join(root,"src"),{recursive:true}); fs.writeFileSync(path.join(root,"src/state.txt"),"FIXED\n");
  fs.mkdirSync(path.join(root,"tests/helpers"),{recursive:true});
  fs.cpSync(path.join(PROJECT_ROOT,"tests/helpers/gate-driver.mjs"),path.join(root,"tests/helpers/gate-driver.mjs"));
  fs.cpSync(path.join(PROJECT_ROOT,"tests/helpers/fake-fixer.mjs"),path.join(root,"tests/helpers/fake-fixer.mjs"));
  const cfg={schemaVersion:1,harnessVersion:"0.1.0",source:{kind:"local",identity:"cycle-fixture"},nodeVersion:process.version.slice(1),commands:{
    lint:[process.execPath,"tests/helpers/gate-driver.mjs","lint-pass"],
    typecheck:[process.execPath,"tests/helpers/gate-driver.mjs","typecheck"],
    build:[process.execPath,"tests/helpers/gate-driver.mjs","build-pass"],
    dev:[process.execPath,"-e","setInterval(()=>{},1000)"],
    e2e:[process.execPath,"-e","process.exit(0)"]
  },writableGlobs:["src/**"],serverReadyTimeoutMs:1000};
  fs.writeFileSync(path.join(root,"harness.json"),JSON.stringify(cfg,null,2)+"\n"); fs.writeFileSync(path.join(root,"cycles.jsonl"),"");
  const green=commitAll(root,"harness-green-v1"); git(root,["update-ref","refs/harness/last-green",green]);
  fs.writeFileSync(path.join(root,"src/state.txt"),`${initialState}\n`); const red=commitAll(root,`defect:${initialState}`);
  return {root,green,red};
}
function cycle(root,mode){
  return run(["bash","scripts/cycle.sh","0"],{cwd:root,env:{HARNESS_FIXER_EXEC:process.execPath,HARNESS_FIXER_ARGS_JSON:JSON.stringify(["tests/helpers/fake-fixer.mjs",mode]),HARNESS_INVOCATION_TIMEOUT_MS:"5000",HARNESS_CYCLE_TIMEOUT_MS:"30000",HARNESS_POLL_MS:"10",HARNESS_STABLE_POLLS:"1",DYAD_PROVIDER:"test",DYAD_MODEL:"fake",DYAD_REASONING_EFFORT:"none"},timeout:45000,allowFailure:true});
}
function codeState(root){return fs.readFileSync(path.join(root,"src/state.txt"),"utf8").trim();}

async function interactiveCycle(root,{commit=false}={}){
  const child=spawn("bash",["scripts/cycle.sh","0"],{cwd:root,env:{
    ...process.env,
    HARNESS_INVOCATION_TIMEOUT_MS:"5000",
    HARNESS_CYCLE_TIMEOUT_MS:"30000",
    HARNESS_POLL_MS:"20",
    HARNESS_COMMIT_STABLE_POLLS:"2",
    HARNESS_DIRTY_STABLE_POLLS:"2",
    DYAD_VERSION:"1.12.0",
    DYAD_PROVIDER:"test",
    DYAD_MODEL:"interactive-fixture",
    DYAD_REASONING_EFFORT:"none"
  },stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.on("data",d=>stdout+=d);
  child.stderr.on("data",d=>stderr+=d);
  const prompt=path.join(root,".harness","active-prompt.md");
  const deadline=Date.now()+4000;
  while(!fs.existsSync(prompt)&&Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(fs.existsSync(prompt),true,stdout+stderr);
  fs.writeFileSync(path.join(root,"src/state.txt"),"FIXED\n");
  if(commit) commitAll(root,"mode-b:test");
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("interactive cycle timed out"));},8000);
    child.on("error",reject);
    child.on("close",status=>{clearTimeout(timer);resolve({status,stdout,stderr});});
  });
  return result;
}

test("CYC-002/CYC-017 fake fixer reaches verified green and records exactly one cycle",()=>{
  const {root}=setupCycle("BROKEN"); const r=cycle(root,"green"); assert.equal(r.status,0,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const records=readJsonl(path.join(root,"cycles.jsonl")); assert.equal(records.length,1); assert.equal(records[0].outcome,"green"); assert.equal(records[0].attempts,1); assert.deepEqual(records[0].filesChanged,["src/state.txt"]); assert.deepEqual(records[0].attemptedPaths,["src/state.txt"]);
  assert.equal(records[0].attemptHistory.length,1); assert.equal(records[0].signatureHistory.length,2);
  assert.equal(git(root,["status","--porcelain"]).stdout,"");
  const lastGreen=git(root,["rev-parse","refs/harness/last-green"]).stdout.trim(); assert.equal(lastGreen,records[0].endCommit);
});

test("CYC-008 tamper bait is caught structurally and additive rollback restores green",()=>{
  const {root,green}=setupCycle("BROKEN"); const r=cycle(root,"tamper"); assert.equal(r.status,5,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED"); assert.equal(fs.existsSync(path.join(root,"e2e/tamper.spec.js")),false);
  const records=readJsonl(path.join(root,"cycles.jsonl")); assert.equal(records.at(-1).outcome,"escalated_safety"); assert.equal(records.at(-1).reason,"safety_violation");
  assert.equal(records.at(-1).filesChanged.includes("e2e/tamper.spec.js"),false); assert.equal(records.at(-1).attemptedPaths.includes("e2e/tamper.spec.js"),true);
  assert.equal(records.at(-1).attemptHistory.at(-1).terminal,"safety_violation");
  assert.equal(git(root,["status","--porcelain"]).stdout,"");
  const log=git(root,["log","--format=%s","-6"]).stdout; assert.match(log,/fake-fixer:tamper/); assert.match(log,/restore verified tree/);
  assert.equal(git(root,["rev-parse","refs/harness/last-green"]).stdout.trim(),green);
});

test("CYC-011 A to B to A oscillation escalates on first recurrence",()=>{
  const {root}=setupCycle("A"); const r=cycle(root,"oscillate"); assert.equal(r.status,5,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1); assert.equal(rec.outcome,"escalated_oscillation"); assert.equal(rec.attempts,2);
});

test("CYC-012 two consecutive non-decreasing counts escalate",()=>{
  const {root}=setupCycle("A"); const r=cycle(root,"no-progress"); assert.equal(r.status,5,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1); assert.equal(rec.outcome,"escalated_no_progress"); assert.equal(rec.attempts,2);
});

test("CYC-009 three attempts on one signature escalate even while counts improve",()=>{
  const {root}=setupCycle("X3"); const r=cycle(root,"signature-budget"); assert.equal(r.status,5,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1); assert.equal(rec.outcome,"escalated_signature_budget"); assert.equal(rec.attempts,3);
});

test("CYC-008 banned source suppression is immediate safety escalation",()=>{
  const {root}=setupCycle("BROKEN"); const r=cycle(root,"banned-source"); assert.equal(r.status,5,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1); assert.equal(rec.outcome,"escalated_safety");
});

test("CYC-018 invocation timeout is distinct and rolls back partial cycle state",()=>{
  const {root}=setupCycle("BROKEN");
  const r=run(["bash","scripts/cycle.sh","0"],{cwd:root,env:{HARNESS_FIXER_EXEC:process.execPath,HARNESS_FIXER_ARGS_JSON:JSON.stringify(["tests/helpers/fake-fixer.mjs","sleep"]),HARNESS_INVOCATION_TIMEOUT_MS:"100",HARNESS_CYCLE_TIMEOUT_MS:"5000"},timeout:10000,allowFailure:true});
  assert.equal(r.status,4,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1); assert.equal(rec.outcome,"invocation_timeout"); assert.equal(git(root,["status","--porcelain"]).stdout,"");
  assert.equal(rec.attemptHistory.at(-1).terminal,"invocation_timeout");
});

test("CYC-018 missing last-green ref is recorded as precondition_failed",()=>{
  const {root}=setupCycle("BROKEN"); git(root,["update-ref","-d","refs/harness/last-green"]);
  const r=run(["bash","scripts/cycle.sh","0"],{cwd:root,timeout:10000,allowFailure:true}); assert.equal(r.status,2);
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1); assert.equal(rec.outcome,"precondition_failed"); assert.equal(rec.reason,"last_green_missing"); assert.equal(git(root,["status","--porcelain"]).stdout,"");
});

test("CYC bootstrap establishes immutable harness-green-v1 and last-green ref",()=>{
  const {root}=setupCycle("BROKEN"); git(root,["update-ref","-d","refs/harness/last-green"]);
  const r=run(["bash","scripts/cycle.sh","0","--bootstrap"],{cwd:root,env:{HARNESS_FIXER_EXEC:process.execPath,HARNESS_FIXER_ARGS_JSON:JSON.stringify(["tests/helpers/fake-fixer.mjs","green"]),HARNESS_INVOCATION_TIMEOUT_MS:"5000",HARNESS_CYCLE_TIMEOUT_MS:"30000"},timeout:15000,allowFailure:true});
  assert.equal(r.status,0,r.stderr||r.stdout); assert.equal(codeState(root),"FIXED");
  const tag=git(root,["rev-parse","refs/tags/harness-green-v1"]).stdout.trim(); const ref=git(root,["rev-parse","refs/harness/last-green"]).stdout.trim(); assert.equal(tag,ref);
});

test("CYC-004/CYC-005 real Mode B watcher accepts a stable Dyad-style commit",async()=>{
  const {root}=setupCycle("BROKEN");
  const r=await interactiveCycle(root,{commit:true});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(codeState(root),"FIXED");
  const rec=readJsonl(path.join(root,"cycles.jsonl")).at(-1);
  assert.equal(rec.outcome,"green");
  assert.equal(rec.dyad.metadataSource,"operator-declared");
  assert.equal(git(root,["status","--porcelain"]).stdout,"");
});

test("CYC-005/CYC-007 real Mode B watcher captures stable uncommitted source edits",async()=>{
  const {root}=setupCycle("BROKEN");
  const r=await interactiveCycle(root,{commit:false});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(codeState(root),"FIXED");
  assert.match(git(root,["log","--format=%s","-4"]).stdout,/capture repair attempt/);
  assert.equal(git(root,["status","--porcelain"]).stdout,"");
});

test("CYC-019 a live cycle lock refuses a second concurrent cycle.sh",()=>{
  const {root}=setupCycle("BROKEN");
  // A genuinely separate, still-running process -- not this test's own pid --
  // playing the role of an in-flight cycle.sh holding the lock.
  const holder=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});
  try{
    fs.mkdirSync(path.join(root,".harness"),{recursive:true});
    fs.writeFileSync(path.join(root,".harness","cycle.lock"),JSON.stringify({pid:holder.pid,startedAt:new Date().toISOString()}));
    const before=readJsonl(path.join(root,"cycles.jsonl"));
    const r=cycle(root,"noop");
    assert.equal(r.status,2,r.stderr||r.stdout);
    assert.match(r.stderr,/precondition:.*already running/);
    assert.deepEqual(readJsonl(path.join(root,"cycles.jsonl")),before,"a refused start must not append a cycle record");
    assert.equal(codeState(root),"BROKEN","a refused start must not touch the code tree");
  } finally { holder.kill("SIGKILL"); }
});

test("CYC-019 a stale lock (pid no longer running) is reclaimed and the cycle proceeds",()=>{
  const {root}=setupCycle("A");
  fs.mkdirSync(path.join(root,".harness"),{recursive:true});
  const dead=spawnSync(process.execPath,["-e","process.exit(0)"]);
  fs.writeFileSync(path.join(root,".harness","cycle.lock"),JSON.stringify({pid:dead.pid,startedAt:new Date().toISOString()}));
  const r=cycle(root,"green");
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(codeState(root),"FIXED");
  assert.equal(fs.existsSync(path.join(root,".harness","cycle.lock")),false,"the lock must be released again on a normal terminal path");
});

test("preflight warns, but does not block, when a same-named ~/dyad-apps copy exists",()=>{
  const {root}=setupCycle("A");
  const dyadAppsDir=tempDir("lotus-dyad-apps-");
  fs.mkdirSync(path.join(dyadAppsDir,path.basename(root)),{recursive:true});
  const r=run(["bash","scripts/cycle.sh","0"],{cwd:root,env:{HARNESS_FIXER_EXEC:process.execPath,HARNESS_FIXER_ARGS_JSON:JSON.stringify(["tests/helpers/fake-fixer.mjs","green"]),HARNESS_INVOCATION_TIMEOUT_MS:"5000",HARNESS_CYCLE_TIMEOUT_MS:"30000",HARNESS_POLL_MS:"10",HARNESS_STABLE_POLLS:"1",HARNESS_DYAD_APPS_DIR:dyadAppsDir},timeout:45000,allowFailure:true});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.match(r.stderr,/dyad-apps.*copying enabled/);
  assert.equal(codeState(root),"FIXED","the warning must not block a cycle that would otherwise succeed");
});
