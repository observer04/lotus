#!/usr/bin/env node
import fs from "node:fs";
import { verifyProtected } from "./lib/protection.mjs";
import { loadUnownedGlobs } from "./lib/ownership.mjs";
const [before,after]=process.argv.slice(2); if(!before||!after){console.error("usage: verify-protected.sh BEFORE_SHA AFTER_SHA");process.exit(2);}
let writable=["src/**"]; try{const cfg=JSON.parse(fs.readFileSync("harness.json","utf8"));if(Array.isArray(cfg.writableGlobs))writable=cfg.writableGlobs;}catch{}
const unownedGlobs=loadUnownedGlobs({cwd:process.cwd()});
const result=verifyProtected({before,after,writableGlobs:writable,unownedGlobs}); console.log(JSON.stringify(result,null,2)); process.exit(result.ok?0:1);
