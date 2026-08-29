# Lotus MVP handoff — 2026-08-29

## Objective and scope

Finish the SOW MVP by proving two genuine Lovable exports import idempotently, then run the coffee specimen through R1–R8 and the required Dyad 1.12 Mode B acceptance cases. The owner explicitly asked for the shortest route to MVP: do not add framework, security, UI, or documentation work unless a live run exposes a blocking defect.

## Workspace state

- Repository: `/home/op/projects/lotus`, branch `main`.
- The working tree is intentionally dirty with the prior GPT implementation and Claude-review fixes. Do not reset, discard, or overwrite them.
- `.claude/` and `REVIEW-design-adversarial.md` are user/Claude artifacts. Preserve them unchanged.
- Do not push to or rewrite either Lovable repository. Their `AGENTS.md` files prohibit rewriting published history because it syncs back to Lovable.
- Last full pinned-runtime check before the latest importer edit: Node 22.16.0, 62/62 tests passed, banned scan passed, `git diff --check` passed.
- After the latest importer edit, the focused regression test passed; the full 62-test suite still needs one rerun.

## Genuine Lovable exports

| Project | Upstream commit tested | Role |
|---|---|---|
| `https://github.com/observer04/cozy-coffee-cart` | `6d5486b09ec25de313f41957e9b8b3e7d936a0d9` | Coffee R1–R8 acceptance specimen |
| `https://github.com/observer04/daily-wins-tracker` | `ea7f6b3f229d06e9cf59c1c2c4fb612f47e59d07` | Second distinct importer-compatibility export |

Disposable live paths still present:

- source clones: `/tmp/lotus-live.EUREXi`
- imported coffee harness: `/tmp/lotus-cozy-harness.1ojIo7`
- imported habit harness: `/tmp/lotus-daily-harness.MkpF56`
- npm validation copies: `/tmp/cozy-npm.H0ZmTS` and `/tmp/daily-npm.j7ywUv`

These are disposable evidence workspaces, not deliverables. Recreate isolated harness copies from the root working tree after changing importer/gate code.

## Completed live evidence

Both current Lovable exports include `bun.lock` and `bunfig.toml`, but neither `package.json` declares Bun; both use ordinary `vite` scripts. Excluding those incidental files, both projects passed on Node 22.16.0:

```text
npm install --package-lock-only --ignore-scripts
npm ci
npm run build
```

The root importer now removes `bun.lock`, `bun.lockb`, and `bunfig.toml` from its staging area only when `packageManager` is absent or explicitly npm. An explicit non-npm `packageManager` remains rejected. The regression is in `tests/integration/importer.test.mjs` and passes.

Real importer results, using the same script without per-project edits:

| Project | First import | Second import | Normalized commit / `baseline-v1` |
|---|---:|---:|---|
| coffee | 111.34 s | 2.22 s, no-op | `a5d4377dd8a9b3a74fea695bd36504790bc6d8b9` |
| habits | 112.66 s | 2.28 s, no-op | `ba737782c80439d397d0237af9df02f249f4f764` |

For both imports:

- `HEAD` equals `baseline-v1`;
- `git status --porcelain` is empty;
- `package-lock.json` exists;
- Bun lock/config artifacts are absent from the normalized tree;
- source typecheck and production build passed;
- `import-report.md` contains all six required sections.

## Reference-machine Playwright fact

The host is Ubuntu 26.04. Playwright 1.58.2 refuses browser installation on that host by default:

```text
ERROR: Playwright does not support chromium on ubuntu26.04-x64
```

This explicit compatibility override succeeds:

```bash
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64
```

It installed Playwright's pinned Chrome for Testing 145.0.7632.6, Chromium revision 1208, plus the matching headless shell. Both successful real imports used the override. Decide narrowly whether to detect/document this in the importer; do not silently claim Ubuntu 26.04 is officially supported.

## Current blocker exposed by real Tier 0

Both genuine exports produce the same valid, schema-normalized Tier 0 failure in about 0.2 seconds:

```text
gate: standards
file: src/routeTree.gen.ts:18
rule: AS_ANY
```

This is TanStack Router-generated code. The file itself says it is generated, must not be edited, and should be excluded from linters/formatters. Current TanStack documentation likewise recommends excluding `routeTree.gen.ts` and documents the `generatedRouteTree` configuration. Do not send this failure to Dyad: the generator will overwrite a source edit.

A direct Biome 1.9.4 run on the coffee export then reports 127 errors, mostly formatting/import organization in Lovable UI boilerplate, plus a CSS parse error for Tailwind 4 syntax (`@import "tailwindcss" source(none)`). This indicates a normalization/tool-version compatibility issue, not 127 product defects.

The two decisions still required are therefore narrow and evidence-driven:

1. Handle the exact TanStack generated route tree as generated and protected, rather than writable application code. Add regression coverage so a fixer cannot use the exclusion to hide edits.
2. Make the pinned Biome configuration compatible with the current Lovable/Tailwind 4 export, and make deterministic formatting/import normalization an importer responsibility before `baseline-v1`. Do not spend Dyad attempts on mechanical baseline formatting.

## Shortest next sequence

1. Add the smallest red tests for generated-route protection/exclusion and current Lovable CSS parsing/normalization.
2. Implement only those two fixes, rerun the full Node 22 suite once, and recreate the isolated coffee import.
3. Confirm Tier 0 reaches typecheck/build rather than failing generated code or baseline formatting.
4. Copy the retained R1–R8 files from `tests/fixtures/acceptance-spec/` into the imported coffee repository's `e2e/`, commit them, and run real Chromium Tier 1.
5. If R1–R8 are green, establish `harness-green-v1` immediately. If an actual product behavior is red, that is the first legitimate Dyad Build-mode prompt.
6. Run only the SOW-required defect matrix and capture `cycles.jsonl`, timings, versions, and rollback evidence.
7. Update `FINDINGS.md`/`tasklist.md` with the live evidence above and finish. Do not revisit already dispositioned Claude suggestions unless a live test contradicts them.

## Dyad/operator boundary

Dyad 1.12.0 Stable Build mode is already validated. The owner-selected final profile is OpenAI `gpt-5.6-luna` with high reasoning. The harness itself does not call an AI API. When a real product failure packet exists, the only operator action should be pasting `.harness/active-prompt.md` into Dyad and approving the proposal.

No API key or additional Lovable action is currently needed from the owner.
