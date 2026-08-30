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
- [x] Deterministic automated suite is green: 97/97 (`npm test`), up from 62/62 at MVP start; every number above 62 is a regression test for a defect found by running against a genuine export or a live Dyad cycle, not a new feature test.
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
- [x] Real Chromium R1–R8 fully green, after Dyad repaired R5 in the watched tree (`c15267f`). Tier 1 total 38.6 s (standards 0.0 / lint 0.1 / typecheck 4.6 / build 2.3 / e2e 31.3).

## Live Dyad Mode B evidence

- [x] The real interactive watcher correctly waited on, and correctly evaluated, two live Dyad sessions against the coffee specimen. Recorded in `~/projects/lotus-live/coffee/cycles.jsonl`:
  - `20260829T171908846Z-6214bb9` → `invocation_timeout` (Dyad had imported the project in **copy** mode, so its edits landed in `~/dyad-apps/coffee`, not the watched tree; the harness waited correctly on a tree that genuinely never changed — this was an operator setup error, not a harness defect, and is now documented in the README/FINDINGS as the single most likely way to lose an hour).
  - `20260830T142422432Z-3ef6186` → `escalated_safety` (16 `protected_worktree_path` violations, all `.output/**` — a real harness bug: generator build output wasn't excluded from the import, so a routine rebuild dirtied tracked paths outside `src/**` and default-deny correctly, but wrongly, escalated on them. Fixed permanently, IMP-019, with a regression test).
- [x] **Green live cycle achieved.** After the operator re-imported the specimen into Dyad *in place* (copying disabled), Dyad repaired R5 directly in the watched tree and committed it as `c15267f`. The harness detected the state change, verified it default-deny, re-gated, and recorded `green`. `refs/harness/last-green` points at that Dyad-authored commit, and `harness-green-v1` was created. This is the single-tree Mode B contract demonstrated rather than asserted.
- [x] Both live records demonstrate the loop running unattended end to end apart from the GUI paste/approve step: packet built, GUI waited on, write detected, default-deny verification run, escalation/timeout correctly classified, additive rollback performed, a schema-valid `cycles.jsonl` record written, tree left clean. Independently confirmed: `cycles.jsonl` has exactly one record per attempt, both validate against `schemas/cycle-record.schema.json`, and `git diff --quiet` against the rollback target holds for both.
- [x] A successful live repair reaching green: the R5 `Tax (8%)` → `Tax` defect, which is SOW-normative (Appendix A, "Strings (exact): ... Subtotal, Tax, Total ...").
- [x] Tamper-bait and unsatisfiable scenarios exercised as deliberate adapter demonstrations (rows 8 and 9 of the matrix). Adapter-driven by necessity, not convenience: a tamper payload must arrive mid-cycle to appear in an attempt delta at all, and a competent model cannot be made to tamper or oscillate on demand.

## Acceptance matrix — run and recorded

Nine cycles on the coffee specimen, every record schema-valid, retained at `evidence/coffee/cycles.jsonl`.
Driver is independently verifiable per row via `dyad.metadataSource` (`operator-declared` vs `test-adapter`).

- [x] Live: `invocation_timeout`, `escalated_safety`, `green` (3 real Dyad Mode B cycles).
- [x] `type-error` → `green` in **2 attempts** — the multi-turn record, with populated `PRIOR ATTEMPTS` history and progress advancing from `typecheck` to `complete`.
- [x] `lint-defect` → `green` in 1 attempt.
- [x] `currency` (`$4.5` → `$4.50`) → `green` in 1 attempt.
- [x] `tamper-bait` → `escalated_safety` in 1 attempt, before any re-gate.
- [x] `unsatisfiable` → `escalated_no_progress` in 2 attempts.
- [x] Every escalation left a clean repository; `git diff --quiet refs/harness/last-green HEAD -- . ':!cycles.jsonl'` passes, with red commits preserved in ancestry.
- [x] Evidence staged into `evidence/{coffee,habits}/` via `scripts/evidence.sh`, schema-validated and secret-scanned.

### Negative result, reported as one

- [ ] `index-removal` → **not detected**. Injected, and Tier 1 passed in 0 attempts: R4 decrements a
  single-line cart, where removal by index and removal by identity are indistinguishable. The defect was
  reverted rather than left in the verified-green tree. Closing this needs an R4 that decrements the
  second of two distinct lines. Recorded in FINDINGS as the clearest demonstration that the harness is
  exactly as strong as the specification it runs.
- [ ] A → B → A oscillation has deterministic unit/acceptance coverage but no matrix row; the no-progress
  rule fired first in the unsatisfiable case, which is the documented dominance order.
- [ ] R5 money rules are only exercised at Small (+$0.00), so the SOW's size-modifier rule
  (`base + size modifier`) is unasserted and the specimen does not implement it. First follow-up item.

### 3. Audit evidence and documentation

- [x] `scripts/evidence.sh` now exists: copies an imported project's `cycles.jsonl`/`gate-report.json`/`import-report.md`/`harness.json` into `evidence/<project>/`, schema-validates every `cycles.jsonl` line, and secret-scans everything it copies before writing, refusing on any failure.
- [x] Ran `scripts/evidence.sh` against coffee and habits; results committed under `evidence/`.
- [x] Final secret audit run over all tracked content with the versioned high-confidence detector: no findings.
- [x] `FINDINGS.md` updated with real live-run attempt counts, timings, the two live cycle outcomes, the `.output` root-cause writeup, the Dyad copy-mode behavioral note, the R5/hydration adjudication, the known spec-depth gap (line-total size modifier), and the "what unattended operation still needs" assessment the design's DoD requires.
- [x] Tier 0 and Tier 1 performance recorded on the reference machine (this machine; there is no separate reference machine in this environment).
- [x] README re-read and corrected as a fresh operator on 2026-08-30, including the Dyad in-place-import prerequisite, the unowned-path policy, lockfile reconciliation, `.output` exclusion, the cycle lock, `evidence.sh`, and the R1–R8 spec install step.

### 4. Final submission checkpoint

- [x] `git status` is clean (harness repo; `~/projects/lotus-live/coffee` has its own independent clean state, not this repo's concern).
- [x] Deterministic suite is green on the reference machine (97/97).
- [x] Real Chromium R1–R8 suite is fully green, after Dyad's live repair of R5 in the watched tree.
- [x] Three of the four fixable defect classes reach green within budget (`type-error` in 2 attempts, `lint-defect` in 1, `currency` in 1), plus the live R5 repair. The fourth, `index-removal`, was injected but is **not detected** by R1–R8 — reported as a negative result above rather than quietly dropped.
- [x] Unsatisfiable and tamper scenarios escalate for the expected reason as their own deliberate demonstrations (`escalated_no_progress`, `escalated_safety`). Oscillation retains deterministic-only coverage; no-progress dominates it for identical failure sets, which is the documented order.
- [x] `baseline-v1`, red spec-test history, `harness-green-v1`, and `refs/harness/last-green` are all present and correct; last-green points at Dyad's own commit `c15267f`.
- [x] Final README/FINDINGS/cycle evidence committed and pushed to `main`.

## Not required for MVP

Do not spend time on these until everything above is complete:

- Headless Dyad integration unless Dyad publishes a supported interface.
- Dashboard/UI.
- CI-provider integration.
- pnpm/Yarn/monorepo support.
- Multi-project provisioning.
- Deployment, Supabase, auth, database, payments, or infrastructure.
- Additional provider abstraction beyond what is needed to record the selected Dyad profile.
