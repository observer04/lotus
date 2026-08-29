import fs from "node:fs";
import path from "node:path";
import { matchesAny } from "./ownership.mjs";

// The prompt renderer must quote every banned token to tell Dyad what not to
// add. It is protected by Git verification and is the sole scan exclusion.
const EXCLUDED_PATHS=new Set(["scripts/lib/prompt.mjs"]);

function walk(dir, root, out=[]) {
  if(!fs.existsSync(dir)) return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name), rel=path.relative(root,abs).split(path.sep).join("/");
    if(ent.isDirectory()) walk(abs,root,out); else if(ent.isFile()) out.push(rel);
  }
  return out;
}

function maskJs(text){
  const chars=[...text]; let state="code",escaped=false;
  for(let i=0;i<chars.length;i++){
    const c=chars[i],n=chars[i+1];
    if(state==="code"){
      if(c==="/"&&n==="/"){chars[i]=chars[i+1]=" ";state="line";i++;continue;}
      if(c==="/"&&n==="*"){chars[i]=chars[i+1]=" ";state="block";i++;continue;}
      if(c==="'"||c==='"'||c.charCodeAt(0)===96){state=c.charCodeAt(0)===96?"template":c;chars[i]=" ";escaped=false;continue;}
      continue;
    }
    if(state==="line"){
      if(c==="\n") state="code"; else chars[i]=" ";
      continue;
    }
    if(state==="block"){
      if(c==="*"&&n==="/"){chars[i]=chars[i+1]=" ";state="code";i++;}
      else if(c!=="\n") chars[i]=" ";
      continue;
    }
    if(c==="\n" && state!=="template"){state="code";escaped=false;continue;}
    if(escaped){if(c!=="\n") chars[i]=" ";escaped=false;continue;}
    if(c==="\\"){chars[i]=" ";escaped=true;continue;}
    if(c===state || state==="template"&&c.charCodeAt(0)===96){chars[i]=" ";state="code";continue;}
    if(c!=="\n") chars[i]=" ";
  }
  return chars.join("");
}

function maskShell(text){
  const chars=[...text]; let state="code",escaped=false;
  for(let i=0;i<chars.length;i++){
    const c=chars[i];
    if(state==="code"){
      if(c==="#"){chars[i]=" ";state="comment";continue;}
      if(c==="'"||c==='"'){state=c;chars[i]=" ";escaped=false;continue;}
      continue;
    }
    if(state==="comment"){
      if(c==="\n") state="code"; else chars[i]=" ";
      continue;
    }
    if(c==="\n"){state="code";escaped=false;continue;}
    if(state==='"'&&escaped){chars[i]=" ";escaped=false;continue;}
    if(state==='"'&&c==="\\"){chars[i]=" ";escaped=true;continue;}
    if(c===state){chars[i]=" ";state="code";continue;}
    chars[i]=" ";
  }
  return chars.join("");
}

function codeOnly(text,rel){
  if(/\.(?:[cm]?[jt]sx?)$/i.test(rel)) return maskJs(text);
  if(/\.(?:sh|bash)$/i.test(rel)) return maskShell(text);
  return text;
}

export function scanBanned({cwd=process.cwd(),roots=["src","e2e","scripts"],configPath="config/banned-patterns.json",unownedGlobs=[]}={}){
  const cfg=JSON.parse(fs.readFileSync(path.join(cwd,configPath),"utf8"));
  const patterns=cfg.patterns.map(p=>({...p,re:new RegExp(p.regex,"g")})); const findings=[];
  for(const rootName of roots) for(const rel of walk(path.join(cwd,rootName),cwd)){
    if(EXCLUDED_PATHS.has(rel)) continue;
    if(unownedGlobs.length && matchesAny(rel,unownedGlobs)) continue;
    let text; try{text=fs.readFileSync(path.join(cwd,rel),"utf8");}catch{continue;}
    const rawLines=text.split(/\r?\n/),codeLines=codeOnly(text,rel).split(/\r?\n/);
    for(let i=0;i<rawLines.length;i++) for(const p of patterns){
      const candidate=p.mode==="raw"?rawLines[i]:codeLines[i]??"";
      p.re.lastIndex=0;
      if(p.re.test(candidate)) findings.push({id:p.id,path:rel,line:i+1,excerpt:rawLines[i].trim().slice(0,240)});
    }
  }
  return findings.sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line||a.id.localeCompare(b.id));
}
