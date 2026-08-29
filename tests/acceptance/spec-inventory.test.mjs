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

function requirementIds(text){
  const ids=new Set(text.match(/\b(?:IMP|GATE|PRM|CYC)-\d{3}\b|\bSPEC-R\d+\b/g)??[]);
  for(const match of text.matchAll(/\b(IMP|GATE|PRM|CYC)-(\d{3})–\1-(\d{3})\b/g)){
    for(let n=Number(match[2]);n<=Number(match[3]);n++) ids.add(`${match[1]}-${String(n).padStart(3,"0")}`);
  }
  for(const match of text.matchAll(/\bSPEC-R(\d+)(?:–SPEC-R| through SPEC-R)(\d+)\b/g)){
    for(let n=Number(match[1]);n<=Number(match[2]);n++) ids.add(`SPEC-R${n}`);
  }
  return ids;
}

test("design traceability covers every normative IMP/GATE/PRM/CYC/SPEC requirement",()=>{
  const design=fs.readFileSync(path.join(PROJECT_ROOT,"design.md"),"utf8");
  const normative=design.slice(design.indexOf("## 4. Normative requirements"),design.indexOf("## 5. User workflow"));
  const trace=design.slice(design.indexOf("## 12. Traceability"),design.indexOf("## 13. Implementation order"));
  const missing=[...requirementIds(normative)].filter(id=>!requirementIds(trace).has(id));
  assert.deepEqual(missing,[]);
});
