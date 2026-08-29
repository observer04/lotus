#!/usr/bin/env node
import { scanBanned } from "./lib/scan.mjs";
const findings=scanBanned();
if(process.argv.includes("--json")) console.log(JSON.stringify({status:findings.length?"failed":"passed",findings},null,2)); else for(const f of findings) console.log(`${f.path}:${f.line} [${f.id}] banned pattern`);
process.exit(findings.length?1:0);
