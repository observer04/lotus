import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { verifyProtected } from "../../scripts/lib/protection.mjs";
import { tempDir,initRepo,commitAll,git } from "../helpers/test-utils.mjs";

test("CYC-006/CYC-008 committed src edit is allowed but protected edit is rejected",()=>{
  const root=tempDir(); initRepo(root); fs.mkdirSync(path.join(root,"src")); fs.mkdirSync(path.join(root,"e2e"));
  fs.writeFileSync(path.join(root,"src/a.js"),"one\n"); fs.writeFileSync(path.join(root,"e2e/a.spec.js"),"test('x',()=>{});\n");
  const base=commitAll(root,"base");
  fs.writeFileSync(path.join(root,"src/a.js"),"two\n"); const srcHead=commitAll(root,"src edit");
  assert.equal(verifyProtected({before:base,after:srcHead,cwd:root,writableGlobs:["src/**"]}).ok,true);
  fs.writeFileSync(path.join(root,"e2e/a.spec.js"),"test.skip('x',()=>{});\n"); const badHead=commitAll(root,"tamper");
  const result=verifyProtected({before:srcHead,after:badHead,cwd:root,writableGlobs:["src/**"]});
  assert.equal(result.ok,false);
  assert.ok(result.violations.some(v=>v.type==="protected_path"&&v.path==="e2e/a.spec.js"));
});

test("CYC-008 uncommitted protected path cannot evade SHA-range checking",()=>{
  const root=tempDir(); initRepo(root); fs.mkdirSync(path.join(root,"src")); fs.writeFileSync(path.join(root,"src/a.js"),"ok\n"); fs.writeFileSync(path.join(root,"package.json"),"{}\n");
  const base=commitAll(root,"base");
  fs.writeFileSync(path.join(root,"package.json"),'{"scripts":{"build":"true"}}\n');
  const result=verifyProtected({before:base,after:base,cwd:root,writableGlobs:["src/**"]});
  assert.equal(result.ok,false);
  assert.ok(result.violations.some(v=>v.type==="protected_worktree_path"&&v.path==="package.json"));
});

test("CYC-008 source symlink is rejected even under writable root",()=>{
  const root=tempDir(); initRepo(root); fs.mkdirSync(path.join(root,"src")); fs.writeFileSync(path.join(root,"target.txt"),"x"); fs.writeFileSync(path.join(root,"src/a.js"),"ok\n"); const base=commitAll(root,"base");
  fs.unlinkSync(path.join(root,"src/a.js")); fs.symlinkSync("../target.txt",path.join(root,"src/a.js")); commitAll(root,"symlink"); const after=git(root,["rev-parse","HEAD"]).stdout.trim();
  const result=verifyProtected({before:base,after,cwd:root,writableGlobs:["src/**"]});
  assert.equal(result.ok,false);
  assert.ok(result.violations.some(v=>v.type==="symlink"));
});
