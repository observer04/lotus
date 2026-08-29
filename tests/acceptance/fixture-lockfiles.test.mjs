import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../helpers/test-utils.mjs";

for(const fixture of ["lovable-vite-react","lovable-vite-react-ts","react-custom-bundler"]){
  test(`IMP-014 ${fixture} lockfile contains every direct dependency required by npm ci`,()=>{
    const root=path.join(PROJECT_ROOT,"tests","fixtures",fixture);
    const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
    const lock=JSON.parse(fs.readFileSync(path.join(root,"package-lock.json"),"utf8"));
    assert.equal(lock.lockfileVersion,3);
    for(const group of ["dependencies","devDependencies"]){
      assert.deepEqual(lock.packages?.[""]?.[group]??{},pkg[group]??{});
      for(const name of Object.keys(pkg[group]??{})) assert.ok(lock.packages?.[`node_modules/${name}`],`${name} missing from lockfile packages`);
    }
  });
}
