import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir,initRepo,commitAll,copyHarnessCore,run,git } from "../helpers/test-utils.mjs";

function makePatch(root,pathName,from,to){
  const file=path.join(root,pathName); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,from); commitAll(root,"base"); fs.writeFileSync(file,to); const patch=git(root,["diff","--",pathName]).stdout; git(root,["restore","--",pathName]); const patchFile=path.join(root,"defect.patch"); fs.writeFileSync(patchFile,patch); return patchFile;
}

test("defect injector preserves an explicit committed red state",()=>{
  const root=tempDir(); initRepo(root); copyHarnessCore(root); fs.mkdirSync(path.join(root,"src"),{recursive:true}); fs.writeFileSync(path.join(root,"cycles.jsonl"),"");
  const patch=makePatch(root,"src/a.js","const x=1;\n","const x=2;\n");
  // patch file itself must not make the repository dirty at invocation time.
  const outside=path.join(tempDir(),"defect.patch"); fs.copyFileSync(patch,outside); fs.rmSync(patch); assert.equal(git(root,["status","--porcelain"]).stdout,"");
  const r=run(["bash","scripts/inject-defect.sh","type-error",outside],{cwd:root,allowFailure:true}); assert.equal(r.status,0,r.stderr||r.stdout); assert.match(fs.readFileSync(path.join(root,"src/a.js"),"utf8"),/x=2/); assert.match(git(root,["log","-1","--format=%s"]).stdout,/test\(defect\): type-error/);
});

test("defect injector rejects patches outside src/e2e",()=>{
  const root=tempDir(); initRepo(root); copyHarnessCore(root); fs.writeFileSync(path.join(root,"cycles.jsonl"),""); fs.writeFileSync(path.join(root,"README.md"),"one\n"); const base=commitAll(root,"base");
  fs.writeFileSync(path.join(root,"README.md"),"two\n"); const patch=git(root,["diff","--","README.md"]).stdout; git(root,["restore","--","README.md"]); const outside=path.join(tempDir(),"bad.patch"); fs.writeFileSync(outside,patch); assert.equal(git(root,["rev-parse","HEAD"]).stdout.trim(),base);
  const r=run(["bash","scripts/inject-defect.sh","bad",outside],{cwd:root,allowFailure:true}); assert.notEqual(r.status,0); assert.match(`${r.stderr}${r.stdout}`,/may touch only src/);
});
