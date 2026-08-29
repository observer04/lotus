import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function redact(text) {
  let out=String(text);
  const home=os.homedir();
  if(home) out=out.split(home).join("~");
  return out
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g,"[REDACTED_OPENAI_KEY]")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g,"[REDACTED_GOOGLE_KEY]")
    .replace(/\b(?:Bearer\s+)[A-Za-z0-9._~+\/-]{16,}/gi,"Bearer [REDACTED]")
    .replace(/\b(OPENAI_API_KEY|GOOGLE_API_KEY|OPENROUTER_API_KEY)\s*=\s*[^\s]+/g,"$1=[REDACTED]");
}

function sourceFiles(cwd){
  const root=path.join(cwd,"src");
  const out=[];
  const walk=(dir)=>{
    if(!fs.existsSync(dir)) return;
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const abs=path.join(dir,ent.name);
      if(ent.isDirectory()) walk(abs);
      else if(ent.isFile() && /\.(?:js|jsx|ts|tsx)$/.test(ent.name)) out.push(abs);
    }
  };
  walk(root);
  return out.sort();
}

function renderContext(cwd,file,line,radius=15,label=null){
  if(!file||!file.startsWith("src/")||!line) return null;
  const abs=path.join(cwd,file);
  if(!fs.existsSync(abs)) return null;
  const lines=fs.readFileSync(abs,"utf8").split(/\r?\n/);
  const start=Math.max(0,line-1-radius), end=Math.min(lines.length,line+radius);
  const body=lines.slice(start,end).map((text,i)=>`${String(start+i+1).padStart(4)} | ${text}`).join("\n");
  return `### ${label??`${file}:${line}`}\n\`\`\`\n${body}\n\`\`\``;
}

function clipContext(cwd,failure,radius=15){
  return renderContext(cwd,failure.file,failure.line,radius);
}

function e2eSourceCandidates(cwd,failure,radius=15){
  if(failure.gate!=="e2e" || !failure.file) return [];
  const testAbs=path.join(cwd,failure.file);
  if(!fs.existsSync(testAbs)) return [];
  const testLines=fs.readFileSync(testAbs,"utf8").split(/\r?\n/);
  const center=failure.line?failure.line-1:0;
  const snippet=testLines.slice(Math.max(0,center-12),Math.min(testLines.length,center+13)).join("\n");
  const ids=[...snippet.matchAll(/getByTestId\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map(m=>m[1]);
  const unique=[...new Set(ids)];
  const contexts=[];
  for(const id of unique){
    for(const abs of sourceFiles(cwd)){
      const lines=fs.readFileSync(abs,"utf8").split(/\r?\n/);
      for(let i=0;i<lines.length;i++){
        if(!lines[i].includes(id)) continue;
        const rel=path.relative(cwd,abs).split(path.sep).join("/");
        const rendered=renderContext(cwd,rel,i+1,radius,`${rel}:${i+1} (candidate for data-testid=${id})`);
        if(rendered) contexts.push(rendered);
        if(contexts.length>=3) return contexts;
      }
    }
  }
  return contexts;
}

function truncateUtf8(text,byteCeiling){
  if(Buffer.byteLength(text,"utf8")<=byteCeiling) return text;
  const marker=`\n\n[TRUNCATED: prompt exceeded ${byteCeiling} bytes]\n`;
  const target=Math.max(0,byteCeiling-Buffer.byteLength(marker,"utf8"));
  let lo=0,hi=text.length;
  while(lo<hi){
    const mid=Math.ceil((lo+hi)/2);
    if(Buffer.byteLength(text.slice(0,mid),"utf8")<=target) lo=mid; else hi=mid-1;
  }
  return text.slice(0,lo)+marker;
}

export function buildPrompt(report,{cycle=1,maxAttempts=6,attempt=1,priorAttempts=[],cwd=process.cwd(),maxFailures=20,byteCeiling=48*1024,writableGlobs=["src/**"]}={}){
  const failures=report.gates.flatMap(g=>g.failures??[]).sort((a,b)=>`${a.gate}/${a.file}/${a.rule}`.localeCompare(`${b.gate}/${b.file}/${b.rule}`));
  const selected=failures.slice(0,maxFailures);
  const lines=[
    `# CYCLE ${cycle} of ${maxAttempts} — gates failed`,"",
    `Tier: ${report.tier}`,
    `Commit: ${report.commit}`,
    `Signature: ${report.failureSignature}`,
    `Attempt: ${attempt}`,"",
    `## FAILURES (${failures.length}${failures.length>selected.length?`, showing ${selected.length}`:""})`,
    ...selected.map(f=>`- ${f.file||"<project>"}${f.line?`:${f.line}`:""} [${f.rule}] ${f.message}`),""
  ];

  const contexts=[];
  const seen=new Set();
  for(const failure of selected){
    const direct=clipContext(cwd,failure);
    for(const c of [direct,...e2eSourceCandidates(cwd,failure)].filter(Boolean)){
      if(!seen.has(c)){seen.add(c);contexts.push(c);}
    }
  }
  if(contexts.length) lines.push("## RELEVANT SOURCE","",...contexts,"");

  const e2e=selected.filter(f=>f.gate==="e2e");
  if(e2e.length){
    lines.push("## E2E RULES","");
    for(const f of e2e) lines.push(`- ${f.rule}: ${f.message}`);
    lines.push("");
  }

  lines.push("## PRIOR ATTEMPTS ON THIS SIGNATURE");
  if(!priorAttempts.length) lines.push("- none");
  else for(const a of priorAttempts){
    lines.push(`- attempt ${a.attempt}: ${a.beforeSha} -> ${a.afterSha}; paths=${(a.changedPaths??[]).join(",")||"none"}; result=${a.resultingSignature??"green"}/${a.failureCount??0}`);
  }

  lines.push(
    "","## CONSTRAINTS",
    `- Writable paths only: ${writableGlobs.join(", ")}`,
    "- Do NOT modify tests, scripts, configuration, schemas, package metadata, lockfiles, AI_RULES.md, harness.json, or cycle logs.",
    "- Do NOT add @ts-ignore, @ts-expect-error, `as any`, biome-ignore, test.skip, test.only, xit, describe.skip, continue-on-error, or `|| true`.",
    "- Do NOT weaken assertions or reduce assertion count.",
    "- Fix the source cause. If a test or requirement is genuinely wrong or contradictory, STOP and say so.",
    "","Full gate report: gate-report.json"
  );

  return truncateUtf8(redact(lines.join("\n")+"\n"),byteCeiling);
}
