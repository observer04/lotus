# Lotus MVP Completion Task List

This file tracks the remaining work between the current implemented harness and a fully evidenced MVP submission against `design.md` and the SOW.

## Current state

- [x] Core harness implementation is on `main`.
- [x] Component A importer is implemented.
- [x] Tier 0 / Tier 1 gate machinery is implemented.
- [x] Structured `gate-report.json` generation is implemented.
- [x] Stable diagnostic identities and failure signatures are implemented.
- [x] Prompt packet construction, redaction, source-context bounds, and truncation are implemented.
- [x] Default-deny Git protection and banned-pattern scanning are implemented.
- [x] Mode B cycle runner, retry budgets, oscillation detection, no-progress detection, invocation timeout, and additive rollback are implemented.
- [x] Deterministic fake-fixer acceptance paths are implemented.
- [x] Appendix A R1–R8 Playwright specification is present.
- [x] Two distinct importer fixtures are present.
- [x] Deterministic automated suite passed in the implementation sandbox: 44/44 tests.
- [x] README and initial FINDINGS are present.

## Remaining before calling the MVP fully complete

### 1. Validate on the reference/local machine

- [ ] Sync `~/projects/lotus` to the current `main` commit.
- [ ] Use Node 22.16.0 and run `npm ci`.
- [ ] Run `npm test` on the reference machine and confirm the deterministic suite remains green there.
- [ ] Install/verify Chromium for Playwright on that machine.
- [ ] Run a real Tier 0 gate and record its duration.
- [ ] Run a real Tier 1 gate and record its duration.
- [ ] Confirm a generated `gate-report.json` validates and accurately reflects the real run.

### 2. Exercise the actual Lovable import path

- [ ] Import the supplied real test/Lovable project with `scripts/import-lovable.sh`.
- [ ] Confirm `import-report.md` contains all six required checks with real evidence.
- [ ] Re-run the same import and prove it produces no diff.
- [ ] Confirm `baseline-v1` exists at the normalized import commit and is not moved by the second import.
- [ ] Run the importer against a second distinct supported export without changing the importer.
- [ ] Perform a clean-clone rehearsal and prove `npm ci && npm run build` succeeds.

### 3. Establish the real R1–R8 green baseline

- [ ] Commit the Appendix A R1–R8 tests while the specimen is still red.
- [ ] Run `scripts/cycle.sh 1 --bootstrap` against the real specimen.
- [ ] Use Dyad 1.12.0 Stable in Build mode for the repair step.
- [ ] Confirm bootstrap reaches Tier 1 green.
- [ ] Confirm immutable `harness-green-v1` exists.
- [ ] Confirm `refs/harness/last-green` points at the verified green code commit.
- [ ] Run all R1–R8 Playwright tests in a real Chromium session and confirm they pass.

### 4. Real Dyad Mode B integration evidence

- [ ] Verify Dyad is editing the exact same working tree watched by Lotus.
- [ ] Run one bounded live source repair through Dyad 1.12 Build mode.
- [ ] Confirm Lotus detects the resulting Git state only after it becomes stable.
- [ ] Confirm the complete before/after SHA range is verified, including Dyad-created commits.
- [ ] Confirm no manual step is required beyond pasting the generated packet and approving/rejecting the Dyad proposal.
- [ ] Record Dyad version, provider, model, reasoning effort, attempt count, and changed files in the resulting cycle record.

### 5. Run the full SOW live acceptance matrix

Fixable defects:

- [ ] Type error: `Item | undefined` passed as `Item` reaches green within budget.
- [ ] Lint defect: unused import plus incomplete hook dependencies reaches green within budget.
- [ ] Runtime defect: cart removal by array index rather than ID reaches green with only `src/**` changed.
- [ ] Spec defect: `$4.5` rather than `$4.50` reaches green with correct integer-cent formatting.

Escalation/safety cases:

- [ ] Unsatisfiable contradictory requirements escalate at the configured threshold.
- [ ] Tamper bait is caught structurally if the fixer attempts to skip/weaken a test or touch protected content.
- [ ] A controlled A → B → A case triggers oscillation detection on the first recurrence.
- [ ] Every escalation produces an additive rollback whose code tree equals the prior verified green tree.
- [ ] Every escalation leaves the repository clean while preserving failed/red commits in history.

### 6. Audit evidence and documentation

- [ ] Populate `cycles.jsonl` with exactly one accurate record for every final acceptance cycle.
- [ ] Validate every cycle record against `schemas/cycle-record.schema.json`.
- [ ] Validate the real `harness.json` and `gate-report.json` against their schemas.
- [ ] Confirm no API key, `.env` value, authorization header, or other secret appears in committed files or captured evidence.
- [ ] Update `FINDINGS.md` with real live-run attempt counts, timings, Dyad/model metadata, successful defect classes, failed/escalated classes, and any flaky behavior observed.
- [ ] Record Tier 0 and Tier 1 performance on the reference machine.
- [ ] Re-read README from a fresh operator perspective and perform the documented import → gate → bootstrap → inject → cycle workflow exactly as written.

### 7. Final submission checkpoint

- [ ] `git status` is clean.
- [ ] Deterministic suite is green on the reference machine.
- [ ] Real Chromium R1–R8 suite is green.
- [ ] All four fixable live defects reach green within budget.
- [ ] Unsatisfiable, tamper, and oscillation scenarios escalate for the expected reason.
- [ ] `baseline-v1`, red spec-test history, `harness-green-v1`, and `refs/harness/last-green` are present and correct.
- [ ] Final README/FINDINGS/cycle evidence is committed and pushed to `main`.

## Not required for MVP

Do not spend time on these until everything above is complete:

- Headless Dyad integration unless Dyad publishes a supported interface.
- Dashboard/UI.
- CI-provider integration.
- pnpm/Yarn/monorepo support.
- Multi-project provisioning.
- Deployment, Supabase, auth, database, payments, or infrastructure.
- Additional provider abstraction beyond what is needed to record the selected Dyad profile.
