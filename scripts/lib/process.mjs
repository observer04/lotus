import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";

export function runSync(argv,{cwd=process.cwd(),env={},timeoutMs=120000}={}){
  if(!Array.isArray(argv)||!argv.length) throw new Error("command must be a non-empty argv array");
  const r=spawnSync(argv[0],argv.slice(1),{cwd,env:{...process.env,...env},encoding:"utf8",timeout:timeoutMs,maxBuffer:16*1024*1024});
  return {status:r.status??124,stdout:r.stdout??"",stderr:r.stderr??"",error:r.error??null,signal:r.signal??null};
}

export async function getFreePort(){
  return await new Promise((resolve,reject)=>{ const s=net.createServer(); s.once("error",reject); s.listen(0,"127.0.0.1",()=>{ const a=s.address(); const p=typeof a==="object"&&a?a.port:null; s.close(err=>err?reject(err):resolve(p)); }); });
}

export async function waitForHttp(url,{timeoutMs=30000,intervalMs=250}={}){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    const ok=await new Promise(resolve=>{ const req=http.get(url,res=>{res.resume(); resolve(res.statusCode!==undefined && res.statusCode<500);}); req.on("error",()=>resolve(false)); req.setTimeout(1500,()=>{req.destroy();resolve(false);}); });
    if(ok) return true;
    await new Promise(r=>setTimeout(r,intervalMs));
  }
  return false;
}

export function startProcess(argv,{cwd=process.cwd(),env={}}={}){
  if(!Array.isArray(argv)||!argv.length) throw new Error("command must be a non-empty argv array");
  return spawn(argv[0],argv.slice(1),{cwd,env:{...process.env,...env},detached:true,stdio:["ignore","pipe","pipe"]});
}

export function stopProcessGroup(child){
  if(!child||child.killed) return;
  try{ process.kill(-child.pid,"SIGTERM"); }catch{ try{child.kill("SIGTERM");}catch{} }
}
