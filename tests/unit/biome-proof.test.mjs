import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonEnvelope, provesExhaustiveDependencies } from "../../scripts/lib/biome-proof.mjs";

test("IMP-008 Biome proof requires the exact error diagnostic",()=>{
  const real=JSON.stringify({diagnostics:[{category:"lint/correctness/useExhaustiveDependencies",severity:"error"}]});
  assert.equal(provesExhaustiveDependencies(real),true);
  assert.equal(provesExhaustiveDependencies('config error near "useExhaustiveDependencies"'),false);
  assert.equal(provesExhaustiveDependencies(JSON.stringify({diagnostics:[{category:"lint/correctness/useExhaustiveDependencies",severity:"warning"}]})),false);
  assert.deepEqual(parseJsonEnvelope(`\u001b[0m${real}\u001b[0m`),JSON.parse(real));
});
