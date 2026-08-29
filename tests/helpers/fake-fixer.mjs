import fs from "node:fs";
import { spawnSync } from "node:child_process";
const [mode,_prompt,_before,attemptRaw]=process.argv.slice(2);
const attempt=Number(attemptRaw||"1");
const root=process.cwd();
function git(args){const r=spawnSync("git",args,{cwd:root,encoding:"utf8"});if(r.status!==0)throw new Error(r.stderr||r.stdout);return r;}
function commit(message){git(["add","-A"]);const q=spawnSync("git",["diff","--cached","--quiet"],{cwd:root});if(q.status!==0)git(["-c","user.name=Fake Fixer","-c","user.email=fake@local","commit","-q","-m",message]);}
function writeState(v){fs.writeFileSync("src/state.txt",`${v}\n`);}
if(mode==="green") writeState("FIXED");
else if(mode==="oscillate") writeState(attempt%2===1?"B":"A");
else if(mode==="no-progress") writeState(attempt===1?"B":"C");
else if(mode==="signature-budget") writeState(attempt===1?"X2":"X1");
else if(mode==="tamper") {fs.mkdirSync("e2e",{recursive:true});fs.writeFileSync("e2e/tamper.spec.js","test.skip('easy green', () => {});\n");}
else if(mode==="banned-source") fs.writeFileSync("src/state.txt","const value = thing as any;\n");
else if(mode==="sleep") await new Promise(r=>setTimeout(r,10000));
else if(mode==="noop") process.exit(0);
else {process.stderr.write(`unknown fake fixer mode ${mode}\n`);process.exit(2);}
commit(`fake-fixer:${mode}:${attempt}`);
