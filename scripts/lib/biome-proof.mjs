export function parseJsonEnvelope(text){
  const value=String(text);
  try{return JSON.parse(value);}catch{}
  const start=value.indexOf("{"),end=value.lastIndexOf("}");
  if(start<0||end<start) return null;
  try{return JSON.parse(value.slice(start,end+1));}catch{return null;}
}

export function provesExhaustiveDependencies(text){
  const report=parseJsonEnvelope(text);
  return Array.isArray(report?.diagnostics) && report.diagnostics.some(d=>
    d?.category==="lint/correctness/useExhaustiveDependencies" && d?.severity==="error"
  );
}
