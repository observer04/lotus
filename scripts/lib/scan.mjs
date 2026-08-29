import fs from "node:fs";
import path from "node:path";

function walk(dir, root, out=[]) {
  if(!fs.existsSync(dir)) return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name), rel=path.relative(root,abs).split(path.sep).join("/");
    if(ent.isDirectory()) walk(abs,root,out); else if(ent.isFile()) out.push(rel);
  }
  return out;
}
export function scanBanned({cwd=process.cwd(),roots=["src","e2e"],configPath="config/banned-patterns.json"}={}){
  const cfg=JSON.parse(fs.readFileSync(path.join(cwd,configPath),"utf8"));
  const patterns=cfg.patterns.map(p=>({...p,re:new RegExp(p.regex,"g")})); const findings=[];
  for(const rootName of roots) for(const rel of walk(path.join(cwd,rootName),cwd)){
    let text; try{text=fs.readFileSync(path.join(cwd,rel),"utf8");}catch{continue;}
    const lines=text.split(/\r?\n/);
    for(let i=0;i<lines.length;i++) for(const p of patterns){ p.re.lastIndex=0; if(p.re.test(lines[i])) findings.push({id:p.id,path:rel,line:i+1}); }
  }
  return findings.sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line||a.id.localeCompare(b.id));
}
