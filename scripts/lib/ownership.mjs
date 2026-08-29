import fs from "node:fs";
import path from "node:path";

function escapeRegExpChar(c) {
  return /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
}

// Unix shell glob to RegExp: ** spans directories (including zero), * stays
// within one segment, ? matches one non-slash char. Everything else is a
// literal, escaped for regex safety.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
      continue;
    }
    if (c === "*") { re += "[^/]*"; continue; }
    if (c === "?") { re += "[^/]"; continue; }
    re += escapeRegExpChar(c);
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(relPath, globs) {
  const norm = String(relPath).split(path.sep).join("/");
  return globs.some(g => globToRegExp(g).test(norm));
}

// Policy globs (config/unowned-paths.json) union harness.json's optional
// project-specific unownedGlobs. Both are best-effort: a missing policy file
// or harness.json yields an empty contribution rather than throwing.
export function loadUnownedGlobs({cwd=process.cwd(), policyPath=path.join(cwd,"config","unowned-paths.json"), harnessPath=path.join(cwd,"harness.json")}={}) {
  let policyGlobs = [];
  try {
    const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    if (policy.schemaVersion !== 1 || !Array.isArray(policy.globs)) throw new Error("invalid unowned-paths policy");
    policyGlobs = policy.globs.map(g => g.glob);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  let harnessGlobs = [];
  try {
    const harness = JSON.parse(fs.readFileSync(harnessPath, "utf8"));
    if (Array.isArray(harness.unownedGlobs)) harnessGlobs = harness.unownedGlobs;
  } catch { /* harness.json absent or unreadable: no project-specific globs */ }
  return [...new Set([...policyGlobs, ...harnessGlobs])];
}
