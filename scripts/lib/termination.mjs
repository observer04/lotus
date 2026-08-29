export function decideTermination({safetyViolation=false,wallClockExceeded=false,status,currentSignature=null,signatureHistory=[],attemptsBySignature={},totalAttempts=0,currentFailureCount=0,previousFailureCounts=[]}){
  if(safetyViolation) return {stop:true,outcome:"escalated_safety",reason:"safety_violation"};
  if(wallClockExceeded) return {stop:true,outcome:"escalated_timeout",reason:"wall_clock"};
  if(status==="passed") return {stop:true,outcome:"green",reason:"all_gates_passed"};
  const priorIndex=currentSignature?signatureHistory.slice(0,-1).lastIndexOf(currentSignature):-1; if(priorIndex>=0 && priorIndex < signatureHistory.length-2) return {stop:true,outcome:"escalated_oscillation",reason:"signature_recurrence"};
  if(currentSignature && (attemptsBySignature[currentSignature]??0)>=3) return {stop:true,outcome:"escalated_signature_budget",reason:"signature_budget"};
  if(totalAttempts>=6) return {stop:true,outcome:"escalated_total_budget",reason:"total_budget"};
  const counts=[...previousFailureCounts,currentFailureCount]; if(counts.length>=3){ const a=counts.at(-3),b=counts.at(-2),c=counts.at(-1); if(b>=a&&c>=b) return {stop:true,outcome:"escalated_no_progress",reason:"failure_count_not_decreasing"}; }
  return {stop:false};
}
