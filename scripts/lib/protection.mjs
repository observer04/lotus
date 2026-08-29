import fs from "node:fs";
import path from "node:path";
import { changedPathsBetween, rawDiffBetween, statusEntries, git } from "./git-state.mjs";

function globMatch(pattern, p) {
  const norm=p.split(path.sep).join("/");
  if (pattern.endsWith("/**")) {
    const prefix=pattern.slice(0,-3);
    return norm===prefix || norm.startsWith(`${prefix}/`);
  }
  return norm===pattern;
}

export function pathIsWritable(p, globs=["src/**"]) {
  return globs.some(g=>globMatch(g,p));
}

function modeViolations(rawParts, writableGlobs) {
  const violations=[];
  for (let i=0;i<rawParts.length;i++) {
    const meta=rawParts[i];
    if(!meta.startsWith(":")) continue;
    const m=meta.match(/^:(\d{6})\s+(\d{6})\s+[0-9a-f]+\s+[0-9a-f]+\s+([A-Z]\d*)$/);
    const p=rawParts[i+1] ?? "";
    if(!m) continue;
    const oldMode=m[1], newMode=m[2];
    if(newMode==="120000" || oldMode==="120000") violations.push({type:"symlink",path:p});
    if(newMode==="160000" || oldMode==="160000") violations.push({type:"submodule",path:p});
    // Permission/type changes are not accepted even under writable source roots.
    // A normal content edit keeps mode 100644/100755 unchanged.
    if(oldMode!==newMode && oldMode!=="000000" && newMode!=="000000") {
      violations.push({type:"mode_change",path:p,detail:`${oldMode}->${newMode}`});
    }
    // Add/delete under the writable allowlist is an ordinary source edit; outside
    // it is caught by protected_path above.
    if(!pathIsWritable(p,writableGlobs) && oldMode!==newMode && (oldMode==="000000" || newMode==="000000")) {
      violations.push({type:"protected_mode_change",path:p,detail:`${oldMode}->${newMode}`});
    }
  }
  return violations;
}

export function verifyProtected({before, after, cwd=process.cwd(), writableGlobs=["src/**"]}) {
  const violations=[];
  const commitPaths=changedPathsBetween(before,after,cwd);
  for(const p of commitPaths) if(!pathIsWritable(p,writableGlobs)) violations.push({type:"protected_path",path:p});
  violations.push(...modeViolations(rawDiffBetween(before,after,cwd),writableGlobs));

  const worktree=statusEntries(cwd);
  const worktreePaths=[];
  for(const entry of worktree){
    for(const p of [entry.path,entry.otherPath].filter(Boolean)){
      worktreePaths.push(p);
      if(!pathIsWritable(p,writableGlobs)) violations.push({type:"protected_worktree_path",path:p,detail:entry.xy});
      const abs=path.join(cwd,p);
      try{
        const st=fs.lstatSync(abs);
        if(st.isSymbolicLink()) violations.push({type:"symlink",path:p});
      }catch{}
    }
  }

  const unmerged=git(["diff","--name-only","--diff-filter=U"],{cwd}).stdout.trim();
  if(unmerged) for(const p of unmerged.split(/\r?\n/).filter(Boolean)) violations.push({type:"unmerged",path:p});

  return {
    ok:violations.length===0,
    changedPaths:[...new Set([...commitPaths,...worktreePaths])].sort(),
    violations
  };
}
