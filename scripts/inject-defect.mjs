#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { git, isClean } from "./lib/git-state.mjs";
const ROOT=process.cwd(); const [name,patchArg]=process.argv.slice(2);
if(!name||!patchArg){console.error("usage: scripts/inject-defect.sh <name> <patch-file>");process.exit(2);} if(!/^[a-z0-9][a-z0-9._-]*$/i.test(name)){console.error("defect name must be a simple identifier");process.exit(2);} if(!isClean(ROOT)){console.error("repository must be clean before defect injection");process.exit(2);}
const patch=path.resolve(patchArg); if(!fs.existsSync(patch)||!fs.statSync(patch).isFile()){console.error("patch file not found");process.exit(2);}
const check=spawnSync("git",["apply","--check",patch],{cwd:ROOT,encoding:"utf8"}); if(check.status!==0){console.error(check.stderr||check.stdout||"patch does not apply");process.exit(1);}
const numstat=spawnSync("git",["apply","--numstat",patch],{cwd:ROOT,encoding:"utf8"}); const paths=numstat.stdout.trim().split(/\r?\n/).filter(Boolean).map(line=>line.split("\t").at(-1)); const bad=paths.filter(p=>!(p==="src"||p.startsWith("src/")||p==="e2e"||p.startsWith("e2e/"))); if(bad.length){console.error(`defect patches may touch only src/** or e2e/**: ${bad.join(", ")}`);process.exit(1);}
const applied=spawnSync("git",["apply",patch],{cwd:ROOT,encoding:"utf8"}); if(applied.status!==0){console.error(applied.stderr||applied.stdout);process.exit(1);} git(["add","--",...paths],{cwd:ROOT}); git(["-c","user.name=Lotus Harness","-c","user.email=harness@local","commit","-m",`test(defect): ${name}`],{cwd:ROOT}); console.log(`Injected defect '${name}' at ${git(["rev-parse","HEAD"],{cwd:ROOT}).stdout.trim()}`);
