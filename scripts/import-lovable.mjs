#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { detectCapabilities } from "./lib/capabilities.mjs";
import { buildImportReport } from "./lib/import-report.mjs";
import { runSync } from "./lib/process.mjs";
import { ensureGitRepo, git, isClean, head } from "./lib/git-state.mjs";
import { assertHarness } from "./lib/schema.mjs";
import { scanSecrets } from "./lib/secrets.mjs";
import { provesExhaustiveDependencies } from "./lib/biome-proof.mjs";

const ROOT=fs.realpathSync(process.cwd());
const sourceArg=process.argv[2];
if(!sourceArg){console.error("usage: scripts/import-lovable.sh <repo-or-path>");process.exit(2);}
ensureGitRepo(ROOT);
if(!isClean(ROOT)){console.error("import requires a clean target repository");process.exit(2);}

const HARNESS_FILES=["scripts","config","schemas","AI_RULES.md","biome.json","playwright.config.ts",".gitignore",".nvmrc"];
const EXCLUDE_NAMES=new Set([".git","node_modules","dist","build","playwright-report","test-results",".harness"]);
const INCIDENTAL_LOVABLE_BUN_FILES=["bun.lock","bun.lockb","bunfig.toml"];
function secretName(name){ return name===".env"||name.startsWith(".env."); }
function isUrl(s){ return /^(?:https?:\/\/|ssh:\/\/|git@)/.test(s); }
function copyTree(src,dst,{sourceMode=false}={}){
  fs.mkdirSync(dst,{recursive:true});
  for(const ent of fs.readdirSync(src,{withFileTypes:true})){
    if(EXCLUDE_NAMES.has(ent.name)||secretName(ent.name)) continue;
    if(sourceMode && ["scripts","config","schemas","e2e","AI_RULES.md","biome.json","playwright.config.ts","harness.json","gate-report.json","cycles.jsonl"].includes(ent.name)) continue;
    const a=path.join(src,ent.name),b=path.join(dst,ent.name); const st=fs.lstatSync(a);
    if(st.isSymbolicLink()) throw new Error(`symlink not allowed in import: ${a}`);
    if(ent.isDirectory()) copyTree(a,b,{sourceMode}); else if(ent.isFile()) fs.copyFileSync(a,b);
  }
}
function hashTree(dir){
  const hash=crypto.createHash("sha256");
  function walk(d){ for(const ent of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){ if(EXCLUDE_NAMES.has(ent.name)||secretName(ent.name)) continue; const a=path.join(d,ent.name),rel=path.relative(dir,a).split(path.sep).join("/"); const st=fs.lstatSync(a); if(st.isSymbolicLink()) throw new Error(`symlink not allowed in source: ${rel}`); if(ent.isDirectory()) walk(a); else if(ent.isFile()){hash.update(rel);hash.update("\0");hash.update(fs.readFileSync(a));hash.update("\0");} } }
  walk(dir); return `sha256:${hash.digest("hex")}`;
}
function requireOk(r,label){ if(r.status!==0){console.error(`${label} failed\n${r.stderr||r.stdout}`);process.exit(1);} }
function normalizeIncidentalLovablePackageFiles(stage){
  const pkg=JSON.parse(fs.readFileSync(path.join(stage,"package.json"),"utf8"));
  if(pkg.packageManager && !String(pkg.packageManager).startsWith("npm@")) return;
  for(const name of INCIDENTAL_LOVABLE_BUN_FILES) fs.rmSync(path.join(stage,name),{force:true});
}
function hydrateTarget(){
  requireOk(runSync(["npm","ci","--ignore-scripts"],{cwd:ROOT,timeoutMs:300000}),"npm ci (target hydration)");
  if(!isClean(ROOT)) throw new Error("target hydration changed tracked files");
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"lotus-import-"));
let sourceRoot,sourceKind,resolvedCommit=null;
try{
  if(isUrl(sourceArg)){
    sourceKind="git"; sourceRoot=path.join(tmp,"source");
    const r=spawnSync("git",["clone","--depth","1",sourceArg,sourceRoot],{encoding:"utf8"}); requireOk({status:r.status,stdout:r.stdout??"",stderr:r.stderr??""},"git clone");
    resolvedCommit=git(["rev-parse","HEAD"],{cwd:sourceRoot}).stdout.trim();
  }else{
    sourceKind="local"; sourceRoot=fs.realpathSync(path.resolve(sourceArg));
    if(sourceRoot===ROOT||ROOT.startsWith(sourceRoot+path.sep)||sourceRoot.startsWith(ROOT+path.sep)) throw new Error("source and target must be separate directories with no nesting");
  }
  const sourceSecrets=scanSecrets({cwd:sourceRoot,policyPath:path.join(ROOT,"config","secret-patterns.json")});
  if(sourceSecrets.length){
    const locations=sourceSecrets.map(f=>`${f.id} ${f.path}:${f.line}`).join(", ");
    throw new Error(`source contains possible committed secrets; import refused: ${locations}`);
  }
  const sourceIdentity=sourceKind==="git"?`git:${resolvedCommit}`:hashTree(sourceRoot);
  const currentHarness=path.join(ROOT,"harness.json");
  if(fs.existsSync(currentHarness)){
    const existing=JSON.parse(fs.readFileSync(currentHarness,"utf8"));
    if(existing.source?.identity===sourceIdentity){
      if(!fs.existsSync(path.join(ROOT,"node_modules",".bin","biome"))) hydrateTarget();
      console.log(`No-op: source ${sourceIdentity} is already imported.`);process.exit(0);
    }
    if(git(["rev-parse","--verify","baseline-v1"],{cwd:ROOT,allowFailure:true}).status===0) throw new Error("baseline-v1 already exists for a different import identity; refusing to move it");
  }

  const stage=path.join(tmp,"stage"); copyTree(sourceRoot,stage,{sourceMode:true});
  normalizeIncidentalLovablePackageFiles(stage);
  let caps=detectCapabilities(stage);

  // Validate the source's own install/build before harness normalization.
  if(!fs.existsSync(path.join(stage,"package-lock.json"))){
    requireOk(runSync(["npm","install","--package-lock-only","--ignore-scripts"],{cwd:stage,timeoutMs:180000}),"lockfile generation");
    if(!fs.existsSync(path.join(stage,"package-lock.json"))) throw new Error("lockfile generation reported success but package-lock.json was not produced");
  }
  requireOk(runSync(["npm","ci"],{cwd:stage,timeoutMs:300000}),"npm ci (source)");
  requireOk(runSync(caps.commands.build,{cwd:stage,timeoutMs:180000}),"npm run build (source)");

  // Add pinned harness tooling and scripts, then synchronize the lockfile.
  const pkgPath=path.join(stage,"package.json"); const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
  pkg.engines={...(pkg.engines??{}),node:"22.16.x"}; pkg.devDependencies={...(pkg.devDependencies??{}),"@biomejs/biome":"1.9.4","@playwright/test":"1.58.2"};
  if(caps.hasTsconfig && !pkg.devDependencies.typescript && !(pkg.dependencies??{}).typescript) pkg.devDependencies.typescript="5.8.3";
  pkg.scripts={...(pkg.scripts??{}),"harness:standards":"bash scripts/scan-banned.sh","harness:lint":"biome ci src e2e --reporter=json","harness:typecheck":caps.hasTsconfig?(pkg.scripts?.typecheck??"tsc --noEmit"):"node -e \"process.exit(0)\"","harness:build":pkg.scripts.build,"harness:e2e":"playwright test --project=chromium","harness:gate":"bash scripts/gate.sh"};
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");
  requireOk(runSync(["npm","install","--package-lock-only","--ignore-scripts"],{cwd:stage,timeoutMs:240000}),"lockfile normalization");
  requireOk(runSync(["npm","ci"],{cwd:stage,timeoutMs:300000}),"npm ci (normalized)");

  for(const rel of HARNESS_FILES){ const src=path.join(ROOT,rel); if(fs.existsSync(src)){ const dst=path.join(stage,rel); if(fs.existsSync(dst)) fs.rmSync(dst,{recursive:true,force:true}); if(fs.statSync(src).isDirectory()) copyTree(src,dst); else {fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);} } }
  // Project-specific specs are committed after baseline-v1. Never carry a previous
  // customer's e2e suite into a new import.
  fs.rmSync(path.join(stage,"e2e"),{recursive:true,force:true});
  fs.mkdirSync(path.join(stage,"e2e"),{recursive:true});
  fs.writeFileSync(path.join(stage,"e2e",".gitkeep"),"");
  fs.writeFileSync(path.join(stage,".nvmrc"),"22.16.0\n");
  caps=detectCapabilities(stage);
  const framework=caps.framework;
  const dev=framework==="vite"?["npm","run",caps.packageJson.scripts.dev?"dev":"start","--","--host","127.0.0.1","--port","{PORT}"]:["npm","run",caps.packageJson.scripts.dev?"dev":"start"];
  const harness=assertHarness({schemaVersion:1,harnessVersion:"0.1.0",source:{kind:sourceKind,identity:sourceIdentity,...(resolvedCommit?{resolvedCommit}:{})},importedAt:new Date().toISOString(),nodeVersion:"22.16.0",framework,commands:{build:["npm","run","harness:build"],dev,typecheck:["npm","run","harness:typecheck"],lint:["node_modules/.bin/biome","ci","src","e2e","--reporter=json"],e2e:["node_modules/.bin/playwright","test","--project=chromium"]},writableGlobs:["src/**"],serverReadyTimeoutMs:30000});
  fs.writeFileSync(path.join(stage,"harness.json"),JSON.stringify(harness,null,2)+"\n");

  // Prove the configured hook rule actually fires.
  const smoke=path.join(stage,"src","__harness_exhaustive_deps_smoke.tsx"); fs.mkdirSync(path.dirname(smoke),{recursive:true}); fs.writeFileSync(smoke,'import { useEffect } from "react";\nexport function Smoke({value}:{value:number}){ useEffect(()=>{ console.log(value); },[]); return null; }\n');
  const biomeSmoke=runSync(["npx","--no-install","biome","lint",smoke,"--reporter=json"],{cwd:stage,timeoutMs:120000}); fs.rmSync(smoke,{force:true});
  if(biomeSmoke.status===0||!provesExhaustiveDependencies(biomeSmoke.stdout)) throw new Error("Biome proof failed: useExhaustiveDependencies did not fire at error severity");

  requireOk(runSync(caps.commands.build,{cwd:stage,timeoutMs:180000}),"normalized build");
  const report=buildImportReport(stage,{...caps,commands:harness.commands}); fs.writeFileSync(path.join(stage,"import-report.md"),report.markdown);

  if(process.env.HARNESS_SKIP_BROWSER_INSTALL!=="1") requireOk(runSync(["npx","--no-install","playwright","install","chromium"],{cwd:stage,timeoutMs:300000}),"Playwright Chromium install");

  // Apply validated stage overlay. Existing harness documentation not present in stage remains intact.
  // e2e is harness-owned and intentionally replaced so stale customer tests cannot leak across imports.
  fs.rmSync(path.join(ROOT,"e2e"),{recursive:true,force:true});
  copyTree(stage,ROOT);
  git(["add","-A"],{cwd:ROOT});
  if(!isClean(ROOT)) git(["-c","user.name=Lotus Harness","-c","user.email=harness@local","commit","-m","chore: import Lovable export under harness control"],{cwd:ROOT});
  const baseline=head(ROOT); const tag=git(["rev-parse","--verify","baseline-v1"],{cwd:ROOT,allowFailure:true});
  if(tag.status!==0) git(["tag","baseline-v1",baseline],{cwd:ROOT});
  else if(tag.stdout.trim()!==baseline) throw new Error("baseline-v1 exists and does not point at normalized import commit");
  // Staging dependencies are intentionally never copied. Hydrate ignored local
  // tools only after the tracked transaction and tag are durable.
  hydrateTarget();
  console.log(`Imported ${sourceIdentity}`); console.log(`baseline-v1 -> ${baseline}`); console.log("Import report: import-report.md");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
