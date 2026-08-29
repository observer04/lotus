import { snapshotGitState } from "./git-state.mjs";

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function stateToken(state){
  return JSON.stringify(state);
}

export async function waitForInteractiveChange({
  cwd=process.cwd(),
  beforeSnapshot=snapshotGitState(cwd),
  timeoutMs=10*60*1000,
  pollMs=2000,
  commitStablePolls=5,
  dirtyStablePolls=15
}={}){
  const deadline=Date.now()+timeoutMs;
  let lastToken=null;
  let stableCount=0;
  while(Date.now()<deadline){
    await sleep(pollMs);
    const afterSnapshot=snapshotGitState(cwd);
    const changed=afterSnapshot.head!==beforeSnapshot.head || afterSnapshot.inventory.length>0;
    if(!changed){
      lastToken=null;
      stableCount=0;
      continue;
    }
    const token=stateToken(afterSnapshot);
    if(token===lastToken) stableCount++;
    else {
      lastToken=token;
      stableCount=1;
    }
    const required=afterSnapshot.clean?commitStablePolls:dirtyStablePolls;
    if(stableCount>=required) return {ok:true,beforeSnapshot,afterSnapshot};
  }
  return {ok:false,reason:"invocation_timeout",beforeSnapshot,afterSnapshot:snapshotGitState(cwd)};
}
