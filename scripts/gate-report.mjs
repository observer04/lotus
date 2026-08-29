#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { scanBanned } from "./lib/scan.mjs";
import { makeFailure, failureSignature, parseBiome, parseTsc, parseBuild, parsePlaywright, playwrightSelection } from "./lib/diagnostics.mjs";
import { runSync, getFreePort, startProcess, stopProcessGroup, waitForHttp } from "./lib/process.mjs";
import { head } from "./lib/git-state.mjs";
import { assertGateReport } from "./lib/schema.mjs";

const ROOT=process.cwd();
const tier=Number(process.argv[2]);
if(![0,1].includes(tier)){ console.error("usage: gate-report.mjs <0|1>"); process.exit(2); }
const started=Date.now();
const commit=head(ROOT);
const runId=`${new Date().toISOString().replace(/[-:.]/g,"").replace("Z","Z")}-${commit.slice(0,7)}`;
const runDir=path.join(ROOT,".harness","runs",runId,"gate"); fs.mkdirSync(runDir,{recursive:true});
let cfg;
try{cfg=JSON.parse(fs.readFileSync(path.join(ROOT,"harness.json"),"utf8"));}catch{cfg=null;}
const stages=[];
const order=tier===1?["standards","lint","typecheck","build","e2e"]:["standards","lint","typecheck","build"];
let terminal=null;

function writeEvidence(name,result){
  fs.writeFileSync(path.join(runDir,`${name}.stdout.log`),result.stdout??"");
  fs.writeFileSync(path.join(runDir,`${name}.stderr.log`),result.stderr??"");
}
function addNotRun(name){stages.push({gate:name,status:"not_run",durationMs:0,failures:[]});}

async function runStage(name){
  const s=Date.now();
  if(name==="standards"){
    const findings=scanBanned({cwd:ROOT});
    const failures=findings.map(f=>makeFailure({gate:"standards",file:f.path,line:f.line,rule:f.id,message:"banned pattern"},ROOT));
    return {gate:name,status:failures.length?"failed":"passed",durationMs:Date.now()-s,failures};
  }
  if(!cfg) return {gate:name,status:"errored",durationMs:Date.now()-s,failures:[makeFailure({gate:name,rule:"HARNESS_CONFIG",message:"harness.json not found; import a project first"},ROOT)]};
  if(name==="lint"){
    const r=runSync(cfg.commands.lint,{cwd:ROOT,timeoutMs:120000}); writeEvidence(name,r);
    const failures=r.status===0?[]:parseBiome(r.stdout||r.stderr,ROOT);
    return {gate:name,status:r.status===0?"passed":"failed",durationMs:Date.now()-s,failures};
  }
  if(name==="typecheck"){
    const r=runSync(cfg.commands.typecheck,{cwd:ROOT,timeoutMs:120000}); writeEvidence(name,r);
    const failures=r.status===0?[]:parseTsc(`${r.stdout}\n${r.stderr}`,ROOT);
    return {gate:name,status:r.status===0?"passed":"failed",durationMs:Date.now()-s,failures};
  }
  if(name==="build"){
    const r=runSync(cfg.commands.build,{cwd:ROOT,timeoutMs:180000}); writeEvidence(name,r);
    const failures=r.status===0?[]:parseBuild(`${r.stdout}\n${r.stderr}`,ROOT);
    return {gate:name,status:r.status===0?"passed":"failed",durationMs:Date.now()-s,failures};
  }
  if(name==="e2e") return await runE2E(s);
  throw new Error(`unknown gate ${name}`);
}

async function runE2E(stageStarted){
  if(!Array.isArray(cfg.commands.e2e)||!Array.isArray(cfg.commands.dev)) return {gate:"e2e",status:"errored",durationMs:Date.now()-stageStarted,failures:[makeFailure({gate:"e2e",rule:"HARNESS_CONFIG",message:"e2e/dev command missing"},ROOT)]};
  const executeOnce=async(grep=null,suffix="first")=>{
    const port=await getFreePort();
    const env={HARNESS_PORT:String(port),PORT:String(port),HARNESS_BASE_URL:`http://127.0.0.1:${port}`,HARNESS_PLAYWRIGHT_JSON:path.join(runDir,`playwright-${suffix}.json`)};
    const dev=cfg.commands.dev.map(x=>x==="{PORT}"?String(port):x);
    const child=startProcess(dev,{cwd:ROOT,env});
    let devOut="",devErr=""; child.stdout?.on("data",d=>devOut+=d); child.stderr?.on("data",d=>devErr+=d);
    try{
      const ready=await waitForHttp(env.HARNESS_BASE_URL,{timeoutMs:Number(cfg.serverReadyTimeoutMs??30000)});
      if(!ready) return {status:124,stdout:"",stderr:`application did not become ready at ${env.HARNESS_BASE_URL}\n${devErr.slice(-4000)}`,json:null};
      const argv=[...cfg.commands.e2e]; if(grep) argv.push("--grep",grep);
      const r=runSync(argv,{cwd:ROOT,env,timeoutMs:180000});
      fs.writeFileSync(path.join(runDir,`e2e-${suffix}.stdout.log`),r.stdout); fs.writeFileSync(path.join(runDir,`e2e-${suffix}.stderr.log`),r.stderr); fs.writeFileSync(path.join(runDir,`dev-${suffix}.stdout.log`),devOut); fs.writeFileSync(path.join(runDir,`dev-${suffix}.stderr.log`),devErr);
      let json=""; try{json=fs.readFileSync(env.HARNESS_PLAYWRIGHT_JSON,"utf8");}catch{json=r.stdout||r.stderr;}
      return {...r,json};
    } finally { stopProcessGroup(child); }
  };
  const first=await executeOnce(null,"first");
  if(first.status===0) return {gate:"e2e",status:"passed",durationMs:Date.now()-stageStarted,failures:[]};
  if(first.status===124) return {gate:"e2e",status:"errored",durationMs:Date.now()-stageStarted,failures:[makeFailure({gate:"e2e",rule:"APP_READY_TIMEOUT",message:first.stderr||"application did not become ready"},ROOT)]};
  let failures=parsePlaywright(first.json||first.stdout||first.stderr,ROOT);
  if(!failures.length) return {gate:"e2e",status:"failed",durationMs:Date.now()-stageStarted,failures:[makeFailure({gate:"e2e",rule:"PLAYWRIGHT_EXIT",message:first.stderr||"Playwright exited non-zero"},ROOT)]};
  const ids=[...new Set(failures.map(f=>f.testId||f.rule).filter(Boolean))];
  const grep=ids.length?`\\b(?:${ids.map(x=>String(x).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})\\b`:null;
  const confirm=await executeOnce(grep,"confirm");
  if(confirm.status===124) return {gate:"e2e",status:"errored",durationMs:Date.now()-stageStarted,failures:[makeFailure({gate:"e2e",rule:"APP_READY_TIMEOUT",message:confirm.stderr||"application did not become ready for confirmation"},ROOT)]};
  const selection=playwrightSelection(confirm.json||"");
  const missingIds=ids.filter(id=>!selection.testIds.includes(id));
  if(selection.testCount===0||missingIds.length){
    const message=selection.testCount===0?"confirmation selected zero tests":`confirmation did not select: ${missingIds.join(", ")}`;
    return {gate:"e2e",status:"errored",durationMs:Date.now()-stageStarted,failures:[makeFailure({gate:"e2e",rule:"PLAYWRIGHT_CONFIRMATION_EMPTY",message},ROOT)]};
  }
  const confirmed=confirm.status===0?[]:parsePlaywright(confirm.json||confirm.stdout||confirm.stderr,ROOT);
  if(!confirmed.length) return {gate:"e2e",status:"inconclusive",durationMs:Date.now()-stageStarted,failures:[],discardedFailureIds:ids};
  const confirmedIds=new Set(confirmed.map(f=>f.testId||f.rule)); failures=failures.filter(f=>confirmedIds.has(f.testId||f.rule));
  return {gate:"e2e",status:"failed",durationMs:Date.now()-stageStarted,failures,discardedFailureIds:ids.filter(id=>!confirmedIds.has(id))};
}

for(const name of order){
  if(terminal){addNotRun(name);continue;}
  try{ const stage=await runStage(name); stages.push(stage); if(stage.status!=="passed") terminal=stage.status; }
  catch(error){ stages.push({gate:name,status:"errored",durationMs:0,failures:[makeFailure({gate:name,rule:"HARNESS_EXCEPTION",message:error?.stack||String(error)},ROOT)]}); terminal="errored"; }
}
const failures=stages.flatMap(s=>s.failures??[]); const status=terminal??"passed";
const discardedFailureIds=[...new Set(stages.flatMap(s=>s.discardedFailureIds??[]))].sort();
const report={schemaVersion:1,runId,tier,commit,status,failureCount:failures.length,failureSignature:failureSignature(failures),durationMs:Date.now()-started,gates:stages,...(discardedFailureIds.length?{discardedFailureIds}:{})};
assertGateReport(report);
const tmp=path.join(ROOT,`.gate-report.${process.pid}.tmp`); fs.writeFileSync(tmp,JSON.stringify(report,null,2)+"\n"); const fd=fs.openSync(tmp,"r"); fs.fsyncSync(fd); fs.closeSync(fd); fs.renameSync(tmp,path.join(ROOT,"gate-report.json"));
console.log(JSON.stringify(report,null,2));
process.exit(status==="passed"?0:status==="inconclusive"?3:1);
