import fs from "node:fs";
import path from "node:path";

export function detectCapabilities(root) {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) throw new Error("unsupported: package.json is required at export root");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.packageManager && !String(pkg.packageManager).startsWith("npm@")) throw new Error(`unsupported package manager declared by package.json: ${pkg.packageManager}`);
  if (pkg.workspaces) throw new Error("unsupported: npm workspaces/monorepos are outside MVP scope");
  const siblingLocks = ["pnpm-lock.yaml","yarn.lock","bun.lockb","bun.lock"].filter(f => fs.existsSync(path.join(root,f)));
  if (siblingLocks.length) throw new Error(`unsupported package manager: found ${siblingLocks.join(", ")}`);
  const scripts = pkg.scripts ?? {};
  if (!scripts.build) throw new Error("unsupported: package.json scripts.build is required");
  if (!scripts.dev && !scripts.start) throw new Error("unsupported: scripts.dev or scripts.start is required for Playwright");
  const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})};
  const unsupported = Object.keys(deps).filter(name => name === "@supabase/supabase-js" || name.startsWith("@supabase/"));
  if (unsupported.length) throw new Error(`unsupported backend dependency for MVP: ${unsupported.join(", ")}`);
  const hasTsconfig = fs.existsSync(path.join(root, "tsconfig.json"));
  const typecheck = scripts.typecheck ? ["npm","run","typecheck"] : hasTsconfig ? ["npx","--no-install","tsc","--noEmit"] : [process.execPath,"-e","process.exit(0)"];
  return {
    packageManager:"npm",
    framework: deps.vite ? "vite" : deps["@tanstack/react-start"] ? "tanstack-start" : "node-frontend",
    commands: {
      build:["npm","run","build"],
      dev:["npm","run", scripts.dev ? "dev" : "start"],
      typecheck,
      lint:["npx","--no-install","biome","ci","src","e2e","--reporter=json"]
    },
    hasTsconfig,
    packageJson:pkg
  };
}
