import fs from "node:fs";
import path from "node:path";

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; } // exists, just not ours to signal
}

// A concurrent cycle.sh run against the same repository races the additive
// rollback: one run's commit looks, to the other, exactly like an unverified
// change to discard. This lock serializes cycles per-repository. A lock whose
// pid is no longer running is stale and is reclaimed rather than honored.
export function acquireLock({cwd=process.cwd(), lockPath=path.join(cwd,".harness","cycle.lock"), pid=process.pid}={}) {
  fs.mkdirSync(path.dirname(lockPath), {recursive:true});
  if (fs.existsSync(lockPath)) {
    let existing = null;
    try { existing = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch { /* corrupt lock: treat as stale */ }
    if (existing && isPidRunning(existing.pid)) return {ok:false, existing};
  }
  fs.writeFileSync(lockPath, JSON.stringify({pid, startedAt:new Date().toISOString()}, null, 2)+"\n");
  return {ok:true};
}

export function releaseLock({cwd=process.cwd(), lockPath=path.join(cwd,".harness","cycle.lock")}={}) {
  try { fs.rmSync(lockPath, {force:true}); } catch { /* already gone */ }
}
