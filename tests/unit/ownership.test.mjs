import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { globToRegExp,matchesAny,loadUnownedGlobs } from "../../scripts/lib/ownership.mjs";
import { PROJECT_ROOT,tempDir } from "../helpers/test-utils.mjs";

test("GATE-011 glob matcher handles **, *, and ? tokens",()=>{
  assert.equal(matchesAny("src/routeTree.gen.ts",["src/**/*.gen.ts"]),true);
  assert.equal(matchesAny("src/routes/nested/deep.gen.ts",["src/**/*.gen.ts"]),true);
  assert.equal(matchesAny("src/routes/index.tsx",["src/**/*.gen.ts"]),false);
  assert.equal(matchesAny("src/components/ui/button.tsx",["src/components/ui/**"]),true);
  assert.equal(matchesAny("src/components/uikit/button.tsx",["src/components/ui/**"]),false);
  assert.equal(matchesAny("src/a.tsx",["src/?.tsx"]),true);
  assert.equal(matchesAny("src/ab.tsx",["src/?.tsx"]),false);
  assert.ok(globToRegExp("src/**/*.gen.tsx").test("src/deep/nested/routeTree.gen.tsx"));
});

test("GATE-011 loadUnownedGlobs merges the versioned policy with harness.json unownedGlobs",()=>{
  const root=tempDir(); fs.mkdirSync(path.join(root,"config"),{recursive:true});
  fs.writeFileSync(path.join(root,"config/unowned-paths.json"),JSON.stringify({schemaVersion:1,globs:[{glob:"src/components/ui/**",reason:"vendored"}]}));
  fs.writeFileSync(path.join(root,"harness.json"),JSON.stringify({unownedGlobs:["custom/**"]}));
  const globs=loadUnownedGlobs({cwd:root});
  assert.ok(globs.includes("src/components/ui/**"));
  assert.ok(globs.includes("custom/**"));
});

test("GATE-011 loadUnownedGlobs tolerates a missing harness.json",()=>{
  const root=tempDir(); fs.mkdirSync(path.join(root,"config"),{recursive:true});
  fs.writeFileSync(path.join(root,"config/unowned-paths.json"),JSON.stringify({schemaVersion:1,globs:[{glob:"src/**/*.gen.ts",reason:"generated"}]}));
  assert.deepEqual(loadUnownedGlobs({cwd:root}),["src/**/*.gen.ts"]);
});

test("GATE-011 biome.json files.ignore is a superset of config/unowned-paths.json (single-source guard)",()=>{
  const policy=JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT,"config/unowned-paths.json"),"utf8"));
  const biome=JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT,"biome.json"),"utf8"));
  for(const {glob} of policy.globs) assert.ok(biome.files.ignore.includes(glob),`biome.json files.ignore missing ${glob}`);
});
