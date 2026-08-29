import fs from "node:fs";
const mode=process.argv[2]??"typecheck";
const stateFile=process.env.HARNESS_STATE_FILE??"src/state.txt";
const state=fs.existsSync(stateFile)?fs.readFileSync(stateFile,"utf8").trim():"FIXED";
if(mode==="lint-pass"){
  process.stdout.write(JSON.stringify({diagnostics:[]}));
  process.exit(0);
}
if(mode==="build-pass"){process.exit(0);}
if(mode==="typecheck"){
  const table={BROKEN:["TS9001","broken source"],A:["TS9101","state A"],B:["TS9102","state B"],C:["TS9103","state C"],X3:["TS9201","same signature"],X2:["TS9201","same signature"],X1:["TS9201","same signature"]};
  if(!table[state]) process.exit(0);
  const [code,msg]=table[state];
  const count=state==="X3"?3:state==="X2"?2:1;
  for(let i=0;i<count;i++) process.stdout.write(`src/state.txt(${i+1},1): error ${code}: ${msg}\n`);
  process.exit(1);
}
process.stderr.write(`unknown gate-driver mode ${mode}\n`);
process.exit(2);
