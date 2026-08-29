import fs from "node:fs";

const GATE_STATUSES=new Set(["passed","failed","inconclusive","errored"]);
const STAGE_STATUSES=new Set(["passed","failed","inconclusive","errored","not_run"]);
const OUTCOMES=new Set(["green","escalated_safety","escalated_signature_budget","escalated_total_budget","escalated_oscillation","escalated_no_progress","escalated_timeout","invocation_timeout","inconclusive_flaky","precondition_failed"]);

function requireString(value,key,{nullable=false}={}){
  if(nullable && value===null) return;
  if(typeof value!=="string" || !value) throw new Error(`${key} must be a non-empty string${nullable?" or null":""}`);
}

export function assertGateReport(value) {
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("gate report must be an object");
  const required = ["schemaVersion","runId","tier","commit","status","failureCount","failureSignature","durationMs","gates"];
  for (const key of required) if (!(key in value)) throw new Error(`gate report missing ${key}`);
  if (value.schemaVersion !== 1) throw new Error("unsupported gate report schema");
  if (![0,1].includes(value.tier)) throw new Error("tier must be 0 or 1");
  if (!GATE_STATUSES.has(value.status)) throw new Error("invalid gate status");
  if (!Number.isInteger(value.failureCount) || value.failureCount < 0) throw new Error("invalid failureCount");
  if (!Number.isFinite(value.durationMs) || value.durationMs < 0) throw new Error("invalid durationMs");
  requireString(value.runId,"runId");
  requireString(value.commit,"commit");
  if(value.failureSignature!==null) requireString(value.failureSignature,"failureSignature");
  if (!Array.isArray(value.gates)) throw new Error("gates must be an array");
  if("discardedFailureIds" in value && (!Array.isArray(value.discardedFailureIds) || value.discardedFailureIds.some(x=>typeof x!=="string"))) throw new Error("discardedFailureIds must be a string array");
  for(const [index,stage] of value.gates.entries()){
    if(!stage || typeof stage!=="object") throw new Error(`gate ${index} must be an object`);
    requireString(stage.gate,`gates[${index}].gate`);
    if(!STAGE_STATUSES.has(stage.status)) throw new Error(`invalid stage status at ${index}`);
    if(!Array.isArray(stage.failures)) throw new Error(`gates[${index}].failures must be an array`);
  }
  const counted=value.gates.flatMap(g=>g.failures??[]).length;
  if(counted!==value.failureCount) throw new Error(`failureCount ${value.failureCount} does not match ${counted} failures`);
  if(value.status==="passed" && (value.failureCount!==0 || value.failureSignature!==null)) throw new Error("passed report must have zero failures and null signature");
  return value;
}

export function assertCycleRecord(value) {
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("cycle record must be an object");
  const required = ["schemaVersion","cycleId","startedAt","finishedAt","tier","startCommit","endCommit","initialSignature","finalSignature","signatureHistory","attemptHistory","attempts","outcome","reason","durationSec","harnessDurationSec","invocationWaitSec","filesChanged","attemptedPaths","discardedFailureIds","dyad"];
  for (const key of required) if (!(key in value)) throw new Error(`cycle record missing ${key}`);
  if (value.schemaVersion !== 1) throw new Error("unsupported cycle schema");
  if (![0,1].includes(value.tier)) throw new Error("tier must be 0 or 1");
  if (!Number.isInteger(value.attempts) || value.attempts < 0) throw new Error("invalid attempts");
  if(!OUTCOMES.has(value.outcome)) throw new Error("invalid cycle outcome");
  if(!Array.isArray(value.filesChanged) || value.filesChanged.some(x=>typeof x!=="string")) throw new Error("filesChanged must be a string array");
  if(!Array.isArray(value.attemptedPaths) || value.attemptedPaths.some(x=>typeof x!=="string")) throw new Error("attemptedPaths must be a string array");
  if(!Array.isArray(value.discardedFailureIds) || value.discardedFailureIds.some(x=>typeof x!=="string")) throw new Error("discardedFailureIds must be a string array");
  if(!Array.isArray(value.signatureHistory) || value.signatureHistory.some(x=>x!==null&&typeof x!=="string")) throw new Error("signatureHistory must be a string/null array");
  if(!Array.isArray(value.attemptHistory) || value.attemptHistory.length!==value.attempts) throw new Error("attemptHistory must contain one item per attempt");
  if(value.initialSignature!==null) requireString(value.initialSignature,"initialSignature");
  if(value.finalSignature!==null) requireString(value.finalSignature,"finalSignature");
  for(const key of ["durationSec","harnessDurationSec","invocationWaitSec"]) if(!Number.isFinite(value[key]) || value[key]<0) throw new Error(`invalid ${key}`);
  for(const key of ["cycleId","startedAt","finishedAt","startCommit","endCommit","reason"]) requireString(value[key],key);
  if(!value.dyad || typeof value.dyad!=="object") throw new Error("dyad metadata is required");
  return value;
}

export function assertHarness(value) {
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("harness config must be an object");
  for(const key of ["schemaVersion","harnessVersion","source","nodeVersion","commands","writableGlobs"]) if(!(key in value)) throw new Error(`harness config missing ${key}`);
  if(value.schemaVersion!==1) throw new Error("unsupported harness schema");
  requireString(value.harnessVersion,"harnessVersion");
  requireString(value.nodeVersion,"nodeVersion");
  if(!value.source || typeof value.source!=="object") throw new Error("source metadata is required");
  requireString(value.source.kind,"source.kind"); requireString(value.source.identity,"source.identity");
  if(!["local","git"].includes(value.source.kind)) throw new Error("source.kind must be local or git");
  if("resolvedCommit" in value.source) requireString(value.source.resolvedCommit,"source.resolvedCommit");
  if("importedAt" in value && (!Number.isFinite(Date.parse(value.importedAt)))) throw new Error("importedAt must be an ISO date-time");
  if("framework" in value) requireString(value.framework,"framework");
  if(!value.commands || typeof value.commands!=="object") throw new Error("commands are required");
  for(const key of ["build","dev","typecheck","lint"]) if(!Array.isArray(value.commands[key]) || value.commands[key].length===0 || value.commands[key].some(x=>typeof x!=="string")) throw new Error(`commands.${key} must be a non-empty string argv array`);
  if("e2e" in value.commands && (!Array.isArray(value.commands.e2e) || value.commands.e2e.length===0 || value.commands.e2e.some(x=>typeof x!=="string"))) throw new Error("commands.e2e must be a non-empty string argv array");
  if(!Array.isArray(value.writableGlobs) || value.writableGlobs.length===0 || value.writableGlobs.some(x=>typeof x!=="string")) throw new Error("writableGlobs must be a non-empty string array");
  if("serverReadyTimeoutMs" in value && (!Number.isFinite(value.serverReadyTimeoutMs) || value.serverReadyTimeoutMs<0)) throw new Error("serverReadyTimeoutMs must be non-negative");
  return value;
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
