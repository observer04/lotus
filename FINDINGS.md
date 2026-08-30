# Findings

Reference environment: Ubuntu 26.04, Linux x64, Node 22.16.0, npm 11.6.1, Git 2.53.0, Dyad 1.12.0
stable, Biome 1.9.4, Playwright 1.58.2 (Chromium only).

## The short version

The brief describes a half-built coffee app that a harness repairs through Dyad. Two genuine Lovable
exports told a different story, and most of the engineering effort went into the gap between the two.
Everything below came from running the thing, not from reading the brief.

## Where the brief and reality diverged

| The brief assumed | What two genuine exports actually did | What it cost |
|---|---|---|
| A small Vite/React single-page app | TanStack Start (server-rendered, Nitro), a generated route tree, 40+ vendored shadcn files, Tailwind 4 | `src/**` is mostly not the application |
| `src/**` is the app, so it is the writable scope | About 5 files of real application code inside ~55 files of generated and vendored scaffolding | Needed an ownership boundary, not a directory |
| Grep the banned patterns across `src/` | Generated code legitimately contains `as any` and `@ts-nocheck` | The scanner assumed every file under `src/` was model-owned |
| A pinned Biome gates the tree | Biome 1.9.4 cannot parse Tailwind 4, and its recommended rules fire 22 times on vendored boilerplate | The gate was designed for a tree that does not exist |
| The specimen is defective and gets repaired | Integer cents, the `coffee-cart-v1` storage key, the order-number format and the 8% tax were all already correct | The defect classes had to be injected, not discovered |
| Pinned Playwright installs anywhere | Playwright 1.58.2 refuses this host platform outright | The host needs an explicit, documented override |

The practical consequence: the first real gate run died in 0.2 seconds on a generated file, and a
direct Biome run reported 127 errors of which about 5 were genuine application defects. Sending that
to a model would have burned the entire attempt budget on formatting vendored boilerplate and editing
a file the generator overwrites on every build.

The fix was one rule, enforced in three places: **anything excluded from the standards scan and the
lint gate is also denied by Git verification.** Generated and vendored paths, listed in
`config/unowned-paths.json`, are unlinted, unscanned and unwritable, so an exclusion can never become
a hiding place for an edit.

## Where Dyad and its documented behaviour diverged

The capability spike asked whether an existing app can be used in place and got yes. It did not ask
what the **default** is, and the default is to copy.

When Dyad imports in copy mode, every edit lands in `~/dyad-apps/<name>` rather than the repository
the harness watches. The harness then waits on a tree that will never change, which is
indistinguishable from an operator who never pasted the prompt, and eventually records an invocation
timeout. That cost an hour of live session time and produced one of the nine cycle records below.
Dyad must import the project in place with copying disabled, and that is now the first thing the
README says about the Dyad loop.

Two smaller behaviours worth recording. Dyad writes its own `.dyad/` metadata directory into the
repository, which trips default-deny verification exactly like any other unexpected path. And Dyad
does not always commit; it may leave approved edits uncommitted, which the watcher handles as a
separate completion path with a longer quiet period.

## Three defects that only real exports could find

The deterministic suite was green at 62 tests and stayed green through all three of these. Each was
invisible to fixtures and appeared within minutes of running against a genuine export.

**npm lockfile generation is not single-pass.** `npm install --package-lock-only` writes an
internally inconsistent lockfile that `npm ci` then rejects. Running the identical command a second
time reconciles it. Reproduced on both exports: pass one fails, pass two passes, pass three onward is
byte-stable. The cause is a package declaring `ajv` as an optional peer dependency, which install and
ci resolve differently. The importer now reconciles until `npm ci` accepts the lockfile and two
consecutive passes are byte-identical.

**The Biome parser was written against a JSON shape 1.9.4 does not emit.** Diagnostic messages were
stored as a raw JSON array, and every lint diagnostic got a null line number, because 1.9.4 reports
source positions as a pair of UTF-8 byte offsets rather than an object. Because the line was null,
the prompt packet silently rendered no source context at all. The requirement to include fifteen
lines either side of each failure had been inert for the entire lint gate, and no test caught it
because every fixture used the wrong shape too.

**Build output was committed at import.** The importer runs a validation build in staging and then
copies staging to the target, so Nitro's `.output` directory became tracked files. Every later gate
rebuild dirtied them, and default-deny correctly escalated on them. That produced a false safety
escalation which discarded a correct one-file repair.

All three are fixed with regression tests. The suite went from 62 to 97, and nearly all of the new
tests are regressions for these rather than coverage for new features.

## Two red tests, opposite verdicts

Both looked identical at the failure-signature level. Both were settled by reading the brief.

**The specification was wrong.** Seven of the eight acceptance tests failed on what looked like
broken cart behaviour. The application is server-rendered, so its markup, including every test hook,
is present in the server HTML. Playwright's checks that an element is ready passed while React had
not yet attached its handlers, and the mount effect then overwrote any state a too-early click
produced. The proof was a two-line comparison: clicking immediately after reload gives zero cart
lines, clicking after waiting for hydration gives one. The fix was a precondition in the test, with
no assertion changed.

**The application was wrong.** The one remaining failure was the tax label. The application renders
`Tax (8%)`, while the brief states that `Subtotal`, `Tax` and `Total` are exact strings. That is a
genuine defect in the generated app, and it was left red on purpose as the target for a live repair.

This is the argument for keeping a person in the loop. A harness that forwarded every red gate
straight to the model would have sent it to fix a working application, and the likely result is
defensive workarounds bolted into correct source to satisfy a broken test.

## Results

Nine cycles against the coffee specimen, every record valid against the cycle-record schema. The
driver of each row is verifiable independently of this table: live rows record the operator-declared
model metadata, adapter rows record the test adapter, and the harness never guesses that field.

| # | Scenario | Driver | Outcome | Attempts |
|---:|---|---|---|---:|
| 1 | Prompt issued, operator never pasted | live Dyad | invocation timeout | 1 |
| 2 | Repair correct, tree carried untracked build output | live Dyad | safety escalation | 1 |
| 3 | Tax label repaired in the watched tree | live Dyad | green | 0 |
| 4 | Injected type error | adapter | green | 2 |
| 5 | Injected incomplete hook dependencies | adapter | green | 1 |
| 6 | Injected removal by array index | adapter | green | 0 |
| 7 | Injected currency formatting | adapter | green | 1 |
| 8 | Tamper attempt on a protected path | adapter | safety escalation | 1 |
| 9 | Unsatisfiable requirement | adapter | no-progress escalation | 2 |

Gate performance, averaged over four consecutive full runs: standards 0.0s, lint 0.1s, typecheck
4.6s, build 2.3s, browser tests 31.3s, total 38.6s. The build-only tier is about 7.0s.

Row 3 is the load-bearing result. Dyad repaired the tax label directly in the watched working tree,
the harness detected the change, verified it against the writable allowlist, re-ran the gates,
recorded green, and set the last-green reference to Dyad's own commit.

Row 4 is the only multi-attempt record. The first attempt changed source and left one typecheck
failure, so the second prompt carried populated prior-attempt history, and progress advanced from the
typecheck stage to complete. That is the stage-aware progress rule working on real data.

Rows 8 and 9 are adapter-driven by necessity rather than convenience. A tamper payload has to arrive
mid-cycle to appear in an attempt's own before-and-after comparison at all; a weakened assertion
sitting in the starting state is simply part of the baseline. Separately, a competent model cannot be
made to tamper or to oscillate on demand. The adapter crosses the identical verification and
state-machine boundary as a live session, so what these rows prove is the harness's behaviour, which
is what is being asked of them.

Every escalation left the repository clean, with failed and injected red commits preserved in history.

### Row 6 is a negative result

The removal-by-array-index defect was injected and the full gate passed in zero attempts. The harness
did not detect it, because the acceptance test decrements a single-line cart, where removal by index
and removal by identity are indistinguishable. The defect was reverted rather than left in the
verified-green tree.

This is the most useful line in the log. A green gate is evidence about the test suite at least as
much as about the source, and this harness is exactly as strong as the specification it runs. Closing
it needs a test that decrements the second of two distinct lines.

A related gap, found by reading and left open deliberately: the brief defines a line total as base
price plus a size modifier, times quantity, with Medium at fifty cents and Large at one dollar. The
generated app applies no size modifier at all, and the acceptance test only exercises the Small
option at zero, so the suite cannot see it. Recorded rather than rushed, and it is the first thing a
follow-up should fix.

## What unattended operation still needs

The loop itself already runs unattended. On a real session it built the prompt, waited on the
interface, detected the write, verified it, escalated, rolled back without destroying history, wrote
a valid record and left a clean tree, with no intervention inside the loop.

What needed a human was of two different kinds, and conflating them would be a mistake. **Defects**,
the three above, each found only by running against genuine exports and each now fixed permanently.
**Adjudication**, deciding that the hydration failures were a bad test while the tax label was a bad
application. The second kind is not a gap to be automated away. It is the boundary the design
deliberately preserves.

The concrete remaining gaps: Dyad exposes no headless or scriptable interface, so the paste and
approve step is irreducibly manual; installing the acceptance tests into a freshly imported project
is a documented copy rather than a script step; and deciding what narrative the evidence supports is
manual, though collecting and validating it is now scripted.

## Note on the published history

This repository and the specimen archives had their Git history rewritten once before publication, to
remove a third-party proprietary document that should not be republished. Commit identifiers recorded
in `cycles.jsonl` were captured before that rewrite and therefore do not resolve against the published
history. The commits, their contents and their order are unchanged; only the identifiers moved.
