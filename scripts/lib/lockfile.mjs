import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runSync } from "./process.mjs";

const DEFAULT_MAX_PASSES=5;

function sha256(text){ return crypto.createHash("sha256").update(text).digest("hex"); }

// `npm install --package-lock-only` can write an internally inconsistent
// lockfile on its first pass: an optional-peer conflict (e.g. a dependency
// wanting ajv@8 while another wants ajv@6) gets resolved away with a warning,
// while `npm ci`'s stricter ideal-tree check demands both branches. A second
// generation pass then writes closer to the tree ci expects, but content can
// keep shifting for a few more passes before it is byte-stable. Reconcile
// until ci accepts the lock AND two consecutive passes are identical, so
// re-imports stay deterministic (IMP-013). Runner/hash are injectable so
// tests never shell out to real npm.
export function reconcileLockfile({cwd,lockPath=path.join(cwd,"package-lock.json"),maxPasses=DEFAULT_MAX_PASSES,run=runSync,hash=sha256,timeoutMs=180000}={}){
  let previousHash=null,lastDryRun=null;
  for(let pass=1;pass<=maxPasses;pass++){
    const install=run(["npm","install","--package-lock-only","--ignore-scripts"],{cwd,timeoutMs});
    if(install.status!==0) throw new Error(`lockfile generation failed on pass ${pass}\n${install.stderr||install.stdout}`);
    const currentHash=hash(fs.readFileSync(lockPath,"utf8"));
    lastDryRun=run(["npm","ci","--dry-run","--ignore-scripts"],{cwd,timeoutMs});
    if(lastDryRun.status===0&&currentHash===previousHash) return {passes:pass,stable:true};
    previousHash=currentHash;
  }
  throw new Error(`lockfile did not reach a stable, ci-valid state within ${maxPasses} passes\n${lastDryRun?.stderr||lastDryRun?.stdout||""}`);
}
