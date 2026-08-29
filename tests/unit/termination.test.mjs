import test from "node:test";
import assert from "node:assert/strict";
import { decideTermination, progressMarker } from "../../scripts/lib/termination.mjs";

test("CYC-008 safety wins immediately",()=>{
  assert.deepEqual(decideTermination({safetyViolation:true,status:"failed"}),{stop:true,outcome:"escalated_safety",reason:"safety_violation"});
});

test("CYC-003 green terminates successfully",()=>{
  assert.deepEqual(decideTermination({status:"passed"}),{stop:true,outcome:"green",reason:"all_gates_passed"});
});

test("CYC-003 verified green wins even when the harness clock expires during the gate",()=>{
  assert.deepEqual(
    decideTermination({status:"passed",wallClockExceeded:true}),
    {stop:true,outcome:"green",reason:"all_gates_passed"}
  );
});

test("CYC-011 detects A to B to A on first recurrence",()=>{
  const d=decideTermination({status:"failed",currentSignature:"A",signatureHistory:["A","B","A"],attemptsBySignature:{A:1,B:1},totalAttempts:2,currentFailureCount:1,previousFailureCounts:[2,1]});
  assert.equal(d.outcome,"escalated_oscillation");
});

test("CYC-009 signature budget is three",()=>{
  const d=decideTermination({status:"failed",currentSignature:"A",signatureHistory:["A","A"],attemptsBySignature:{A:3},totalAttempts:3,currentFailureCount:1,previousFailureCounts:[3,2]});
  assert.equal(d.outcome,"escalated_signature_budget");
});

test("CYC-010 total attempt budget is six",()=>{
  const d=decideTermination({status:"failed",currentSignature:"Z",signatureHistory:["A","B","C","D","E","F","Z"],attemptsBySignature:{Z:1},totalAttempts:6,currentFailureCount:1,previousFailureCounts:[4,3]});
  assert.equal(d.outcome,"escalated_total_budget");
});

test("CYC-012 two consecutive non-decreases stop",()=>{
  const d=decideTermination({status:"failed",currentSignature:"C",signatureHistory:["A","B","C"],attemptsBySignature:{C:1},totalAttempts:2,progressHistory:[
    {stageIndex:1,failureCount:2},
    {stageIndex:1,failureCount:2},
    {stageIndex:1,failureCount:3}
  ]});
  assert.deepEqual(d,{stop:true,outcome:"escalated_no_progress",reason:"progress_not_improving"});
});

test("CYC-012 reaching a later fail-fast stage is progress even when its count is larger",()=>{
  const d=decideTermination({status:"failed",currentSignature:"C",signatureHistory:["A","B","C"],attemptsBySignature:{C:1},totalAttempts:2,progressHistory:[
    {stageIndex:1,failureCount:5},
    {stageIndex:2,failureCount:8},
    {stageIndex:2,failureCount:7}
  ]});
  assert.deepEqual(d,{stop:false});
});

test("CYC-012 progress marker measures the terminal stage and its local failure count",()=>{
  assert.deepEqual(progressMarker({status:"failed",gates:[
    {gate:"standards",status:"passed",failures:[]},
    {gate:"lint",status:"passed",failures:[]},
    {gate:"typecheck",status:"failed",failures:[{},{}]},
    {gate:"build",status:"not_run",failures:[]}
  ]}),{stage:"typecheck",stageIndex:2,failureCount:2});
});
