import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir,initRepo,commitAll,copyHarnessCore,run,readJson,PROJECT_ROOT,git } from "../helpers/test-utils.mjs";

function fakeTools(){
  const bin=tempDir("lotus-fake-bin-");
  const npm=`#!/usr/bin/env node\nimport fs from 'node:fs';\nif(process.argv.slice(2).includes('--package-lock-only')){const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync('package-lock.json',JSON.stringify({name:pkg.name??'app',version:pkg.version??'0.0.0',lockfileVersion:3,requires:true,packages:{'':{name:pkg.name??'app',version:pkg.version??'0.0.0'}}},null,2)+'\\n');}\nprocess.exit(0);\n`;
  const npx=`#!/usr/bin/env node\nconst a=process.argv.slice(2).join(' ');\nif(a.includes('biome lint')&&a.includes('__harness_exhaustive_deps_smoke')){console.log(JSON.stringify({diagnostics:[{category:'lint/correctness/useExhaustiveDependencies',severity:'error',message:'missing dependency'}]}));process.exit(1);}\nif(a.includes('biome')){console.log(JSON.stringify({diagnostics:[]}));process.exit(0);}\nprocess.exit(0);\n`;
  fs.writeFileSync(path.join(bin,"npm"),npm,{mode:0o755}); fs.writeFileSync(path.join(bin,"npx"),npx,{mode:0o755}); return bin;
}
function target(){
  const root=tempDir("lotus-import-target-"); initRepo(root); copyHarnessCore(root,{includeE2E:true});
  fs.writeFileSync(path.join(root,"README.md"),"# Harness\n"); fs.writeFileSync(path.join(root,"FINDINGS.md"),"# Findings\n"); fs.writeFileSync(path.join(root,"cycles.jsonl"),"");
  fs.writeFileSync(path.join(root,"package.json"),JSON.stringify({name:"harness-template",version:"0.1.0",private:true,type:"module"},null,2));
  commitAll(root,"template"); return root;
}
function runImport(root,source,bin){
  return run(["bash","scripts/import-lovable.sh",source],{cwd:root,env:{PATH:`${bin}:${process.env.PATH}`,HARNESS_SKIP_BROWSER_INSTALL:"1"},timeout:60000,allowFailure:true});
}

test("IMP-001 through IMP-015 importer is reusable, idempotent, and reports six checks",()=>{
  const bin=fakeTools();
  for(const fixture of ["lovable-vite-react","lovable-vite-react-ts"]){
    const root=target(); const source=path.join(PROJECT_ROOT,"tests/fixtures",fixture);
    const first=runImport(root,source,bin); assert.equal(first.status,0,first.stderr||first.stdout);
    assert.equal(git(root,["rev-parse","--verify","baseline-v1"],{allowFailure:true}).status,0);
    const cfg=readJson(path.join(root,"harness.json")); assert.equal(cfg.source.kind,"local"); assert.deepEqual(cfg.writableGlobs,["src/**"]);
    assert.equal(fs.existsSync(path.join(root,"e2e",".gitkeep")),true); assert.equal(fs.existsSync(path.join(root,"e2e","coffee-ordering.spec.ts")),false);
    const report=fs.readFileSync(path.join(root,"import-report.md"),"utf8");
    for(const heading of ["Float currency math","data-testid coverage","Typecheck baseline","Lint baseline","Banned patterns","Dependencies outside platform list"]) assert.match(report,new RegExp(`## ${heading.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&")}`));
    const before=git(root,["rev-parse","HEAD"]).stdout.trim(); const statusBefore=git(root,["status","--porcelain"]).stdout;
    assert.equal(statusBefore,"");
    const second=runImport(root,source,bin); assert.equal(second.status,0,second.stderr||second.stdout); assert.match(second.stdout,/No-op:/);
    assert.equal(git(root,["rev-parse","HEAD"]).stdout.trim(),before); assert.equal(git(root,["status","--porcelain"]).stdout,"");
  }
});

test("IMP-004/IMP-005 missing lockfile is generated before ci and source secrets are excluded",()=>{
  const bin=fakeTools(); const source=tempDir("lotus-source-no-lock-"); fs.cpSync(path.join(PROJECT_ROOT,"tests/fixtures/lovable-vite-react"),source,{recursive:true});
  fs.rmSync(path.join(source,"package-lock.json")); fs.writeFileSync(path.join(source,".env"),"SECRET=do-not-copy\n");
  const root=target(); const r=runImport(root,source,bin); assert.equal(r.status,0,r.stderr||r.stdout); assert.equal(fs.existsSync(path.join(root,"package-lock.json")),true); assert.equal(fs.existsSync(path.join(root,".env")),false);
});

test("IMP-002 rejects symlink-bearing source rather than following escapes",()=>{
  const bin=fakeTools(); const source=tempDir("lotus-source-symlink-"); fs.cpSync(path.join(PROJECT_ROOT,"tests/fixtures/lovable-vite-react"),source,{recursive:true}); fs.symlinkSync("/etc/passwd",path.join(source,"src","escape"));
  const root=target(); const r=runImport(root,source,bin); assert.notEqual(r.status,0); assert.match(`${r.stderr}\n${r.stdout}`,/symlink not allowed/);
});
