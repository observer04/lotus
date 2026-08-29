import fs from "node:fs";
import path from "node:path";
import { scanBanned } from "./scan.mjs";
import { runSync } from "./process.mjs";
import { matchesAny } from "./ownership.mjs";

const SOURCE_EXT=/\.(?:js|jsx|ts|tsx)$/;

function walk(dir,root,out=[]){
  if(!fs.existsSync(dir)) return out;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name), rel=path.relative(root,abs).split(path.sep).join("/");
    if(ent.isDirectory()) {
      if(!["node_modules","dist","build",".git",".harness"].includes(ent.name)) walk(abs,root,out);
    } else if(ent.isFile()&&SOURCE_EXT.test(ent.name)) out.push(rel);
  }
  return out;
}

// data-testid coverage and float-currency math are behavioral checks against
// the application; unowned (generator-owned/vendored) files are out of scope
// for them but still surface under Banned patterns below.
function ownedFiles(root,unownedGlobs){
  return walk(path.join(root,"src"),root).filter(rel=>!matchesAny(rel,unownedGlobs));
}

function locations(root,re,unownedGlobs){
  const out=[];
  for(const rel of ownedFiles(root,unownedGlobs)){
    const lines=fs.readFileSync(path.join(root,rel),"utf8").split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      re.lastIndex=0;
      if(re.test(lines[i])) out.push(`${rel}:${i+1}`);
    }
  }
  return out;
}

function countTsc(text){ return (text.match(/\berror TS\d+:/g)||[]).length; }
function countBiome(text){
  try{
    const j=JSON.parse(text);
    return (j.diagnostics??[]).filter(d=>String(d.severity??"error")==="error").length;
  }catch{return text.trim()?1:0;}
}

export function buildImportReport(root,capabilities,{unownedGlobs=[]}={}){
  const floats=locations(root,/\b(?:price|total|subtotal|tax|amount|cost)\b.*\.toFixed\s*\(|\.toFixed\s*\([^)]*\).*\b(?:price|total|subtotal|tax|amount|cost)\b/i,unownedGlobs);
  const missingTestIds=[];
  for(const rel of ownedFiles(root,unownedGlobs)){
    const lines=fs.readFileSync(path.join(root,rel),"utf8").split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      if(/<(button|input|select|textarea|a)\b/i.test(lines[i])&&!/data-testid\s*=/.test(lines[i])) missingTestIds.push(`${rel}:${i+1}`);
    }
  }

  const tsc=runSync(capabilities.commands.typecheck,{cwd:root,timeoutMs:120000});
  const lint=runSync(capabilities.commands.lint,{cwd:root,timeoutMs:120000});
  // Deliberately unfiltered: generator-owned/vendored findings still belong in
  // the report ("what the generator got wrong"), even though the standards
  // gate and the fixer prompt never see them.
  const banned=scanBanned({cwd:root});
  const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
  const policy=JSON.parse(fs.readFileSync(path.join(root,"config","platform-dependencies.json"),"utf8"));
  const allowed=new Set(policy.allowed);
  const deps=Object.entries(pkg.dependencies??{}).map(([name,range])=>({name,range,kind:"production"}));
  const devDeps=Object.entries(pkg.devDependencies??{}).map(([name,range])=>({name,range,kind:"development"}));
  const unknown=[...deps,...devDeps].filter(d=>!allowed.has(d.name)).sort((a,b)=>a.name.localeCompare(b.name));
  const lintErrors=lint.status===0?0:countBiome(lint.stdout||lint.stderr);
  const tscErrors=tsc.status===0?0:countTsc(`${tsc.stdout}\n${tsc.stderr}`)||1;

  const lines=[
    "# Lovable Import Report","",
    "## Float currency math",`Status: ${floats.length?"review":"clear"}`,`Count: ${floats.length}`,"Evidence:",...(floats.length?floats.map(x=>`- ${x}`):["- none"]),"",
    "## data-testid coverage",`Status: ${missingTestIds.length?"review":"clear"}`,`Count: ${missingTestIds.length}`,"Evidence:",...(missingTestIds.length?missingTestIds.map(x=>`- ${x}`):["- none"]),"",
    "## Typecheck baseline",`Status: ${tsc.status===0?"clear":"debt"}`,`Count: ${tscErrors}`,"Evidence:",`- command exit: ${tsc.status}`,"",
    "## Lint baseline",`Status: ${lint.status===0?"clear":"debt"}`,`Count: ${lintErrors}`,"Evidence:",`- command exit: ${lint.status}`,"",
    "## Banned patterns",`Status: ${banned.length?"blocked":"clear"}`,`Count: ${banned.length}`,"Evidence:",...(banned.length?banned.map(f=>`- ${f.id} ${f.path}:${f.line}`):["- none"]),"",
    "## Dependencies outside platform list",`Status: ${unknown.length?"review":"clear"}`,`Count: ${unknown.length}`,"Evidence:",...(unknown.length?unknown.map(d=>`- ${d.name}@${d.range} — ${d.kind} — review`):["- none"]),""
  ];
  return {
    markdown:lines.join("\n"),
    stats:{floatCurrency:floats.length,missingTestIds:missingTestIds.length,typecheckErrors:tscErrors,lintErrors,banned:banned.length,unknownDependencies:unknown.length}
  };
}
