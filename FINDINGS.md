# Findings

## Dyad capability spike

Reference environment: Dyad 1.12.0 stable on Linux x64.

Sanitized retained evidence: `evidence/dyad-spike-2026-08-29.md`.

- No supported public CLI/headless prompt invocation was found. The MVP therefore uses Mode B.
- Existing projects can be imported in place, so Dyad and the harness can operate on the same Git working tree.
- Build mode is required. Agent mode is intentionally excluded because it owns an inner test/fix loop that would hide intermediate attempts from this harness.
- Build mode proposals require operator approval.
- Dyad may create Git commits for approved edits. The harness verifies the complete before/after SHA range and the current working tree.
- `AI_RULES.md` is advisory. Default-deny Git verification and banned-pattern scanning are authoritative.

The earlier spike also reported one approved Gemini 3.7 Flash source edit using `GOOGLE_API_KEY`, followed by a successful build and removal of the copied settings key. The retained sanitized evidence proves the Dyad version, proposal/approval/commit path, and unrelated-file observation, but intentionally does not retain the key, prompt, response, or source. No live model call was made during the present adversarial-review pass.

## SOW ambiguities resolved

- A missing npm lockfile is generated before `npm ci`.
- The banned scanner does not scan its own pattern-definition source.
- All fixer changes are default-deny except the configured writable allowlist (`src/**` by default).
- Rollback is additive and preserves failed commits in ancestry.
- Initial convergence is an explicit bootstrap case because no verified green ref exists yet.
- The referenced platform dependency list was absent from the SOW, so it is a versioned report-only policy under `config/`.
- A rejected/no-write Dyad proposal cannot be distinguished through the Mode B filesystem watcher and is classified as `invocation_timeout`.
- The 20-minute cycle ceiling measures harness execution and excludes the separately recorded Mode B invocation wait; invocation timeout defaults to 10 minutes.
- For no-progress, reaching a later fail-fast stage is progress. Within one stage, diagnostic count must improve. This avoids treating lint-to-typecheck advancement as regression.
- No-progress normally dominates the three-attempt signature budget for an identical failure set; the signature budget remains a backstop for a stable class whose diagnostic instances are decreasing.

## Claude adversarial review disposition

Accepted and implemented:

- Green takes precedence over a wall-clock crossing during the completed gate.
- Progress is stage-aware; common build diagnostics are parsed before a fallback record.
- The banned scanner covers `src/`, `e2e/`, and `scripts/`, masks prose for code-token rules, reports excerpts, and excludes only the prompt renderer.
- The real Mode B watcher is tested for both clean commits and stable uncommitted writes.
- Cycle records distinguish net `filesChanged` from `attemptedPaths`, carry discarded E2E IDs, separate wall/harness/invocation durations, and never invent model metadata.
- Playwright confirmation must select the requested R-rule IDs; zero selection is an errored gate.
- Source context follows configured writable roots; temporary gate reports are ignored; build parsing, schemas, traceability, scope reduction, repository map, rollback wording, and test taxonomy were reconciled.
- Source import now has a separate, versioned high-confidence secret detector whose errors omit matched values.
- A non-Vite synthetic import fixture proves capability detection does not assume Vite.

Not adopted as proposed:

- R8 confirmation remains a fresh process/browser context. The R8 test establishes its own cart, then reloads within that test; depending on another test's residue would be invalid isolation.
- Missing-lockfile no-op does not regenerate a lockfile: unchanged source identity exits before staging or npm access.
- The OpenAI `gpt-5.6-luna`/high profile remains because the project owner explicitly selected it, not because the SOW mandates it. Undeclared runs now record null metadata.
- Additive rollback remains preferable to moving `HEAD` backward. Acceptance is defined by code-tree equality with the last-green ref while preserving red ancestry and `cycles.jsonl` audit data.

## Deterministic validation

On 2026-08-29, the expanded suite passed 62/62 tests under the pinned runtime:

- Linux x64, kernel 7.0.0-30-generic
- Node 22.16.0, npm 11.6.1, Git 2.53.0
- `npm ci --ignore-scripts`: passed, zero vulnerabilities in the template package
- `npm test`: 62 passed, 0 failed, 8.64 seconds
- Local Playwright browser cache contains Chrome for Testing 149.0.7827.55 and 151.0.7922.34; the imported-project rehearsal must still prove the pinned Playwright/browser pair end to end

The deterministic reference-runtime check is complete. Final reference evidence still needs the imported project's exact Chromium/Playwright version, Tier 0 duration, and Tier 1 duration.

A disposable synthetic rehearsal also exercised the real importer with Node 22 and npm: the first import completed in 12.18 seconds, the second was a 0.15-second no-op at the same `HEAD`, `baseline-v1` remained correct, and Tier 0 correctly reported the fixture's intentional Biome formatting failure in 0.31 seconds. This validates the machinery but is not substituted for genuine Lovable-export evidence.

## Acceptance evidence

Deterministic tests are model-free. Remaining MVP evidence is intentionally not claimed by synthetic tests:

- import and no-op evidence for two genuine, distinct Lovable exports;
- clean-clone `npm ci && npm run build` on Node 22.16.0;
- real Chromium R1–R8 baseline and Tier 0/Tier 1 timings;
- one auditable Mode B repair and the full SOW defect matrix;
- the owner-selected Dyad 1.12 / OpenAI `gpt-5.6-luna` / high final run;
- cycle-log/schema audit and a final secret scan of committed and captured evidence.

Record observed attempt counts, timings, model metadata, handled classes, escalations, and flaky/discarded test IDs here as those live runs complete.
