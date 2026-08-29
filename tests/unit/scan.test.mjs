import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scanBanned } from "../../scripts/lib/scan.mjs";
import { PROJECT_ROOT,tempDir } from "../helpers/test-utils.mjs";

test("GATE-008 scanner finds source, test, and script suppression without matching prose",()=>{
  const root=tempDir();
  fs.mkdirSync(path.join(root,"config"),{recursive:true}); fs.cpSync(path.join(PROJECT_ROOT,"config/banned-patterns.json"),path.join(root,"config/banned-patterns.json"));
  fs.mkdirSync(path.join(root,"src")); fs.mkdirSync(path.join(root,"e2e")); fs.mkdirSync(path.join(root,"scripts"));
  fs.writeFileSync(path.join(root,"src/a.ts"),[
    "// we deliberately avoid using as any here",
    "const explanation = 'do not use as any';",
    "const x = y as any;"
  ].join("\n"));
  fs.writeFileSync(path.join(root,"e2e/a.spec.ts"),"test.skip('x',()=>{});\n");
  fs.writeFileSync(path.join(root,"scripts/unsafe.sh"),"#!/bin/sh\nrun_check || true\n");
  fs.writeFileSync(path.join(root,"scripts/scanner.js"),"const pattern='test.skip';\n");
  const findings=scanBanned({cwd:root});
  assert.deepEqual(findings.map(f=>f.id).sort(),["AS_ANY","OR_TRUE","TEST_SKIP"]);
  assert.match(findings.find(f=>f.id==="AS_ANY").excerpt,/const x/);
});

test("GATE-008 directive patterns match actual suppression comments but not discussion",()=>{
  const root=tempDir();
  fs.mkdirSync(path.join(root,"config"),{recursive:true}); fs.cpSync(path.join(PROJECT_ROOT,"config/banned-patterns.json"),path.join(root,"config/banned-patterns.json"));
  fs.mkdirSync(path.join(root,"src"));
  fs.writeFileSync(path.join(root,"src/a.ts"),"// avoid @ts-ignore in this code\n// @ts-ignore\nconst x = nope;\n");
  assert.deepEqual(scanBanned({cwd:root}).map(f=>f.id),["TS_IGNORE"]);
});
