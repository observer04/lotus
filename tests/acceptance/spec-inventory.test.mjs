import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../helpers/test-utils.mjs";

test("SPEC-R1 through SPEC-R8 are present one-to-one and precede implementation assumptions",()=>{
  const text=fs.readFileSync(path.join(PROJECT_ROOT,"e2e/coffee-ordering.spec.ts"),"utf8");
  for(let i=1;i<=8;i++) assert.equal((text.match(new RegExp(`test\\(\\\"R${i}\\b`,`g`))??[]).length,1,`R${i} must appear exactly once as a test title`);
  assert.match(text,/coffee-cart-v1/);
  assert.match(text,/\^ORD-\\d\{6\}\$/);
  assert.match(text,/\$4\.50/);
});
