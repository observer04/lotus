# Lotus MVP Completion Task List

This file tracks the remaining work between the current implemented harness and a fully evidenced MVP submission against `design.md` and the SOW. Rewritten 2026-08-30 to match what has actually been demonstrated; nothing here is ticked without a specific run, commit, or log line backing it.

## Current state (implementation, deterministic-tested)

- [x] Core harness implementation is on `main`.
- [x] Component A importer is implemented, including npm lockfile reconciliation (`scripts/lib/lockfile.mjs`) and the unowned-path ownership boundary (`config/unowned-paths.json`, `scripts/lib/ownership.mjs`).
- [x] Tier 0 / Tier 1 gate machinery is implemented, including the real Biome 1.9.4 diagnostic shape (`parseBiome` flattens the message array and converts byte-offset spans correctly).
- [x] Structured `gate-report.json` generation is implemented.
- [x] Stable diagnostic identities and failure signatures are implemented.
- [x] Prompt packet construction, redaction, source-context bounds, unowned-path exclusion, and truncation are implemented (`build-prompt.sh` and `cycle.sh` both wired identically).
- [x] Default-deny Git protection and banned-pattern scanning are implemented, including generator build-output exclusion (`.output/`, IMP-019).
- [x] Mode B cycle runner, stage-aware retry budgets, oscillation detection, invocation timeout, additive rollback, and a same-repository concurrency lock (CYC-019, `.harness/cycle.lock`) are implemented.
- [x] The real Mode B watcher is acceptance-tested for stable commits and stable uncommitted changes.
- [x] Deterministic fake-fixer acceptance paths are implemented.
- [x] Appendix A R1–R8 Playwright specification is present and hydration-safe (`waitForHydration`, needed because the real specimen is server-rendered).
- [x] Two Lovable-style fixtures plus a non-Vite compatibility fixture are present; these do not replace genuine-export evidence, which now also exists (see below).
- [x] Versioned source-secret refusal is implemented and tested without value disclosure.
- [x] Deterministic automated suite is green: 93/93 (`npm test`), up from 62/62 at MVP start; every number above 62 is a regression test for a defect found by running against a genuine export or a live Dyad cycle, not a new feature test.
- [x] Claude's adversarial review was dispositioned; accepted correctness and documentation findings are implemented.
- [x] README and FINDINGS are present and were re-walked as a fresh operator on 2026-08-30 (this pass).

## Real (non-synthetic) evidence obtained

- [x] Both genuine exports (`cozy-coffee-cart`, `daily-wins-tracker`) imported with an unmodified importer into a durable workspace (`~/projects/lotus-live/{coffee,habits}`); `import-report.md` contains all six checks with real evidence in both.
- [x] Both re-imports are confirmed true no-ops: exit 0, zero diff, `baseline-v1` unmoved (coffee 3.3 s, habits 1.9 s).
- [x] Clean-clone rehearsal on coffee: `npm ci` (5.0 s) and `npm run build` (2.6 s, Vite + Nitro/cloudflare-module) both pass on Node 22.16.0.
- [x] Real Tier 0 gate run against coffee: `standards` passes (the ownership boundary correctly excludes the generated route tree and vendored `ui/**`, confirmed against the actual export), `lint` fails on 5 genuine application defects (3× `noNonNullAssertion`, 1× `noArrayIndexKey` in `src/routes/index.tsx`, 1× `useButtonType` in `__root.tsx`); ~0.1 s.
- [x] Real Tier 1 gate run against coffee, post hydration fix: 7 of 8 R1–R8 pass; R5 remains genuinely red (specimen renders `Tax (8%)`, SOW Appendix A normatively requires the exact string `Tax`) — adjudicated as a real application defect, left red on purpose, a legitimate Dyad target. Total run ~16 s.
- [x] `gate-report.json` and `harness.json` from the real coffee run both validate against their schemas.
- [x] R1–R8 committed to the coffee specimen while genuinely red, in history before any fix (`e2e/coffee-ordering.spec.ts`, `e2e/fixtures.ts`).
- [ ] Real Chromium R1–R8 fully green. **Not done**: R5 is a real, adjudicated specimen defect (see above), not yet repaired.

## Live Dyad Mode B evidence

- [x] The real interactive watcher correctly waited on, and correctly evaluated, two live Dyad sessions against the coffee specimen. Recorded in `~/projects/lotus-live/coffee/cycles.jsonl`:
  - `20260829T171908846Z-6214bb9` → `invocation_timeout` (Dyad had imported the project in **copy** mode, so its edits landed in `~/dyad-apps/coffee`, not the watched tree; the harness waited correctly on a tree that genuinely never changed — this was an operator setup error, not a harness defect, and is now documented in the README/FINDINGS as the single most likely way to lose an hour).
  - `20260830T142422432Z-3ef6186` → `escalated_safety` (16 `protected_worktree_path` violations, all `.output/**` — a real harness bug: generator build output wasn't excluded from the import, so a routine rebuild dirtied tracked paths outside `src/**` and default-deny correctly, but wrongly, escalated on them. Fixed permanently, IMP-019, with a regression test).
- [ ] **No green live cycle yet.** This is the actual, honest state of the MVP's centerpiece evidence as of this writing. A live session is in progress (copy-mode issue being corrected operator-side) but has not concluded green.
- [x] Both live records demonstrate the loop running unattended end to end apart from the GUI paste/approve step: packet built, GUI waited on, write detected, default-deny verification run, escalation/timeout correctly classified, additive rollback performed, a schema-valid `cycles.jsonl` record written, tree left clean. Independently confirmed: `cycles.jsonl` has exactly one record per attempt, both validate against `schemas/cycle-record.schema.json`, and `git diff --quiet` against the rollback target holds for both.
- [ ] A successful live repair (any of the four fixable SOW defect classes) reaching green. **Not done** — blocked on the copy-mode issue above; the four defect patches are staged and verified (`evidence/defects/`) but none has been injected or run.
- [ ] Tamper-bait and unsatisfiable/oscillation scenarios exercised as their own deliberate live/adapter demonstrations. **Not done directly** — but the *mechanism* tamper-bait would exercise (`protected_worktree_path` → `escalated_safety` → additive rollback → clean tree) is exactly what the real `.output` escalation above already proved live, against a real Dyad-produced change, not a synthetic one.

## Remaining before calling the MVP fully complete

### 1. Establish a real green baseline (the actual remaining blocker)

- [ ] Resolve the Dyad copy-mode operator issue (in progress at time of writing) and confirm Dyad is editing the exact watched tree.
- [ ] Run `scripts/cycle.sh 1 --bootstrap` (or a normal cycle once R5 is separately triaged) against the real specimen and reach Tier 1 green.
- [ ] Confirm immutable `harness-green-v1` and `refs/harness/last-green` are created at that commit.

### 2. Run the staged SOW defect matrix live

All six patches are authored, `git apply --check`-verified against the current specimen, and documented in `evidence/defects/README.md`, but **none has been injected or run**:

- [ ] `type-error.patch`, `lint-defect.patch`, `index-removal.patch`, `currency.patch` each reach green within budget via `scripts/inject-defect.sh` + a live Dyad repair.
- [ ] `unsatisfiable.patch` escalates `escalated_no_progress`.
- [ ] `tamper-bait.patch` escalates `escalated_safety` (mechanism already proven live by the `.output` case; this specific staged patch has not been run).
- [ ] An A → B → A oscillation case escalates on first recurrence (deterministic fake-fixer coverage exists; no live/adapter demonstration yet).

### 3. Audit evidence and documentation

- [x] `scripts/evidence.sh` now exists: copies an imported project's `cycles.jsonl`/`gate-report.json`/`import-report.md`/`harness.json` into `evidence/<project>/`, schema-validates every `cycles.jsonl` line, and secret-scans everything it copies before writing, refusing on any failure.
- [ ] Run `scripts/evidence.sh` against coffee (and habits) once live evidence is final, and commit the result.
- [ ] Confirm no API key, `.env` value, authorization header, or other secret appears in committed files or captured evidence — `scripts/evidence.sh`'s own secret scan covers what it copies; a final manual pass over everything committed still belongs here before submission.
- [x] `FINDINGS.md` updated with real live-run attempt counts, timings, the two live cycle outcomes, the `.output` root-cause writeup, the Dyad copy-mode behavioral note, the R5/hydration adjudication, the known spec-depth gap (line-total size modifier), and the "what unattended operation still needs" assessment the design's DoD requires.
- [x] Tier 0 and Tier 1 performance recorded on the reference machine (this machine; there is no separate reference machine in this environment).
- [x] README re-read and corrected as a fresh operator on 2026-08-30, including the Dyad in-place-import prerequisite, the unowned-path policy, lockfile reconciliation, `.output` exclusion, the cycle lock, `evidence.sh`, and the R1–R8 spec install step.

### 4. Final submission checkpoint

- [x] `git status` is clean (harness repo; `~/projects/lotus-live/coffee` has its own independent clean state, not this repo's concern).
- [x] Deterministic suite is green on the reference machine (93/93).
- [ ] Real Chromium R1–R8 suite is fully green. Not done: R5 is a real, adjudicated, intentionally-unfixed specimen defect.
- [ ] All four fixable live defects reach green within budget. Not done: staged, not run.
- [ ] Unsatisfiable, tamper, and oscillation scenarios escalate for the expected reason, as their own deliberate demonstrations. Partially evidenced: the tamper mechanism fired correctly, live, on the real `.output` case; the other two have deterministic-only coverage.
- [ ] `baseline-v1` and red spec-test history are present and correct (true); `harness-green-v1` and `refs/harness/last-green` do not exist yet (no green cycle yet).
- [ ] Final README/FINDINGS/cycle evidence committed and pushed to `main`. In progress — this pass.

## Not required for MVP

Do not spend time on these until everything above is complete:

- Headless Dyad integration unless Dyad publishes a supported interface.
- Dashboard/UI.
- CI-provider integration.
- pnpm/Yarn/monorepo support.
- Multi-project provisioning.
- Deployment, Supabase, auth, database, payments, or infrastructure.
- Additional provider abstraction beyond what is needed to record the selected Dyad profile.
