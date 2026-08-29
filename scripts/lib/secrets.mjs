import fs from "node:fs";
import path from "node:path";

const DEFAULT_EXCLUDES=new Set([".git","node_modules","dist","build","playwright-report","test-results",".harness"]);

function envFile(name){
  return name===".env" || name.startsWith(".env.");
}

function policyAt(policyPath){
  const value=JSON.parse(fs.readFileSync(policyPath,"utf8"));
  if(value.schemaVersion!==1 || !Array.isArray(value.patterns)) throw new Error("invalid secret pattern policy");
  return {...value,compiled:value.patterns.map(pattern=>({...pattern,re:new RegExp(pattern.regex,pattern.flags??"")}))};
}

function textFile(file,maxFileBytes){
  const stat=fs.statSync(file);
  if(stat.size>maxFileBytes) return null;
  const body=fs.readFileSync(file);
  if(body.includes(0)) return null;
  return body.toString("utf8");
}

export function scanSecrets({cwd=process.cwd(),policyPath=path.join(cwd,"config","secret-patterns.json")}={}){
  const root=fs.realpathSync(cwd);
  const policy=policyAt(policyPath);
  const findings=[];
  const walk=dir=>{
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      if(DEFAULT_EXCLUDES.has(ent.name)||envFile(ent.name)) continue;
      const abs=path.join(dir,ent.name);
      const stat=fs.lstatSync(abs);
      if(stat.isSymbolicLink()) continue;
      if(ent.isDirectory()) { walk(abs); continue; }
      if(!ent.isFile()) continue;
      const body=textFile(abs,Number(policy.maxFileBytes??1048576));
      if(body===null) continue;
      const rel=path.relative(root,abs).split(path.sep).join("/");
      for(const [index,line] of body.split(/\r?\n/).entries()){
        for(const pattern of policy.compiled){
          pattern.re.lastIndex=0;
          if(pattern.re.test(line)) findings.push({id:pattern.id,path:rel,line:index+1});
        }
      }
    }
  };
  walk(root);
  return findings.sort((a,b)=>`${a.path}:${a.line}:${a.id}`.localeCompare(`${b.path}:${b.line}:${b.id}`));
}
