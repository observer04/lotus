import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeFailure, failureSignature, parseTsc, parseBiome, parsePlaywright, parseBuild, playwrightSelection } from "../../scripts/lib/diagnostics.mjs";

const root=path.resolve("/tmp/lotus-diagnostics-root");

test("GATE-006/GATE-007 failure identity ignores line movement and output ordering",()=>{
  const a=makeFailure({gate:"typecheck",file:path.join(root,"src/a.ts"),line:10,column:1,rule:"TS2345",message:"one"},root);
  const b=makeFailure({gate:"typecheck",file:path.join(root,"src/a.ts"),line:99,column:8,rule:"TS2345",message:"different punctuation"},root);
  assert.equal(a.failureClassId,b.failureClassId);
  const c=makeFailure({gate:"lint",file:path.join(root,"src/b.ts"),rule:"correctness/useExhaustiveDependencies",message:"x"},root);
  assert.equal(failureSignature([a,c]),failureSignature([c,b,a]));
});

test("GATE-009 Playwright selection reports executed rule IDs and detects zero selection",()=>{
  const selected={suites:[{file:"e2e/spec.ts",specs:[{title:"R4 — remove line",tests:[{results:[{status:"passed"}]}]}]}]};
  assert.deepEqual(playwrightSelection(JSON.stringify(selected)),{testCount:1,testIds:["R4"]});
  assert.deepEqual(playwrightSelection(JSON.stringify({suites:[]})),{testCount:0,testIds:[]});
});

test("GATE-006 build parser extracts common file diagnostics before fallback",()=>{
  const failures=parseBuild("src/App.tsx:12:4: Unexpected token",root);
  assert.equal(failures.length,1);
  assert.equal(failures[0].file,"src/App.tsx");
  assert.equal(failures[0].line,12);
  assert.equal(failures[0].column,4);
  assert.equal(failures[0].rule,"BUILD_DIAGNOSTIC");
});

test("GATE-006 parses tsc diagnostics into stable records",()=>{
  const failures=parseTsc("src/foo.ts(42,9): error TS2345: Argument is wrong\n",root);
  assert.equal(failures.length,1);
  assert.equal(failures[0].rule,"TS2345");
  assert.equal(failures[0].file,"src/foo.ts");
  assert.equal(failures[0].line,42);
});

test("GATE-006 parses Biome JSON",()=>{
  const payload={diagnostics:[{category:"lint/correctness/useExhaustiveDependencies",message:"missing dependency",location:{path:{file:"src/App.tsx"},span:{start:{line:7,column:3}}}}]};
  const failures=parseBiome(JSON.stringify(payload),root);
  assert.equal(failures.length,1);
  assert.equal(failures[0].rule,"correctness/useExhaustiveDependencies");
  assert.equal(failures[0].file,"src/App.tsx");
});

test("GATE-006 parses ANSI-wrapped Biome JSON instead of emitting BIOME_EXIT",()=>{
  const payload={diagnostics:[{category:"format",severity:"error",message:"format me",location:{path:{file:"src/App.tsx"},span:null}}]};
  const failures=parseBiome(`\u001b[0m${JSON.stringify(payload)}\u001b[0m`,root);
  assert.equal(failures.length,1);
  assert.equal(failures[0].rule,"format");
  assert.equal(failures[0].file,"src/App.tsx");
});

test("GATE-006 parses nested Playwright JSON and uses R-rule identity",()=>{
  const payload={suites:[{file:"e2e/coffee-ordering.spec.ts",suites:[{specs:[{title:"R4 — decrement at one removes line",line:20,column:1,tests:[{results:[{status:"failed",error:{message:"expected 0 got 1"}}]}]}]}]}]};
  const failures=parsePlaywright(JSON.stringify(payload),root);
  assert.equal(failures.length,1);
  assert.equal(failures[0].rule,"R4");
  assert.equal(failures[0].testId,"R4");
  assert.equal(failures[0].file,"e2e/coffee-ordering.spec.ts");
});
