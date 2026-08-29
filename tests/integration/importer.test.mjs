import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir,initRepo,commitAll,copyHarnessCore,run,readJson,PROJECT_ROOT,git } from "../helpers/test-utils.mjs";
import { scanBanned } from "../../scripts/lib/scan.mjs";
import { loadUnownedGlobs } from "../../scripts/lib/ownership.mjs";

function fakeTools(){
  const bin=tempDir("lotus-fake-bin-");
  const npm=`#!/usr/bin/env node\nimport fs from 'node:fs';\nconst args=process.argv.slice(2);\nif(args.includes('--package-lock-only')){const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));fs.writeFileSync('package-lock.json',JSON.stringify({name:pkg.name??'app',version:pkg.version??'0.0.0',lockfileVersion:3,requires:true,packages:{'':{name:pkg.name??'app',version:pkg.version??'0.0.0'}}},null,2)+'\\n');}\nif(args[0]==='ci'){fs.mkdirSync('node_modules/.bin',{recursive:true});fs.writeFileSync('node_modules/.bin/biome','#!/bin/sh\\nexit 0\\n',{mode:0o755});}\nprocess.exit(0);\n`;
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
  for(const fixture of ["lovable-vite-react","lovable-vite-react-ts","react-custom-bundler"]){
    const root=target(); const source=path.join(PROJECT_ROOT,"tests/fixtures",fixture);
    const first=runImport(root,source,bin); assert.equal(first.status,0,first.stderr||first.stdout);
    assert.equal(git(root,["rev-parse","--verify","baseline-v1"],{allowFailure:true}).status,0);
    const cfg=readJson(path.join(root,"harness.json")); assert.equal(cfg.source.kind,"local"); assert.deepEqual(cfg.writableGlobs,["src/**"]);
    assert.equal(cfg.framework,fixture==="react-custom-bundler"?"node-frontend":"vite");
    assert.equal(cfg.commands.lint[0],"node_modules/.bin/biome"); assert.equal(fs.existsSync(path.join(root,"node_modules/.bin/biome")),true);
    assert.equal(fs.existsSync(path.join(root,"e2e",".gitkeep")),true); assert.equal(fs.existsSync(path.join(root,"e2e","coffee-ordering.spec.ts")),false);
    const report=fs.readFileSync(path.join(root,"import-report.md"),"utf8");
    for(const heading of ["Float currency math","data-testid coverage","Typecheck baseline","Lint baseline","Banned patterns","Dependencies outside platform list"]) assert.match(report,new RegExp(`## ${heading.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&")}`));
    const before=git(root,["rev-parse","HEAD"]).stdout.trim(); const statusBefore=git(root,["status","--porcelain"]).stdout;
    assert.equal(statusBefore,"");
    const second=runImport(root,source,bin); assert.equal(second.status,0,second.stderr||second.stdout); assert.match(second.stdout,/No-op:/);
    assert.equal(git(root,["rev-parse","HEAD"]).stdout.trim(),before); assert.equal(git(root,["status","--porcelain"]).stdout,"");
  }
});

test("IMP-004/IMP-005 current Lovable Bun artifacts normalize to npm and environment files are excluded",()=>{
  const bin=fakeTools(); const source=tempDir("lotus-source-no-lock-"); fs.cpSync(path.join(PROJECT_ROOT,"tests/fixtures/lovable-vite-react"),source,{recursive:true});
  fs.rmSync(path.join(source,"package-lock.json")); fs.writeFileSync(path.join(source,"bun.lock"),"incidental lovable lock\n"); fs.writeFileSync(path.join(source,"bunfig.toml"),"[install]\n"); fs.writeFileSync(path.join(source,".env"),"SECRET=do-not-copy\n");
  const root=target(); const r=runImport(root,source,bin); assert.equal(r.status,0,r.stderr||r.stdout); assert.equal(fs.existsSync(path.join(root,"package-lock.json")),true); assert.equal(fs.existsSync(path.join(root,"bun.lock")),false); assert.equal(fs.existsSync(path.join(root,"bunfig.toml")),false); assert.equal(fs.existsSync(path.join(root,".env")),false);
});

test("IMP-016 rejects high-confidence secret literals without printing their values",()=>{
  const bin=fakeTools(); const source=tempDir("lotus-source-secret-"); fs.cpSync(path.join(PROJECT_ROOT,"tests/fixtures/lovable-vite-react"),source,{recursive:true});
  const secret=["sk","proj","abcdefghijklmnopqrstuvwxyz123456"].join("-"); fs.writeFileSync(path.join(source,"src","secret.js"),`export const token = "${secret}";\n`);
  const root=target(); const r=runImport(root,source,bin); assert.notEqual(r.status,0);
  const output=`${r.stderr}\n${r.stdout}`; assert.match(output,/OPENAI_KEY src\/secret\.js:1/); assert.doesNotMatch(output,new RegExp(secret)); assert.equal(fs.existsSync(path.join(root,"src","secret.js")),false);
});

test("IMP-017/IMP-018 unowned generated and vendored paths are excluded from standards while surviving in the import report",()=>{
  const bin=fakeTools(); const root=target();
  const source=path.join(PROJECT_ROOT,"tests/fixtures/lovable-vite-react-ts");
  const first=runImport(root,source,bin); assert.equal(first.status,0,first.stderr||first.stdout);

  const unownedGlobs=loadUnownedGlobs({cwd:root});
  const standardsFindings=scanBanned({cwd:root,unownedGlobs});
  assert.deepEqual(standardsFindings.map(f=>f.path),[],"generator-owned/vendored paths must not reach the standards gate");

  const report=fs.readFileSync(path.join(root,"import-report.md"),"utf8");
  assert.match(report,/AS_ANY src\/routeTree\.gen\.ts/,"import report must still surface generator findings");
  assert.match(report,/AS_ANY src\/components\/ui\/button\.tsx/,"import report must still surface vendored findings");
  const testIdSection=report.slice(report.indexOf("## data-testid coverage"),report.indexOf("## Typecheck baseline"));
  assert.doesNotMatch(testIdSection,/button\.tsx/,"vendored components are out of scope for the data-testid check");

  const biomeCfg=readJson(path.join(root,"biome.json"));
  for(const glob of ["src/**/*.gen.ts","src/**/*.gen.tsx","src/components/ui/**","**/*.css"]) assert.ok(biomeCfg.files.ignore.includes(glob),`biome.json missing ${glob} in files.ignore`);
  assert.equal(biomeCfg.css.linter.enabled,false);
  assert.equal(biomeCfg.css.formatter.enabled,false);
});

test("IMP-002 rejects symlink-bearing source rather than following escapes",()=>{
  const bin=fakeTools(); const source=tempDir("lotus-source-symlink-"); fs.cpSync(path.join(PROJECT_ROOT,"tests/fixtures/lovable-vite-react"),source,{recursive:true}); fs.symlinkSync("/etc/passwd",path.join(source,"src","escape"));
  const root=target(); const r=runImport(root,source,bin); assert.notEqual(r.status,0); assert.match(`${r.stderr}\n${r.stdout}`,/symlink not allowed/);
});
