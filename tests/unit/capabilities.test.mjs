import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { detectCapabilities } from "../../scripts/lib/capabilities.mjs";
import { tempDir } from "../helpers/test-utils.mjs";

function writePkg(root,pkg){fs.writeFileSync(path.join(root,"package.json"),JSON.stringify(pkg));}

test("IMP supported profile detects Vite without assuming generator",()=>{
  const root=tempDir();
  writePkg(root,{scripts:{dev:"vite",build:"vite build"},dependencies:{vite:"5.0.0"}});
  const c=detectCapabilities(root);
  assert.equal(c.framework,"vite");
  assert.deepEqual(c.commands.build,["npm","run","build"]);
});

test("IMP rejects workspaces and non-npm package managers",()=>{
  const a=tempDir(); writePkg(a,{workspaces:["apps/*"],scripts:{dev:"x",build:"x"}});
  assert.throws(()=>detectCapabilities(a),/workspaces/);
  const b=tempDir(); writePkg(b,{packageManager:"pnpm@9",scripts:{dev:"x",build:"x"}});
  assert.throws(()=>detectCapabilities(b),/unsupported package manager/);
});

test("IMP rejects Supabase backend dependency in MVP",()=>{
  const root=tempDir(); writePkg(root,{scripts:{dev:"x",build:"x"},dependencies:{"@supabase/supabase-js":"2"}});
  assert.throws(()=>detectCapabilities(root),/unsupported backend dependency/);
});
