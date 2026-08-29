export function progressMarker(report){
  const gates=Array.isArray(report?.gates)?report.gates:[];
  if(report?.status==="passed") return {stage:"complete",stageIndex:gates.length,failureCount:0};
  let stageIndex=gates.findIndex(g=>g.status!=="passed");
  if(stageIndex<0) stageIndex=Math.max(0,gates.length-1);
  const stage=gates[stageIndex]??{gate:"unknown",failures:[]};
  return {stage:stage.gate,stageIndex,failureCount:(stage.failures??[]).length};
}

export function progressImproved(previous,current){
  if(!previous||!current) return false;
  if(current.stageIndex!==previous.stageIndex) return current.stageIndex>previous.stageIndex;
  return current.failureCount<previous.failureCount;
}

function twoConsecutiveNonImprovements(progressHistory){
  if(progressHistory.length<3) return false;
  const [a,b,c]=progressHistory.slice(-3);
  return !progressImproved(a,b) && !progressImproved(b,c);
}

export function decideTermination({safetyViolation=false,wallClockExceeded=false,status,currentSignature=null,signatureHistory=[],attemptsBySignature={},totalAttempts=0,currentFailureCount=0,previousFailureCounts=[],progressHistory=[]}){
  if(safetyViolation) return {stop:true,outcome:"escalated_safety",reason:"safety_violation"};
  if(status==="passed") return {stop:true,outcome:"green",reason:"all_gates_passed"};
  if(wallClockExceeded) return {stop:true,outcome:"escalated_timeout",reason:"wall_clock"};
  const priorIndex=currentSignature?signatureHistory.slice(0,-1).lastIndexOf(currentSignature):-1; if(priorIndex>=0 && priorIndex < signatureHistory.length-2) return {stop:true,outcome:"escalated_oscillation",reason:"signature_recurrence"};
  if(currentSignature && (attemptsBySignature[currentSignature]??0)>=3) return {stop:true,outcome:"escalated_signature_budget",reason:"signature_budget"};
  if(totalAttempts>=6) return {stop:true,outcome:"escalated_total_budget",reason:"total_budget"};
  const comparableProgress=progressHistory.length?progressHistory:[...previousFailureCounts,currentFailureCount].map(failureCount=>({stageIndex:0,failureCount}));
  if(twoConsecutiveNonImprovements(comparableProgress)) return {stop:true,outcome:"escalated_no_progress",reason:"progress_not_improving"};
  return {stop:false};
}
