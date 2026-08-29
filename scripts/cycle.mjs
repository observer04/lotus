#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { head, isClean, git, readRef, updateRef, statusEntries, repositoryPreconditions, snapshotGitState, changedPathsBetween } from "./lib/git-state.mjs";
import { verifyProtected } from "./lib/protection.mjs";
import { scanBanned } from "./lib/scan.mjs";
import { buildPrompt } from "./lib/prompt.mjs";
import { loadUnownedGlobs } from "./lib/ownership.mjs";
import { decideTermination, progressMarker } from "./lib/termination.mjs";
import { waitForInteractiveChange } from "./lib/invocation.mjs";
import { assertGateReport, assertCycleRecord, assertHarness } from "./lib/schema.mjs";

const ROOT=process.cwd();
const args=process.argv.slice(2);
const tier=Number(args[0]);
const bootstrap=args.includes("--bootstrap") || process.env.HARNESS_BOOTSTRAP==="1";
if(![0,1].includes(tier)){console.error("usage: scripts/cycle.sh <0|1> [--bootstrap]");process.exit(2);}
const startedAt=new Date(); const cycleStart=Date.now();
const invocationTimeoutMs=Number(process.env.HARNESS_INVOCATION_TIMEOUT_MS??10*60*1000);
const wallClockMs=Number(process.env.HARNESS_CYCLE_TIMEOUT_MS??20*60*1000);
const pollMs=Number(process.env.HARNESS_POLL_MS??2000);
const commitStablePolls=Number(process.env.HARNESS_COMMIT_STABLE_POLLS??process.env.HARNESS_STABLE_POLLS??5);
const dirtyStablePolls=Number(process.env.HARNESS_DIRTY_STABLE_POLLS??15);
let cfg;
try{cfg=assertHarness(JSON.parse(fs.readFileSync("harness.json","utf8")));}catch(error){console.error(`precondition: invalid or missing harness.json: ${error.message}`);process.exit(2);}
const unownedGlobs=loadUnownedGlobs({cwd:ROOT});
if(!isClean(ROOT)){console.error("precondition: repository must be clean before a cycle");process.exit(2);}
const repoCheck=repositoryPreconditions(ROOT);
if(!repoCheck.ok){console.error(`precondition: unsafe Git state: ${repoCheck.issues.map(i=>i.type).join(", ")}`);process.exit(2);}
const startCommit=head(ROOT); const cycleId=`${startedAt.toISOString().replace(/[-:.]/g,"")}-${startCommit.slice(0,7)}`; const runDir=path.join(ROOT,".harness","runs",cycleId); fs.mkdirSync(runDir,{recursive:true});
let lastGreen=readRef("refs/harness/last-green",ROOT); let attempts=0; let initialSignature=null; let finalSignature=null; let signatureHistory=[]; let progressHistory=[]; const attemptsBySignature={}; const attemptHistory=[]; const attemptedPaths=new Set(); const discardedFailureIds=new Set(); let invocationWaitMs=0;
const harnessElapsedMs=()=>Date.now()-cycleStart-invocationWaitMs;

function harnessCommit(message, paths=["-A"]){
  if(paths.length===1&&paths[0]==="-A") git(["add","-A"],{cwd:ROOT}); else git(["add","--",...paths],{cwd:ROOT});
  const staged=git(["diff","--cached","--quiet"],{cwd:ROOT,allowFailure:true});
  if(staged.status===0) return head(ROOT);
  git(["-c","user.name=Lotus Harness","-c","user.email=harness@local","commit","-m",message],{cwd:ROOT}); return head(ROOT);
}
function runGate(){
  const r=spawnSync("bash",["scripts/gate.sh",String(tier)],{cwd:ROOT,encoding:"utf8",timeout:240000,maxBuffer:32*1024*1024});
  let report; try{report=assertGateReport(JSON.parse(fs.readFileSync("gate-report.json","utf8")));}catch(e){throw new Error(`gate did not produce a valid report: ${e.message}\n${r.stderr??""}`);} fs.copyFileSync("gate-report.json",path.join(runDir,`gate-${String(signatureHistory.length).padStart(2,"0")}.json`)); return report;
}
function ensureHarnessGreenTag(codeEnd){
  const tag=git(["rev-parse","--verify","refs/tags/harness-green-v1"],{cwd:ROOT,allowFailure:true});
  if(tag.status!==0) git(["tag","harness-green-v1",codeEnd],{cwd:ROOT});
}
function appendRecord({outcome,reason,codeEnd}){
  const finishedAt=new Date();
  const declared=value=>typeof value==="string"&&value.trim()?value.trim():null;
  const dyad={version:declared(process.env.DYAD_VERSION),mode:"gui-build",provider:declared(process.env.DYAD_PROVIDER),model:declared(process.env.DYAD_MODEL),reasoningEffort:declared(process.env.DYAD_REASONING_EFFORT)};
  dyad.metadataSource=process.env.HARNESS_FIXER_EXEC?"test-adapter":dyad.version&&dyad.provider&&dyad.model&&dyad.reasoningEffort?"operator-declared":"undeclared";
  const filesChanged=changedPathsBetween(startCommit,codeEnd,ROOT).filter(p=>p!=="cycles.jsonl");
  const durableAttempts=attemptHistory.map(({attempt,signature,beforeSha,afterSha,changedPaths,resultingSignature,failureCount,progress,terminal})=>({attempt,signature,beforeSha,afterSha,changedPaths,resultingSignature,failureCount,progress,...(terminal?{terminal}:{})}));
  const rec=assertCycleRecord({schemaVersion:1,cycleId,startedAt:startedAt.toISOString(),finishedAt:finishedAt.toISOString(),tier,startCommit,endCommit:codeEnd,initialSignature,finalSignature,signatureHistory:[...signatureHistory],attemptHistory:durableAttempts,attempts,outcome,reason,durationSec:Math.round((finishedAt-startedAt)/1000),harnessDurationSec:Math.round(harnessElapsedMs()/1000),invocationWaitSec:Math.round(invocationWaitMs/1000),filesChanged,attemptedPaths:[...attemptedPaths].sort(),discardedFailureIds:[...discardedFailureIds].sort(),dyad});
  fs.appendFileSync("cycles.jsonl",JSON.stringify(rec)+"\n"); harnessCommit(`chore(harness): record cycle ${cycleId}`,["cycles.jsonl"]); fs.writeFileSync(path.join(runDir,"cycle-record.json"),JSON.stringify(rec,null,2)+"\n"); return rec;
}
function removeUntracked(){
  for(const e of statusEntries(ROOT)) if(e.xy==="??"){
    for(const p of [e.path,e.otherPath].filter(Boolean)){
      const abs=path.resolve(ROOT,p); if(abs===ROOT||!abs.startsWith(ROOT+path.sep)) throw new Error(`refusing to remove unsafe path ${p}`); fs.rmSync(abs,{recursive:true,force:true});
    }
  }
}
function rollbackAndRecord(outcome,reason,target){
  const existingCycles=fs.existsSync("cycles.jsonl")?fs.readFileSync("cycles.jsonl","utf8"):"";
  git(["restore","--source",target,"--staged","--worktree","--","."],{cwd:ROOT}); removeUntracked();
  // Preserve prior cycle history outside the code-tree rollback commit.
  fs.writeFileSync("cycles.jsonl",existingCycles);
  git(["add","-A"],{cwd:ROOT}); git(["restore","--staged","cycles.jsonl"],{cwd:ROOT,allowFailure:true});
  const staged=git(["diff","--cached","--quiet"],{cwd:ROOT,allowFailure:true}); if(staged.status!==0) git(["-c","user.name=Lotus Harness","-c","user.email=harness@local","commit","-m",`revert(harness): restore verified tree after ${reason}`],{cwd:ROOT});
  const codeEnd=head(ROOT); appendRecord({outcome,reason,codeEnd});
  if(!isClean(ROOT)) throw new Error("rollback invariant failed: repository is not clean"); return codeEnd;
}
async function waitInteractive(beforeSnapshot){
  console.log("\nDyad Mode B action required:"); console.log("1. Open this already-imported repository in Dyad 1.12.0."); console.log("2. Select Build mode and the declared model."); console.log("3. Paste .harness/active-prompt.md and approve the proposal if acceptable."); console.log("Waiting for a stable commit or stable uncommitted worktree change...\n");
  return waitForInteractiveChange({cwd:ROOT,beforeSnapshot,timeoutMs:invocationTimeoutMs,pollMs,commitStablePolls,dirtyStablePolls});
}
function invokeFake(promptPath,before,attempt){
  const exec=process.env.HARNESS_FIXER_EXEC; const extras=process.env.HARNESS_FIXER_ARGS_JSON?JSON.parse(process.env.HARNESS_FIXER_ARGS_JSON):[];
  const r=spawnSync(exec,[...extras,promptPath,before,String(attempt)],{cwd:ROOT,env:{...process.env,HARNESS_REPO_ROOT:ROOT,HARNESS_ATTEMPT:String(attempt)},encoding:"utf8",timeout:invocationTimeoutMs,maxBuffer:8*1024*1024});
  fs.writeFileSync(path.join(runDir,`fixer-${attempt}.stdout.log`),r.stdout??""); fs.writeFileSync(path.join(runDir,`fixer-${attempt}.stderr.log`),r.stderr??"");
  return {ok:r.status===0,status:r.status,reason:r.error?.code==="ETIMEDOUT"?"invocation_timeout":"fixer_failed"};
}

let report=runGate(); initialSignature=report.failureSignature; finalSignature=report.failureSignature;
for(const id of report.discardedFailureIds??[]) discardedFailureIds.add(id);
if(report.status==="passed"){
  lastGreen=head(ROOT); updateRef("refs/harness/last-green",lastGreen,ROOT); if(bootstrap) ensureHarnessGreenTag(lastGreen); const rec=appendRecord({outcome:"green",reason:"all_gates_passed",codeEnd:lastGreen}); console.log(`GREEN: ${rec.cycleId} (0 attempts)`); process.exit(0);
}
if(report.status==="inconclusive"){
  const rec=appendRecord({outcome:"inconclusive_flaky",reason:"non_reproducible_e2e",codeEnd:head(ROOT)}); console.error(`INCONCLUSIVE: ${rec.cycleId}`); process.exit(3);
}
signatureHistory.push(report.failureSignature); progressHistory.push(progressMarker(report));
if(!lastGreen && !bootstrap){
  const rec=appendRecord({outcome:"precondition_failed",reason:"last_green_missing",codeEnd:head(ROOT)});
  console.error(`precondition: refs/harness/last-green is absent; establish green or run explicit --bootstrap (${rec.cycleId})`);
  process.exit(2);
}
const rollbackTarget=lastGreen??startCommit;

while(true){
  if(harnessElapsedMs()>=wallClockMs){rollbackAndRecord("escalated_timeout","wall_clock",rollbackTarget);process.exit(5);}
  const signature=report.failureSignature; attempts++; attemptsBySignature[signature]=(attemptsBySignature[signature]??0)+1;
  const attemptDir=path.join(runDir,`attempt-${attempts}`); fs.mkdirSync(attemptDir,{recursive:true}); const beforeSnapshot=snapshotGitState(ROOT); const before=beforeSnapshot.head;
  const prompt=buildPrompt(report,{cycle:attempts,maxAttempts:6,attempt:attempts,priorAttempts:attemptHistory.filter(a=>a.signature===signature),cwd:ROOT,byteCeiling:Number(process.env.HARNESS_PROMPT_MAX_BYTES??48*1024),writableGlobs:cfg.writableGlobs??["src/**"],unownedGlobs});
  const promptPath=path.join(attemptDir,"prompt.md"); fs.writeFileSync(promptPath,prompt); fs.mkdirSync(path.join(ROOT,".harness"),{recursive:true}); fs.writeFileSync(path.join(ROOT,".harness","active-prompt.md"),prompt);
  fs.writeFileSync(path.join(attemptDir,"before.json"),JSON.stringify({beforeSha:before,signature,attempt:attempts,snapshot:beforeSnapshot},null,2)+"\n");
  let invoked;
  if(process.env.HARNESS_FIXER_EXEC) invoked=invokeFake(promptPath,before,attempts); else {
    const invocationStarted=Date.now(); invoked=await waitInteractive(beforeSnapshot); invocationWaitMs+=Date.now()-invocationStarted;
  }
  if(!invoked.ok){
    const partialPaths=[...new Set(statusEntries(ROOT).flatMap(e=>[e.path,e.otherPath].filter(Boolean)))].sort(); for(const p of partialPaths) attemptedPaths.add(p);
    attemptHistory.push({attempt:attempts,signature,beforeSha:before,afterSha:head(ROOT),changedPaths:partialPaths,resultingSignature:report.failureSignature,failureCount:report.failureCount,progress:progressMarker(report),terminal:invoked.reason??"invocation_timeout"});
    rollbackAndRecord("invocation_timeout",invoked.reason??"invocation_timeout",rollbackTarget);process.exit(4);
  }
  let after=head(ROOT);
  const protection=verifyProtected({before,after,cwd:ROOT,writableGlobs:cfg.writableGlobs??["src/**"],unownedGlobs}); const banned=scanBanned({cwd:ROOT,unownedGlobs});
  fs.writeFileSync(path.join(attemptDir,"verification.json"),JSON.stringify({protection,banned},null,2)+"\n");
  for(const p of protection.changedPaths) attemptedPaths.add(p); for(const f of banned) attemptedPaths.add(f.path);
  if(!protection.ok||banned.length){
    attemptHistory.push({attempt:attempts,signature,beforeSha:before,afterSha:after,changedPaths:protection.changedPaths,resultingSignature:report.failureSignature,failureCount:report.failureCount,progress:progressMarker(report),terminal:"safety_violation"});
    rollbackAndRecord("escalated_safety","safety_violation",rollbackTarget);process.exit(5);
  }
  if(!isClean(ROOT)){
    const allowed=[...new Set(statusEntries(ROOT).flatMap(e=>[e.path,e.otherPath].filter(Boolean)))]; if(allowed.length) after=harnessCommit(`chore(harness): capture repair attempt ${attempts}`,allowed);
  }
  report=runGate(); finalSignature=report.failureSignature; for(const id of report.discardedFailureIds??[]) discardedFailureIds.add(id);
  const historyItem={attempt:attempts,signature,beforeSha:before,afterSha:after,changedPaths:protection.changedPaths,resultingSignature:report.failureSignature,failureCount:report.failureCount,progress:progressMarker(report),observedSnapshot:invoked.afterSnapshot??snapshotGitState(ROOT)}; attemptHistory.push(historyItem); fs.writeFileSync(path.join(attemptDir,"after.json"),JSON.stringify(historyItem,null,2)+"\n");
  if(report.status==="inconclusive"){rollbackAndRecord("inconclusive_flaky","non_reproducible_e2e_after_attempt",rollbackTarget);process.exit(3);}
  signatureHistory.push(report.failureSignature); progressHistory.push(progressMarker(report));
  const decision=decideTermination({status:report.status,currentSignature:report.failureSignature,signatureHistory,attemptsBySignature,totalAttempts:attempts,progressHistory,wallClockExceeded:harnessElapsedMs()>=wallClockMs});
  if(decision.stop){
    if(decision.outcome==="green"){
      const codeEnd=head(ROOT); updateRef("refs/harness/last-green",codeEnd,ROOT); if(bootstrap) ensureHarnessGreenTag(codeEnd); const rec=appendRecord({outcome:"green",reason:decision.reason,codeEnd}); if(!isClean(ROOT)) throw new Error("green invariant failed: repository not clean"); console.log(`GREEN: ${rec.cycleId} in ${attempts} attempt(s)`); process.exit(0);
    }
    rollbackAndRecord(decision.outcome,decision.reason,rollbackTarget); console.error(`ESCALATED: ${decision.reason}`); process.exit(5);
  }
}
