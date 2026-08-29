# Adversarial Review — `design.md` (+ the `6e4b5e0`/`e9a3282` implementation)

Reviewer: Claude (Opus 5). Date: 2026-08-29.
Reviewed: `design.md` @ `faab2c1`, `SOW-Lovable-Import-and-Cycle-Harness.pdf`, and the harness code at `origin/main` `e9a3282`.
Method: read both documents end to end, then executed the implementation to test the design-level claims rather than assert them. `npm test` is 44/44 green on Node v24.19.0; every "PROVEN" finding below is backed by a command run in this repo.

**I did not edit `design.md` or any implementation file.** Everything here is a finding.

---

## Verdict

The design is unusually good: default-deny protection, additive rollback, stable failure identity, a real capability spike instead of an assumed API, and an explicit refusal to let a model declare green. The implementation tracks it closely. The problems are not architectural — they are in the **termination semantics**, which is the one subsystem where being subtly wrong is invisible (it produces plausible logs either way) and where the SOW says the entire deliverable's credibility lives.

Five defects are blocking. Two of them cause the harness to **discard correct work** and one causes it to **escalate on prose in a comment**. The rest is fidelity drift, doc/code divergence, and redundancy.

---

## 1. Blocking correctness defects

### R-01 — A verified green is thrown away if the wall clock expired. PROVEN
`design.md` §8.9 orders the checks: `1. safety → 2. wall clock → 3. gate green`. `scripts/lib/termination.mjs:3-4` implements exactly that.

```
$ node -e '...decideTermination({status:"passed", wallClockExceeded:true, ...})'
PROOF 1 — gates GREEN but wall clock exceeded => {"stop":true,"outcome":"escalated_timeout","reason":"wall_clock"}
```

`scripts/cycle.mjs` then calls `rollbackAndRecord("escalated_timeout", ...)` against `rollbackTarget`. So: gates passed, the fix is verified correct, and the harness **reverts it** and logs a failure. The next operator re-runs from the old green and pays for the same fix again.

Root cause is R-13: §8.9 is one ordered list mixing checks that run *before* the gate with checks that run *after* it. The wall clock is a "should I start another attempt?" question; it is being asked as a "was this attempt acceptable?" question.

**Fix:** move `status==="passed"` above `wallClockExceeded` in `decideTermination`. Keep the wall-clock check at the top of the `while` loop in `cycle.mjs` (where it correctly gates *starting* an attempt). Record `timeoutExceeded: true` on the green record if you want the signal. Then split §8.9 into a pre-gate phase and a post-gate phase.

### R-02 — "3 attempts per signature" is really 2. PROVEN
The SOW's headline threshold table says *Attempts on one signature: 3*. For the ordinary stuck case it can never be reached, because no-progress@2 fires first. Same signature ⇒ same failure set ⇒ same count ⇒ two consecutive non-decreases by attempt 2.

```
PROOF 2 — fixer never changes anything; identical signature every time
  exit: 5  outcome: escalated_no_progress  reason: failure_count_not_decreasing  attempts: 2
```

`tests/unit/termination.test.mjs` "CYC-009 signature budget is three" passes only because it hand-feeds `previousFailureCounts:[3,2]`, a state the loop cannot produce for a repeated signature. The acceptance test reaches it only via `gate-driver.mjs`'s `X3/X2/X1` fixture, where one rule fires 3× in one file so the signature is stable while the count falls. That is a real shape (three `useExhaustiveDependencies` in one hook file) — but it is the *narrow* case, not the general one.

This matters for FINDINGS.md, whose stated job is "the numbers set the thresholds for the production harness." Reporting a 3-attempt signature budget when the effective budget is 2 mis-tunes the production harness.

**Fix:** no code change required if it is intentional — but say so. `design.md` §8.9 should state that no-progress dominates the signature budget for identical failure sets, and CYC-009 should be described as a backstop for the multi-diagnostic-single-signature case. Otherwise reorder.

### R-03 — `failureCount` is stage-scoped under fail-fast, so it is not comparable across attempts
GATE-004 requires later stages be recorded `not_run` with `failures: []`. `gate-report.mjs` computes `failureCount` as `stages.flatMap(s => s.failures)`. So the number the no-progress rule compares changes meaning between attempts:

- Fix the last lint error (count 5 → 0 for lint), typecheck now runs and reports 8. Count went 5 → 8. That is **real progress recorded as a non-decrease**, and it burns one of the two no-progress slots for free.
- Worse: `parseBuild` (`scripts/lib/diagnostics.mjs`) returns a single-element array unconditionally — `BUILD_EXIT`, count always exactly 1. A loop failing at the build stage can *never* register a decrease. Two attempts, however genuinely productive, escalate as `no_progress`. Same for the `TSC_EXIT` fallback in `parseTsc`.

Your own `no-progress` fixture makes this visible: it writes `A → B → C`, i.e. one distinct single error per attempt. That is behaviourally identical to a loop legitimately walking a chain of errors, and the harness cannot tell them apart.

`design.md` §8.9 pre-commits to this: *"The failure count rule is intentionally enforced exactly as the SOW states."* That sentence locks in the bug.

**Fix:** compare progress lexicographically on `(index of furthest stage reached, failureCount within that stage)`. Reaching a later stage is progress by definition. Keep the raw count in the record for the SOW's audit. Also give `parseBuild` a real diagnostic parser (§8.1 already promises "structured known diagnostics when available" — R-20).

### R-04 — The banned scanner escalates on English prose. PROVEN
`config/banned-patterns.json` `AS_ANY` is `\bas\s+any\b`, matched line-by-line with no comment or string awareness.

```
$ src/App.tsx: "// we deliberately avoid using as any here"
PROOF 3 — default scan roots: [{"id":"AS_ANY","path":"src/App.tsx","line":1}]
```

A source comment *describing the rule* is an immediate `escalated_safety` with a full rollback. Given `AI_RULES.md` instructs the model about these exact tokens, a model that writes `// not using as any here — fixed the real type instead` gets its correct fix reverted and the cycle killed. The SOW calls the tamper case "the one that matters most"; a scanner with a false-positive path this easy to hit will produce a false tamper record in `cycles.jsonl`, which is exactly the evidence the deliverable rests on.

**Fix:** strip line/block comments and string literals before matching for the source-language patterns, or require `as any` to be preceded by a non-comment token. At minimum, record the matched line in the escalation record so a false positive is diagnosable — `verification.json` currently stores `{id, path, line}` with no excerpt.

### R-05 — The Mode B path is untested and cannot handle the case the design says to handle
`waitInteractive` (`cycle.mjs`) is the actual SOW deliverable — Mode B. It has **zero test coverage**: every acceptance test sets `HARNESS_FIXER_EXEC`, which routes to `invokeFake`; the one test that omits it (`CYC-018 missing last-green ref`) exits at a precondition before reaching the watcher.

Two consequences:

1. `waitInteractive` returns only when `h !== before && clean`. Design §8.6 and CYC-007 explicitly anticipate Dyad leaving *allowed changes uncommitted* and the harness creating a capture commit. That branch (`if(!isClean(ROOT))` after the invocation) is **unreachable in real Mode B** — an uncommitted Dyad edit just runs the clock out to `invocation_timeout`. Only the fake fixer can trigger it.
2. Design §8.6 says the watcher records "HEAD, index tree, tracked worktree hash, and untracked path/hash inventory". `git-state.mjs` exports `snapshotGitState` which does exactly this — and `cycle.mjs` never calls it. It records `head` + a boolean `isClean`. Dead export, unimplemented requirement.

Also undefined: what happens when the operator *rejects* the proposal. HEAD never moves, so it becomes `invocation_timeout` after 10 minutes of waiting. That should be an explicit outcome, not an accident.

**Fix:** make `waitInteractive` accept `head-changed OR worktree-dirty-and-stable` as completion; call `snapshotGitState` for the before/after inventory; add a harness test that drives `waitInteractive` with a background process that commits (and one that only writes files).

---

## 2. SOW fidelity gaps

### R-06 — `scripts/` was silently dropped from the banned scan. PROVEN
SOW §5.1: `grep -rEn "$BANNED" src/ e2e/ scripts/`. `scan.mjs` defaults to `roots=["src","e2e"]`; `gate-report.mjs` calls it with no override.

```
default roots            → [AS_ANY src/App.tsx]
roots incl. scripts      → [OR_TRUE scripts/gate.sh:1, OR_TRUE scripts/gate.sh:2, AS_ANY src/App.tsx]
```

The design justifies this as *"preventing the SOW's self-match problem"* (§8.7). But that problem is solved entirely by moving the patterns into `config/banned-patterns.json` — which you did. Dropping `scripts/` is a second, unrelated narrowing that buys nothing.

The tell: `CONTINUE_ON_ERROR` and `OR_TRUE` are shell/CI idioms. They cannot meaningfully appear in `src/**` TSX. Keeping them in the pattern list while removing the only directory where they occur means **two of the ten declared patterns can never fire**. That is a consistency smell that reads as an unnoticed regression rather than a decision.

Note `design.md` §8.1 also describes standards as scanning "tracked src and e2e files" while `scan.mjs` walks the filesystem — see R-19.

**Fix:** scan `src/`, `e2e/`, `scripts/`. Exclude exactly one path — `config/banned-patterns.json` — plus `scan.mjs` itself if you want belt-and-braces. Record the deviation in FINDINGS.md if you keep it.

### R-07 — "Additive rollback" is a deviation from the SOW's acceptance wording
SOW §5.5 / §6: *"revert to the last green commit"* and *"reverts to the last green commit, leaves a clean tree."* The design does something better (§8.8: new commit whose *tree* equals last-green, nothing erased, consistent with Deliverable 3's "full history, red states intact"). But an auditor checking `git rev-parse HEAD == $(git rev-parse refs/harness/last-green)` fails.

FINDINGS.md already lists "Rollback is additive" under resolved ambiguities — good. This needs to go one step further: restate the acceptance criterion as **tree equality**, in README.md and in the DoD, and give the operator the exact command that demonstrates it (`git diff --quiet refs/harness/last-green HEAD -- . ':!cycles.jsonl'`).

### R-08 — The SOW's Scope Reduction Order is absent from the design
SOW §8 pre-commits an ordered cut list (Playwright JSON → Tier 1 in-loop → spec tests down to R1–R5 → the two simplest defects) and a never-cut list. `design.md` has §15 (post-MVP backlog) but **no cut order at all**.

This is the one omission with schedule risk attached, because the design *expands* scope well past the SOW: two exports, a staging-directory import transaction, three JSON schemas, bootstrap mode, flake confirmation reruns, a provider/model policy section. `tasklist.md` §5 alone is nine live Dyad runs. When that runs long, the decision the SOW deliberately made in advance will get made under pressure anyway.

**Fix:** paste SOW §8 into `design.md` verbatim as a section, and reconcile it — note that "cut Tier 1 inside the loop" now conflicts with DoD items, and decide which wins.

### R-09 — `filesChanged` in the cycle log includes files that were rolled back
`cycle.mjs` adds `protection.changedPaths` and every banned-scan hit into `allChanged` **before** the safety check that escalates. On an `escalated_safety` cycle, the record claims `filesChanged: ["e2e/tamper.spec.js", ...]` for a cycle whose net effect on the tree is zero.

The SOW's `filesChanged` is evidence of what the harness did. Attempted-and-reverted paths are useful, but they need a different key.

**Fix:** `filesChanged` = paths differing between `startCommit` and the final code tree. Put the union of attempted paths in `attemptedPaths`.

---

## 3. Design-document internal inconsistencies

### R-10 — The repository tree omits the application
`design.md` §6 lists `AI_RULES.md`, `README.md`, `FINDINGS.md`, `harness.json`, the reports, `biome.json`, `playwright.config.ts`, `config/`, `schemas/`, `scripts/`, `e2e/`, `tests/`, `.harness/`.

It does not list `src/`, `package.json`, `package-lock.json`, `.nvmrc`, or `index.html` — despite `src/**` being the *only* writable glob in the entire protection model and `package.json`/`.nvmrc` being named in the protected list two sections later. The doc's single clearest artifact contradicts its own security boundary. A reader trying to understand where the specimen lives relative to the harness cannot answer it from §6.

Related and unresolved: `index.html` sits at the Vite project root, outside `src/**`. If an Appendix A fix ever needs it (title, root element, storage bootstrap), Dyad is structurally blocked and the cycle escalates. Worth one sentence saying `src/**`-only was validated against R1–R8 specifically.

### R-11 — Three different statements of what rollback restores
- §4.4 CYC-014: "restores the code tree to the last verified green tree" — unconditional.
- §8.8 bootstrap: "If bootstrap cannot reach green, it restores the initial red cycle-start tree" — a carve-out CYC-014 doesn't mention.
- §8.8 step 5: "Verify the code tree still equals the last green tree, **excluding audit-only log data**" — a second carve-out neither of the others mentions.
- §14 DoD: "Every escalation restores code to the verified green tree" — back to unconditional.

A test written from CYC-014 contradicts §8.8. The exclusion set (`cycles.jsonl`, and anything else?) is never enumerated, and it grows: after cycle N, the last-green tree no longer contains cycle N's log line, so the divergence is permanent and cumulative.

**Fix:** one normative sentence — "escalation restores every path except `cycles.jsonl` to `refs/harness/last-green`, or to the cycle-start tree when no green ref exists" — and make CYC-014, §8.8, and §14 quote it.

### R-12 — The traceability table violates the doc's own completeness rule
§9.1: *"A code change is not complete unless its requirement ID appears in a test name or traceability entry."* §12 omits **GATE-008, GATE-009, GATE-010, CYC-018**. GATE-009/010 (the flake boundary) trace to a real SOW obligation — the §9 Known Risks row on Playwright flakiness — which has no row in §12 at all.

The tests exist (`GATE-009/GATE-010 non-reproducible e2e...`, `CYC-018 ...`), so this is a doc defect, not a coverage gap. But it is the same class of drift as R-11 and R-15, and it is caused by R-30.

### R-13 — §8.9 mixes pre-gate and post-gate checks in one list
Steps 1–2 (safety, wall clock) are evaluated at points where no gate result for this attempt exists; steps 3–7 need one. `decideTermination` takes both in a single call, which is how R-01 happened. Split it.

### R-14 — `failureId` is a class hash, not an identity
`makeFailure` computes `sha256(gate + file + rule)`. Three `useExhaustiveDependencies` errors in one file produce three failure objects with **the same `failureId`**. Your own `gate-driver.mjs` `X3` fixture depends on this collision (three `TS9201` at `src/state.txt` lines 1/2/3).

Nothing is broken today, but the name promises uniqueness and any consumer that keys a map on it silently drops failures. It also means `failureCount` (counts diagnostics) and `failureSignature` (dedups tuples) measure different things — which is a contributing factor to R-03.

**Fix:** rename to `failureClassId`, or keep `failureId` unique by appending an ordinal and add `failureClassId` alongside. Document that `failureCount ≥ |unique classes|`.

### R-15 — PRM-006 drops a SOW constraint that the code implements
SOW §5.4 constraints include *"Do NOT weaken assertions or reduce assertion count."* §4.3 PRM-006 enumerates the constraint block as "protected paths, banned patterns, and the writable allowlist" — the assertion clause is gone. `prompt.mjs` includes it correctly. So the doc is behind the code, and a golden-prompt test written from PRM-006 would lock in the omission.

### R-16 — `CYCLE {n} of {max}` — `max` is never defined
SOW §5.4 mandates the header. `design.md` §8.5 says the packet contains "Cycle number, tier, commit, signature, and attempt budgets" without resolving what `n` and `max` count. The code chose `attempts` and `6`. PRM-002/PRM-007 golden tests will assert on this string, so the doc should state it.

Relatedly, the SOW's cycle-log example has `"cycle": 7` (a monotonic counter); the design replaced it with `cycleId` (timestamp-SHA) and dropped the counter entirely — so the number in the prompt header has no counterpart in the log.

### R-17 — `harness.json`'s required fields are never listed
SOW §4.1 names three (source generator, import date, harness version). IMP-010 says only "harness.json and all required scaffolding are produced deterministically." For a doc that specifies `gate-report.json` and the cycle record field-by-field, this is a conspicuous hole — and `harness.json` is what the gate reads to get its commands.

### R-18 — The idempotency claim is contingent on the npm registry
§7.1 runs the import through a staging directory seeded from the *source*. IMP-013 requires a second run to produce **no diff**. But §7.2 says a missing lockfile triggers `npm install --package-lock-only`, and on the second import the source *still* has no lockfile — so the lockfile is regenerated from the live registry. `resolved` URLs, `integrity` values, and dedupe results are not guaranteed byte-stable across registry state.

**Fix:** on re-import, seed staging with the lockfile already committed in the target and never regenerate it. Make this an IMP requirement, not an implementation detail.

### R-19 — `standards` scans the filesystem, not the index
§8.1 says "Full scan of **tracked** src and e2e files." `scan.mjs` uses `fs.readdirSync` recursively. An untracked or gitignored file under `src/` (editor backup, generated artifact, a `.orig` from a merge) fails the gate and, inside a cycle, triggers `escalated_safety`. Either use `git ls-files`, or change §8.1.

### R-20 — `parseBuild` never produces structured diagnostics
§8.1 promises "Structured known diagnostics when available; otherwise a project-level `BUILD_EXIT` rule." Only the fallback exists. This is the mechanism behind R-03's build-stage case.

---

## 4. Under-specified, unverified, or unstated

### R-21 — Two clocks, one default
`design.md` gives the wall-clock default (20 min, CYC-013) and the poll interval (2 s, CYC-005). It never gives an **invocation timeout** default, despite `invocation_timeout` being its own outcome and its own exit code (CYC-018). The code picked 10 minutes.

More importantly: in Mode B the 20-minute wall clock includes operator latency — opening Dyad, pasting, waiting on the model, reading and approving a proposal. Six attempts of that, plus six Tier-1 gates at the SOW's own "low minutes" target, does not fit in 20 minutes. Combined with R-01, the default causes a live acceptance run to **exceed the ceiling and destroy its own green result**.

**Fix:** state both defaults; exclude invocation-wait time from the wall clock in Mode B (the wall clock should measure harness work, the invocation timeout measures the human/model); raise the Mode B default and say so in README.

### R-22 — The 6-second quiet window is too short for the tool it watches
CYC-005 requires 3 consecutive clean polls at 2 s. §8.6 also says "Multiple Dyad commits are allowed." Those two are in tension: if Dyad writes commit 1, pauses >6 s (streaming, a triggered install, a second file), and writes commit 2, the harness declares completion, verifies, and starts re-gating **while Dyad is still editing**. The result is a corrupted attempt boundary that will look like a spurious safety escalation or a spurious red.

The design has no way to distinguish "finished" from "pausing". The SOW permits Mode B to be "operator in one step" — an explicit operator confirmation after approving the proposal is arguably part of that one step and removes the ambiguity entirely.

**Fix:** either an explicit confirmation (keypress / sentinel file) or a much longer quiet period with the tradeoff recorded in FINDINGS.md.

### R-23 — The flake filter can silently discard every real e2e failure
`runE2E` builds the confirmation rerun as `--grep "^(R1|R5)\b"`. This works today only because the spec file uses top-level `test(...)` calls whose titles start with `R1 — `. It breaks silently if:

- anyone wraps the specs in `test.describe(...)` — a completely ordinary refactor — since grep then matches against the full title path, or
- the Playwright version in use matches grep against a title path that includes the project or file name.

When grep matches nothing, Playwright exits 0, `confirm.status===0` ⇒ `confirmed=[]` ⇒ the stage returns **`inconclusive`**, and `cycle.mjs` records `inconclusive_flaky` and touches nothing. Every genuine e2e failure is reclassified as flake and thrown away, and the log looks clean.

**Fix:** assert the confirmation run actually selected tests. Parse the reporter JSON for the executed test count and treat `0 tests run` as `errored`, never as "did not reproduce". This deserves a test of its own — it is the exact failure the SOW's §9 risk row warns about, inverted.

### R-24 — The confirmation rerun is biased against R8's failure class
§8.4 step 2: *"Start a fresh application process and isolated browser context."* Failures that depend on accumulated state are the least likely to reproduce under fresh state — and R8 (*cart survives reload*, `localStorage` key `coffee-cart-v1`) is precisely that class. The flake filter is structurally most likely to discard the persistence bug the SOW asks you to catch.

Also: `discardedFailureIds` is computed by `gate-report.mjs` but never propagated into the cycle record. §8.4 says mixed results "record discarded IDs"; they land in `gate-report.json`, which is gitignored, so they vanish from the audit trail.

### R-25 — §10 asserts model facts and adds a DoD gate the SOW never asked for
Two separate problems.

**Unverified claims.** §2 and §10.1 assert `gpt-5.6-luna` (with low/medium/high/xhigh/max effort, catalog default high), `Gemini 3.7 Flash`, and link `developers.openai.com/api/docs/models/gpt-5.6-luna` as an authority. I cannot verify any of these from this repo. The SOW's own instruction for the spike is *"This cannot be answered by asking a model. Install Dyad and try it."* — and FINDINGS.md is the designated home for spike evidence. Right now FINDINGS.md carries the conclusions without the artifact.
**Fix:** attach the catalog screenshot or a Dyad settings dump to FINDINGS.md, and cite that rather than an external URL.

**Unrequested scope.** The SOW names no provider and no model anywhere. §10.1 pins an "acceptance profile" and §10.2 states the cheap smoke run *"cannot replace the required gpt-5.6-luna/high acceptance run"*, and §14 makes it a DoD item. That converts a paid OpenAI key into a hard blocker on declaring the MVP done, for a requirement the SOW does not contain. `cycle.mjs` even hardcodes `?? "openai"` / `?? "gpt-5.6-luna"` / `?? "high"` as fallback record values, meaning a run with no env set will *claim* that profile in `cycles.jsonl` without evidence — the opposite of §10.2's "no fallback silently changes the model used for an acceptance claim."

**Fix:** demote §10.1 to "the profile used for our acceptance evidence, recorded per run"; drop the fallback defaults in `appendRecord` so an undeclared run records `null` and `metadataSource: "undeclared"`.

### R-26 — "reference machine" is undefined
§14 DoD: "Tier 0 meets a recorded seconds-scale target and Tier 1 a recorded low-minutes target **on the reference machine**." The term appears in the DoD and in `tasklist.md` and is never defined. As written the criterion cannot be passed or failed.

### R-27 — The gate report's temp file is not gitignored. PROVEN
`gate-report.mjs` writes `.gate-report.<pid>.tmp` at the repo root before renaming. `.gitignore` covers `gate-report.json` but not the temp form:

```
$ git check-ignore -v ".gate-report.1234.tmp"  →  NOT IGNORED
```

A crash or a kill between write and rename leaves an untracked file that trips CYC-001's clean-tree precondition on **every subsequent cycle**, with an error message that points at "repository must be clean" rather than at the stale temp file.

### R-28 — Prompt source context hardcodes `src/`
`prompt.mjs` `renderContext` returns `null` unless `file.startsWith("src/")`, ignoring the `writableGlobs` that are threaded through everywhere else. §8.7 explicitly allows narrowing the allowlist per project — do that, and the packet silently loses its `RELEVANT SOURCE` block while still passing every schema check. PRM-004 says "a writable source location", not "src/".

### R-29 — Secret scanning is implied but never specified
IMP-004 requires "source secrets are never copied"; §10.3 requires redacting "key-shaped strings". Neither the pattern set nor the detector is specified anywhere, and there is no requirement ID for it. Meanwhile the import report's "Banned patterns" row says evidence must "never [include] the raw secret-like content around it" — which conflates the banned-pattern scan (`as any`, `@ts-ignore`) with secret detection. Those are different scanners with different pattern sets; the report table should have six checks that each mean one thing.

---

## 5. "Too much of something" — redundancy and over-build

You asked specifically about this. Four places:

### R-30 — The same obligations are stated four times
§4 (47 requirement IDs), §9.6 (acceptance matrix), §12 (traceability), §14 (DoD) all restate the same set in four formats. Drift has already occurred in three of them: R-11 (CYC-014 vs §8.8 vs §14), R-12 (§12 missing four IDs), R-15 (PRM-006 vs the SOW).

**Fix:** make §4 normative and reduce §12/§14 to generated or pointer-only. If §12 must stay hand-written, add a test that asserts every ID defined in §4 appears in §12 — you already have the convention (`tests/acceptance/spec-inventory.test.mjs` does exactly this for SPEC-R1–R8; extend it).

### R-31 — Seven test layers, three of which the implementation didn't use
§9.3 defines Unit / Component / Integration / Harness-acceptance / Product e2e / Live smoke / Live acceptance. "Unit" and "Component" have identical policy ("No network; no model") and both test pure functions; the code sensibly collapsed to `tests/unit`, `tests/integration`, `tests/acceptance`. The doc's taxonomy now doesn't describe the repo.

### R-32 — §13's implementation order contradicts §9.2's TDD rule
§9.2 mandates per-slice red-green-refactor: "Write the smallest failing unit or integration test." §13 step 1 is "Commit schemas, requirement-ID test conventions, and **deterministic fixtures**" — all 14 fixture families from §9.4, before the code they feed exists. That is the waterfall §9.2 forbids three sections earlier, and it front-loads the most speculative artifact in the plan.

### R-33 — ~1.5 pages the implementer cannot act on
§15 (nine post-MVP backlog items) and §10.2 (a provider-fallback policy for cheap smoke runs) specify behaviour for a component the harness does not control and a phase that by definition starts after the DoD. §10 as a whole is a page of provider policy for a design whose §3.2 non-goal is "Calling an AI API directly from the harness."

### R-34 — The two "distinct" export fixtures aren't distinct, and aren't Lovable exports
§9.4 names `lovable-vite-react` and `lovable-vite-react-ts`. Both are Vite + React. §7.2 states the requirement they were presumably meant to cover — *"It must not assume Vite merely because the source came from Lovable"* — and **no fixture exercises a non-Vite path**, so the capability detector's whole reason for existing is untested. (`tests/unit/capabilities.test.mjs` has "detects Vite without assuming generator", which tests the happy path.)

Separately, both are synthetic. The SOW's second-export criterion exists specifically to prove "this is a component, not a one-off"; a fixture you authored to pass your own importer cannot prove that. `tasklist.md` §2 has the right item ("a second distinct supported export") — make sure at least one is a genuine Lovable export, and make one of them non-Vite or say plainly in FINDINGS.md that non-Vite is unproven.

---

## 6. Checked and cleared — do not "fix" these

Listing these so they don't get churned:

- **Renames evade verification** — they don't. `changedPathsBetween` and `rawDiffBetween` both pass `--no-renames`, decomposing a rename into add+delete so both sides are checked; `statusEntries` keeps both paths for `R`/`C` worktree entries with an explicit comment saying why. This is correct and non-obvious.
- **Rollback destroys run evidence** — it doesn't. `removeUntracked` iterates `git status --porcelain --untracked-files=all`, which excludes ignored paths, so `.harness/runs/` survives. It also refuses paths that escape the repo root.
- **`gate-report.json` fights the clean-tree precondition** — it doesn't; it is gitignored. (The temp file isn't — R-27.)
- **Absolute home paths leak into the packet** — they don't. `normalizeRepoPath` falls back to the raw path when it escapes the root, but `redact()` maps `os.homedir()` → `~` before the packet is written. (`gate-report.json` is unredacted, but gitignored.)
- **Oscillation detection is wrong** — it isn't. `A→A` correctly does *not* fire (that's the signature budget's job), `A→B→A` and `A→B→B→A` both fire on first recurrence. The `priorIndex < history.length-2` guard is right.
- **Cross-cycle log divergence breaks tree equality** — handled. `rollbackAndRecord` snapshots `cycles.jsonl`, restores the tree, rewrites the log, and unstages it before committing the revert.

---

## 7. Suggested order

1. **R-01** (green destroyed by wall clock) — one-line reorder in `termination.mjs`. Highest damage, lowest cost.
2. **R-04** (prose triggers tamper escalation) — will fire during live acceptance and produce a false tamper record.
3. **R-23** (grep mismatch silently voids every e2e failure) — add the "0 tests selected ⇒ errored" guard before the live Tier 1 runs.
4. **R-03 / R-20** (stage-scoped failure count; build always counts 1) — decide before live acceptance, because it determines whether the four fixable defects can reach green at all.
5. **R-05** (Mode B untested + can't take uncommitted edits) — this is *the* deliverable path; `tasklist.md` §4 is where it gets exercised for the first time.
6. **R-06** (`scripts/` back in scan scope) — five-character fix, restores two dead patterns.
7. **R-27, R-28, R-09** — small, contained.
8. **R-21 / R-22** — decide the Mode B clock model before the live matrix, not during it.
9. Doc reconciliation: **R-10, R-11, R-12, R-15, R-16, R-17** — cheap, and they are what a reviewer reads first.
10. **R-08** (paste in the SOW cut order) and **R-25** (demote the model profile out of the DoD) — before scope pressure arrives, per the SOW's own reasoning.
11. **R-30 – R-34** — trim after the MVP is evidenced; do not let doc surgery delay §5 of `tasklist.md`.

## Appendix — reproducing the proofs

```bash
npm test                       # 44/44 on Node v24.19.0

# R-01
node -e 'import("./scripts/lib/termination.mjs").then(({decideTermination})=>
  console.log(decideTermination({status:"passed",wallClockExceeded:true,
    totalAttempts:3,currentFailureCount:0,previousFailureCounts:[5,2]})))'
# => {"stop":true,"outcome":"escalated_timeout","reason":"wall_clock"}

# R-02: run cycle.sh with the existing `noop` fake-fixer mode against a stuck
# single-diagnostic defect; escalates escalated_no_progress at attempts:2,
# never reaching the documented 3-attempt signature budget.

# R-04 / R-06
#   src/App.tsx containing "// we deliberately avoid using as any here"
#   scripts/gate.sh containing "echo hi || true"
node -e 'import("./scripts/lib/scan.mjs").then(({scanBanned})=>
  console.log(scanBanned({cwd:"<tmp>"}),                              // AS_ANY only
              scanBanned({cwd:"<tmp>",roots:["src","e2e","scripts"]})))' // + OR_TRUE

# R-27
git check-ignore -v ".gate-report.1234.tmp"   # no match
```
