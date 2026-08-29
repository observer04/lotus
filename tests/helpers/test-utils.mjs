import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const PROJECT_ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),"../..");

export function tempDir(prefix="lotus-test-"){
  return fs.mkdtempSync(path.join(os.tmpdir(),prefix));
}

export function run(argv,{cwd,env={},timeout=30000,allowFailure=false}={}){
  const r=spawnSync(argv[0],argv.slice(1),{cwd,env:{...process.env,...env},encoding:"utf8",timeout,maxBuffer:32*1024*1024});
  if(!allowFailure && r.status!==0){
    throw new Error(`${argv.join(" ")} failed (${r.status})\nSTDOUT:\n${r.stdout??""}\nSTDERR:\n${r.stderr??""}`);
  }
  return r;
}

export function git(cwd,args,opts={}){
  return run(["git",...args],{cwd,...opts});
}

export function initRepo(cwd){
  run(["git","init","-q"],{cwd});
  run(["git","config","user.name","Lotus Test"],{cwd});
  run(["git","config","user.email","lotus-test@example.invalid"],{cwd});
}

export function commitAll(cwd,message="fixture"){
  git(cwd,["add","-A"]);
  const quiet=git(cwd,["diff","--cached","--quiet"],{allowFailure:true});
  if(quiet.status!==0) git(cwd,["commit","-q","-m",message]);
  return git(cwd,["rev-parse","HEAD"]).stdout.trim();
}

export function copyHarnessCore(dst,{includeE2E=false}={}){
  for(const rel of ["scripts","config","schemas","AI_RULES.md","biome.json","playwright.config.ts",".gitignore",".nvmrc"]){
    const src=path.join(PROJECT_ROOT,rel), target=path.join(dst,rel);
    if(!fs.existsSync(src)) continue;
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.cpSync(src,target,{recursive:true});
  }
  if(includeE2E){
    fs.cpSync(path.join(PROJECT_ROOT,"e2e"),path.join(dst,"e2e"),{recursive:true});
  } else {
    fs.mkdirSync(path.join(dst,"e2e"),{recursive:true});
  }
  if(!fs.existsSync(path.join(dst,"cycles.jsonl"))) fs.writeFileSync(path.join(dst,"cycles.jsonl"),"");
}

export function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"));}
export function readJsonl(file){return fs.readFileSync(file,"utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);}
