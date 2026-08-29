#!/usr/bin/env node
import fs from "node:fs";
import { assertGateReport, assertHarness } from "./lib/schema.mjs";
import { buildPrompt } from "./lib/prompt.mjs";
import { loadUnownedGlobs } from "./lib/ownership.mjs";

const reportPath=process.argv[2];
if(!reportPath){console.error("usage: build-prompt.sh gate-report.json");process.exit(2);}
const report=assertGateReport(JSON.parse(fs.readFileSync(reportPath,"utf8")));
if(report.status!=="failed"){console.error("gate report must have status=failed");process.exit(2);}
let writableGlobs=["src/**"];
try{writableGlobs=assertHarness(JSON.parse(fs.readFileSync("harness.json","utf8"))).writableGlobs;}catch{}
const unownedGlobs=loadUnownedGlobs({cwd:process.cwd()});
process.stdout.write(buildPrompt(report,{byteCeiling:Number(process.env.HARNESS_PROMPT_MAX_BYTES??48*1024),writableGlobs,unownedGlobs}));
