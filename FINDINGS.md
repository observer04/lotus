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

## R1-R8 specification defect: an SSR hydration race, caught before a model attempt

Real Tier 1 execution against the imported `cozy-coffee-cart` specimen (commit `6d5486b0`) initially
returned 7 of 8 R1-R8 tests failing, with failure signatures that read exactly like application defects:
cart lines never appearing after "Add to cart," money rows missing, checkout staying disabled. Only R1 --
the one test that never interacts with the page -- passed.

Isolated with a controlled A/B on the same app and the same click, varying only whether the test waited for
client hydration first:

```
NO hydration wait  : cart-line count = 0
WITH hydration wait: cart-line count = 1
```

Root cause: `src/routes/index.tsx` is server-rendered (TanStack Start). Every `data-testid` is present in the
SSR HTML before React attaches event handlers, so Playwright's actionability checks -- which only inspect
the DOM -- let a click through before hydration completes. Worse, even a click that lands early gets
overwritten a moment later when the mount effect runs `setCart(loadCart())`. R1 never exercises this path,
which is why it alone passed against the unmodified spec.

The operator adjudicated this as a bad test, not bad source, and the fix landed in the spec
(`e2e/fixtures.ts`'s `waitForHydration`), never in `src/**`. It adds a precondition only: zero assertions,
selectors, or test titles changed. The wait gates on `localStorage.getItem("coffee-cart-v1") !== null`,
because the cart-persistence effect writes that exact key once the component has mounted -- and
`coffee-cart-v1` is the SOW's own normative storage key (R8), not an incidental implementation detail
picked for convenience.

After the fix: 7 of 8 R1-R8 tests pass against the real specimen. The one residual failure (R5) is a plain
string mismatch -- the app renders the tax line as `Tax (8%)`, the spec's `getByText("Tax", { exact: true
})` expects the bare word `Tax`.

**General lesson for applying this harness to what Lovable emits today**: a spec authored against a CSR
(client-rendered) assumption produces failures on an SSR export that are indistinguishable, from the
failure signature alone, from real application defects, because the server-rendered markup already
satisfies every one of Playwright's DOM-presence and visibility checks. Handed to a live Dyad session
unmodified, this would have produced five or more real-looking defects with no fix available in `src/**`,
burning attempt budget toward an oscillation or signature-budget escalation before anyone noticed the spec,
not the application, was wrong. Catching it by hand first is the SOW's "cheapest legitimate route" instinct
applied to Component B: **check the test's own framework assumptions against what the generator actually
emitted before trusting a red gate to mean a red application.**

### R5 adjudicated: the opposite verdict, reached the same way

R5's `Tax` mismatch went the other direction from the hydration case. SOW Appendix A states, verbatim:
"Strings (exact): Your cart is empty, Subtotal, Tax, Total, Order confirmed." `Tax` is a normative exact
string; the specimen renders `Tax (8%)` at `src/routes/index.tsx:314` and `:429`. Here **the spec is right
and the specimen is wrong** -- the opposite of the hydration finding, where the spec was wrong and the
specimen was right. R5 is left red; it is a legitimate Dyad target and `src/**` is not touched for it.

The transferable point is the contrast itself, not either individual verdict: two red e2e tests with
near-identical failure signatures (an element the assertion expects is not found/not matching) resolved to
opposite conclusions -- one a defective spec (fixed with a zero-assertion-change precondition), one a
defective specimen (left red for the repair loop) -- and both were settled the same way, by reading the SOW
rather than by preference. **A red e2e gate does not by itself tell you which side is wrong; the failure
signature looks identical either way.** Adjudicating it is exactly the judgment Mode B's human-in-the-loop
boundary exists to preserve: a harness that auto-forwarded every red gate straight to the model, with no
operator check against the actual normative requirement, would have "fixed" a working application in the
hydration case and rubber-stamped a real defect as unfixable spec noise in the R5 case if the calls had
been made carelessly, or reversed.

## Known spec-depth gap: line-total size modifier is untested

SOW money rules state, verbatim: "Line total = (base + size modifier) x qty" with Size: Small +$0.00,
Medium +$0.50, Large +$1.00. The specimen's `lineTotalCents` (`src/routes/index.tsx:89`) is
`product.priceCents * line.qty` -- no size modifier applied at all, for any size. This is a real SOW
violation, and it is **not caught by the current R1-R8 suite**: R5, the only test that checks line-total
math, exercises a Small item exclusively (`addItem(page, "latte", "Small", "Whole")`), where the modifier
is +$0.00 and the missing-modifier bug is invisible by construction. Ordering a Medium or Large would
immediately expose it.

This gap is recorded rather than closed. Reason: deadline-bounded prioritization of outcome breadth (import
idempotency, real Tier 0/1 execution, the hydration-race adjudication, the defect-matrix staging) over spec
depth, and more red at this point raises the real risk of never reaching a green baseline at all before the
deadline -- an honestly recorded gap is worth more than a rushed assertion added without time to verify its
own correctness against the live specimen. This is the first item a follow-up should address: extend R5 (or
add an R5b) to exercise a non-Small size and assert the modifier is applied, which would very likely turn
this into a second live, legitimate Dyad repair target alongside the `Tax` string defect.

## Acceptance evidence

Deterministic tests are model-free. Remaining MVP evidence is intentionally not claimed by synthetic tests:

- import and no-op evidence for two genuine, distinct Lovable exports;
- clean-clone `npm ci && npm run build` on Node 22.16.0;
- real Chromium R1–R8 baseline and Tier 0/Tier 1 timings;
- one auditable Mode B repair and the full SOW defect matrix;
- the owner-selected Dyad 1.12 / OpenAI `gpt-5.6-luna` / high final run;
- cycle-log/schema audit and a final secret scan of committed and captured evidence.

Record observed attempt counts, timings, model metadata, handled classes, escalations, and flaky/discarded test IDs here as those live runs complete.

## The `.output` false escalation

Live cycle `20260830T142422432Z-3ef6186` against the coffee specimen produced 16
`protected_worktree_path` violations, all under `.output/**` (TanStack Start's Nitro build output),
and escalated `escalated_safety` -- rolling back the fixer's correct, single-file edit along with them.
The mechanism worked exactly as designed: `.output/` was never excluded from the normalized import
(`EXCLUDE_NAMES` in `import-lovable.mjs` covered `.git`, `node_modules`, `dist`, `build`,
`playwright-report`, `test-results`, `.harness`, but not `.output`, and the harness's own `.gitignore`
had no entry for it either), so a rebuild during Tier 0's build stage regenerated `.output/` inside the
target and every file in it was untracked and outside the `src/**` writable allowlist. Default-deny
verification correctly refused to guess that regenerated build output was safe to ignore -- it has no
way to distinguish "harmless rebuild artifact" from "an edit outside the allowlist" without being told
which paths are which, and it was not told. Fixed by adding `.output` to `EXCLUDE_NAMES` and `.output/`
to `.gitignore` (IMP-019), with a regression test whose second assertion -- a rebuild after import must
leave `git status` clean, not just "the initial import doesn't track it" -- is the one that actually
protects the loop, since the false escalation came from a *later* rebuild, not the import itself.

This is the argument for default-deny, not against it: a permissive verifier would have let the false
escalation slide as a "probably fine" build artifact and logged a clean-looking cycle, hiding the gap
until it silently broke a real repair later, on a project where the artifact drifted to look enough
like an edit to be missed by eye. Default-deny turned an invisible gitignore gap into a loud, correctly
diagnosed, immediately-fixable failure the first time it was exercised against a genuine export's real
build tool.

## What unattended operation still needs

The repair loop ran **unattended end to end** on a real Dyad session: built the failure packet, waited
on the GUI for a human-approved edit, detected the write, verified it against default-deny protection,
escalated on a genuine violation, rolled back additively, wrote a schema-valid cycle record, and left a
clean tree -- with no operator intervention *inside* the loop itself. The one manual step Mode B
requires by design is the GUI paste-and-approve; everything else (diagnosis, prompt construction,
verification, rollback, logging) ran without a human deciding anything.

What did require a human across this project was two different kinds of thing, and they should not be
conflated:

- **Defects.** npm's lockfile-reconciliation quirk, the Biome 1.9.4 diagnostic-shape mismatch, and now
  `.output` tracking were each found only by running the harness against genuine Lovable exports and a
  real Dyad cycle -- no amount of synthetic fixture testing surfaced any of the three. Each is now fixed
  permanently in the harness (`scripts/lib/lockfile.mjs`, the `parseBiome` rewrite, `EXCLUDE_NAMES`/
  `.gitignore`) with a regression test, so none of them recur on the next import or the next cycle.
- **Adjudication.** Deciding the hydration failures were a defective *spec* while R5's `Tax` mismatch
  was a defective *specimen* is human judgment against the SOW, not a defect in the harness. This is not
  a gap to be automated away -- it is the boundary Mode B's human-in-the-loop design deliberately
  preserves. A harness that auto-forwarded every red e2e gate straight to a model, with no operator
  check against the actual normative requirement, would have "fixed" a working application in the
  hydration case. Removing that adjudication step would not make the harness more unattended in any
  sense worth having; it would make it wrong more often.

Concrete gaps that remain for genuinely unattended (no-human-anywhere) operation, stated plainly:

- No headless Dyad interface exists. Mode B is a GUI paste-and-approve step because that is what Dyad
  1.12 actually exposes (`evidence/dyad-spike-2026-08-29.md`); a fully unattended loop needs either a
  Dyad-provided headless/API mode that does not currently exist, or a different model-invocation path
  entirely.
- Evidence collection into `evidence/` (sanitized `cycles.jsonl`, timings tables, import reports) is a
  manual curation step, not scripted.
- Installing the R1-R8 spec into an imported project's `e2e/` after `baseline-v1` is a documented manual
  copy (`cp tests/fixtures/acceptance-spec/*.ts e2e/`), not a harness script step.
