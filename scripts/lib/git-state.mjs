import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function git(args, {cwd=process.cwd(), allowFailure=false, input=undefined}={}) {
  const r = spawnSync("git", args, {cwd, encoding:"utf8", input});
  if (!allowFailure && r.status !== 0) throw new Error((r.stderr || r.stdout || `git ${args.join(" ")} failed`).trim());
  return {status:r.status, stdout:r.stdout ?? "", stderr:r.stderr ?? ""};
}

export function head(cwd=process.cwd()) {
  return git(["rev-parse","HEAD"], {cwd}).stdout.trim();
}

export function isClean(cwd=process.cwd()) {
  return git(["status","--porcelain=v1","--untracked-files=all"], {cwd}).stdout.trim() === "";
}

export function statusEntries(cwd=process.cwd()) {
  const out = git(["status","--porcelain=v1","-z","--untracked-files=all"], {cwd}).stdout;
  const parts = out.split("\0");
  const entries = [];
  for (let i=0; i<parts.length; i++) {
    const raw = parts[i];
    if (!raw) continue;
    const xy = raw.slice(0,2);
    const firstPath = raw.slice(3);
    if ((xy[0] === "R" || xy[0] === "C" || xy[1] === "R" || xy[1] === "C") && parts[i+1]) {
      const secondPath = parts[++i];
      // Git's porcelain -z form uses two path fields for a rename/copy. Keep both
      // so a protected destination or origin cannot disappear from verification.
      entries.push({xy, path:firstPath, otherPath:secondPath});
    } else {
      entries.push({xy, path:firstPath});
    }
  }
  return entries;
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function snapshotGitState(cwd=process.cwd()) {
  const currentHead = head(cwd);
  const entries = statusEntries(cwd);
  const inventory = [];
  for (const entry of entries) {
    for (const p of [entry.path, entry.otherPath].filter(Boolean)) {
      const abs = path.join(cwd,p);
      let hash=null, kind="missing";
      try {
        const stat=fs.lstatSync(abs);
        kind=stat.isSymbolicLink()?"symlink":stat.isDirectory()?"directory":stat.isFile()?"file":"other";
        if(stat.isFile()) hash=fileHash(abs);
      } catch {}
      inventory.push({xy:entry.xy,path:p,kind,hash});
    }
  }
  inventory.sort((a,b)=>a.path.localeCompare(b.path));
  return {head:currentHead, clean:entries.length===0, inventory};
}

export function changedPathsBetween(before, after, cwd=process.cwd()) {
  if (before === after) return [];
  return git(["diff","--name-only","-z","--no-renames",`${before}..${after}`], {cwd}).stdout.split("\0").filter(Boolean).sort();
}

export function rawDiffBetween(before, after, cwd=process.cwd()) {
  if (before === after) return [];
  return git(["diff","--raw","-z","--no-renames",`${before}..${after}`], {cwd}).stdout.split("\0").filter(Boolean);
}

export function ensureGitRepo(cwd=process.cwd()) {
  git(["rev-parse","--is-inside-work-tree"], {cwd});
}

export function updateRef(ref, sha, cwd=process.cwd()) {
  git(["update-ref",ref,sha], {cwd});
}

export function readRef(ref, cwd=process.cwd()) {
  const r=git(["rev-parse","--verify",ref],{cwd,allowFailure:true});
  return r.status===0?r.stdout.trim():null;
}

export function repositoryPreconditions(cwd=process.cwd()) {
  const issues=[];
  const gitDir = git(["rev-parse","--git-dir"],{cwd}).stdout.trim();
  const resolveGitPath = (p) => path.isAbsolute(p) ? p : path.resolve(cwd,p);
  const indexLock = resolveGitPath(git(["rev-parse","--git-path","index.lock"],{cwd}).stdout.trim());
  if (fs.existsSync(indexLock)) issues.push({type:"git_lock",path:indexLock});

  const controlRefs = [
    ["MERGE_HEAD","merge_in_progress"],
    ["CHERRY_PICK_HEAD","cherry_pick_in_progress"],
    ["REVERT_HEAD","revert_in_progress"]
  ];
  for (const [name,type] of controlRefs) {
    const p=resolveGitPath(git(["rev-parse","--git-path",name],{cwd}).stdout.trim());
    if(fs.existsSync(p)) issues.push({type,path:p});
  }
  for (const name of ["rebase-merge","rebase-apply"]) {
    const p=resolveGitPath(git(["rev-parse","--git-path",name],{cwd}).stdout.trim());
    if(fs.existsSync(p)) issues.push({type:"rebase_in_progress",path:p});
  }

  const unmerged=git(["diff","--name-only","--diff-filter=U"],{cwd}).stdout.trim();
  if(unmerged) issues.push({type:"unmerged",paths:unmerged.split(/\r?\n/).filter(Boolean)});

  const stages=git(["ls-files","--stage"],{cwd}).stdout.split(/\r?\n/).filter(Boolean);
  for(const line of stages){
    const m=line.match(/^(\d{6})\s+[0-9a-f]+\s+\d+\t(.+)$/);
    if(m?.[1]==="160000") issues.push({type:"submodule",path:m[2]});
  }

  return {ok:issues.length===0,gitDir,issues};
}
