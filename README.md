# Lotus: Lovable Import + Dyad Cycle Harness

Lotus is a reusable local control plane for generated front-end applications. It imports a supported Lovable export into a deterministic Git repository, runs specification gates, constructs bounded failure packets for Dyad 1.12 Build mode, verifies every resulting Git change, and either converges to green or rolls back and escalates with an audit record.

The coffee-ordering application from the SOW is an acceptance specimen. The harness is the product.

## Reference profile

- Harness: `0.1.0`
- Node: `22.16.0` (`.nvmrc`, `engines`)
- Package manager: npm
- Dyad: `1.12.0` stable
- Dyad loop mode: Mode B, GUI Build mode
- Owner-selected final evidence profile: OpenAI `gpt-5.6-luna`, high effort (not a SOW requirement)
- Default writable scope during a repair: `src/**`
- Gates: standards → Biome → TypeScript → build → optional Chromium Playwright

Dyad invocation is intentionally manual in the MVP. The harness owns everything around that one GUI step: diagnosis, prompt construction, retry budgets, tamper checks, rollback, and logs.

## Supported import profile

`./scripts/import-lovable.sh` accepts a trusted local directory or Git URL when the project:

- has `package.json` at the root;
- uses npm and is a single package;
- has `scripts.build` and either `scripts.dev` or `scripts.start`;
- can build deterministically;
- does not require an in-scope database/auth/backend for the tested journey.

pnpm, Yarn, workspaces/monorepos, Supabase-dependent projects, native apps, and server backends are rejected rather than guessed at.

## 1. Import a Lovable export

Start from a clean checkout of this harness and run:

```bash
./scripts/import-lovable.sh /absolute/path/to/lovable-export
# or
./scripts/import-lovable.sh https://github.com/example/lovable-export.git
```

The importer:

1. validates source/target paths and refuses symlinks;
2. excludes `.env*`, scans for versioned high-confidence committed-secret patterns without printing values, and copies into a staging transaction;
3. creates `package-lock.json` before `npm ci` when necessary, reconciling it across up to 5 generation passes until `npm ci --dry-run` accepts it and it is byte-stable (a known npm quirk: `npm install --package-lock-only` can write a lockfile that `npm ci` itself then rejects as out of sync, observed on both genuine exports) — the pass count is recorded in `import-report.md`;
4. verifies the source install/build;
5. pins Node, Biome and Playwright scaffolding;
6. runs a non-fatal `biome check --write src e2e` so `baseline-v1` reflects deterministic formatting and import organization instead of raw generator output (residual errors are reported, not treated as an import failure);
7. proves `useExhaustiveDependencies` actually fires;
8. generates `harness.json` and `import-report.md`;
9. resets `e2e/` to an empty harness-owned scaffold so tests from a prior customer cannot leak into the new project;
10. excludes a generator's own build-output directory (`dist`, `build`, `.output` -- TanStack Start/Nitro's target) from the copy and from `.gitignore`, so a later gate rebuild never dirties tracked paths outside `src/**`;
11. commits the normalized import and creates immutable `baseline-v1`.

If installing Playwright's Chromium build fails because the host is unrecognized (for example `ERROR: Playwright does not support chromium on ubuntu26.04-x64`), the importer prints the exact remediation and exits non-zero. It never sets the override itself:

```bash
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 ./scripts/import-lovable.sh <source>
```

Pass it explicitly on the command line only once you have confirmed the risk; an unsupported host should fail loudly, not silently pass as supported.

Running the same import again against unchanged input is a no-op. The importer never force-moves `baseline-v1`. Project-specific specification tests are deliberately committed **after** this baseline.

### Import report

`import-report.md` always includes the six required checks:

- float/currency math;
- interactive elements missing `data-testid`;
- typecheck baseline;
- lint baseline;
- banned patterns;
- dependencies outside `config/platform-dependencies.json`.

Unknown dependencies are report-only in the MVP.

### Unowned paths

Not everything under `src/**` is application code. Current Lovable exports emit a generator-owned TanStack Router route tree (`src/**/*.gen.ts`, `src/**/*.gen.tsx`) and vendor shadcn/ui components verbatim under `src/components/ui/**`. `config/unowned-paths.json` versions this policy (each glob carries a `reason`); a project can extend it with harness.json's optional `unownedGlobs`.

Unowned paths are **unowned ⇒ unscanned ⇒ unwritable**:

- the standards scan never reports a banned pattern (like a generated file's `as any`) inside them;
- a repair cycle is denied for touching one, committed or not, even though it lives under the writable `src/**` allowlist — this is Git-verified, not just scanner-side;
- the Dyad prompt packet never offers one as editable source context.

The import report still lists banned-pattern findings inside unowned paths — they are real defects worth knowing about, just not ones the harness will ever ask a fixer to touch. `biome.json`'s `files.ignore` is always kept as a superset of this policy (plus `**/*.css`, since Biome 1.9's CSS linter/formatter cannot parse Tailwind 4's `@import "tailwindcss" source(none)` and is disabled outright rather than patched per project).

## 2. Run gates

```bash
./scripts/gate.sh 0   # standards + lint + typecheck + build
./scripts/gate.sh 1   # Tier 0 + Chromium Playwright
```

Every run atomically replaces `gate-report.json`. Raw stdout/stderr and E2E evidence live under ignored `.harness/runs/`.

Later stages are `not_run` after the first failing stage. Tier 1 confirms an initial E2E failure once in a fresh app/browser run. A non-reproducible failure becomes `inconclusive` and is never sent to Dyad.

Failure identity is stable across line movement and output ordering. `failureSignature` is SHA-256 over sorted unique `gate/file/rule` tuples.

## 3. Establish the first green checkpoint

The R1–R8 spec tests should be committed while red before source fixes. For the Appendix A coffee specimen, the canonical files are retained under `tests/fixtures/acceptance-spec/` so a fresh import can install them after `baseline-v1` without contaminating the generic importer:

```bash
cp tests/fixtures/acceptance-spec/*.ts e2e/
git add e2e
git commit -m "test: add Appendix A R1-R8 specification"
```

The canonical spec already waits for client hydration (`waitForHydration` in `fixtures.ts`) before any
interaction. This matters if you adapt it for a different app: current Lovable exports are commonly
server-rendered (TanStack Start), which means every `data-testid` is present in the server HTML before
React attaches event handlers, so Playwright's actionability checks pass on a click that lands before
hydration and the click is silently lost. Against a real SSR export this looked exactly like the
application was broken (7 of 8 R1-R8 tests failed) until isolated as a spec assumption, not a defect --
see `FINDINGS.md`.

The first convergence is explicit because no verified green ref exists yet:

```bash
./scripts/cycle.sh 1 --bootstrap
```

When bootstrap reaches green, Lotus creates:

- immutable `harness-green-v1` at the verified code commit;
- movable `refs/harness/last-green` at that same code commit.

Subsequent cycles require `refs/harness/last-green`.

## 4. Run a Dyad repair cycle

**Import the project into Dyad in place, with copying disabled.** This is the single most likely way
to lose an hour: if Dyad imports with copying *enabled* (its default), every edit Dyad makes lands in
its own copy under `~/dyad-apps/<name>`, not the tree this harness is watching. The symptom is
indistinguishable from an operator who never pasted the prompt or never clicked approve: `cycle.sh`
waits patiently, correctly, and forever, then times out (`invocation_timeout`) with a clean rollback --
there is no error, because from the harness's point of view nothing happened. If a cycle times out and
you are confident you pasted and approved a proposal, check Dyad's project settings for a copy first.
The design's own capability spike confirmed importing an existing app in place is supported (Dyad 1.12
imported the disposable spike app with copying disabled and retained the original path); it is just not
the default, and Dyad gives no warning when copying is on. `cycle.sh` itself
prints a non-blocking warning at startup if a same-named directory already exists under
`~/dyad-apps/` (override with `HARNESS_DYAD_APPS_DIR`) -- a heuristic, not proof, but worth a second look
if you see it.

From a clean red state:

```bash
DYAD_PROVIDER=openai \
DYAD_MODEL=gpt-5.6-luna \
DYAD_REASONING_EFFORT=high \
./scripts/cycle.sh 1
```

Lotus runs the gates first. On red it writes:

```text
.harness/runs/<cycle-id>/attempt-N/prompt.md
.harness/active-prompt.md
```

The only Mode B operator action is:

1. open the already-imported repository in Dyad 1.12;
2. select **Build** mode and the declared model;
3. paste `.harness/active-prompt.md`;
4. approve the proposal if it is acceptable. A rejection/no-write is eventually recorded as a distinct invocation timeout because Mode B exposes no rejection signal to Lotus.

Lotus accepts either a stable Dyad commit or stable uncommitted changes, then verifies the complete `before..after` SHA range plus staged, unstaged and untracked state. Clean commits must be unchanged for 10 seconds; dirty edits for 30 seconds. Allowed dirty edits are captured in a harness commit. Dyad cannot obtain green by editing tests/config/package metadata or by committing those edits before the harness notices.

### Protection policy

By default only `src/**` is writable. Everything else is denied, including:

- `e2e/**`, `scripts/**`, `config/**`, `schemas/**`;
- Biome, TypeScript and Playwright configuration;
- `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`;
- `AI_RULES.md`, `harness.json`, `cycles.jsonl`.

The structural scanner examines `src/`, `e2e/`, and `scripts/` and rejects actual code/directive forms of:

`@ts-ignore`, `@ts-expect-error`, `as any`, `biome-ignore`, `test.skip`, `test.only`, `xit`, `describe.skip`, `continue-on-error`, and `|| true`.

`AI_RULES.md` is advisory. Git verification and the scanner are authoritative.

### Hard stops

A cycle stops on:

- safety/tamper violation: immediately;
- same signature: 3 attempts;
- total attempts: 6;
- A → B → A signature recurrence: first recurrence;
- no improvement for 2 consecutive results, comparing furthest fail-fast stage and that stage's diagnostic count;
- harness execution clock: 20 minutes by default, excluding Mode B invocation wait;
- Dyad invocation timeout: 10 minutes by default.

For repeated identical failures, no-progress normally stops after two attempts; the three-attempt signature cap is a backstop for a stable class whose diagnostic count is improving. A completed green gate always wins even if the execution clock expires during that gate.

### Concurrency

At most one `cycle.sh` runs against a repository at a time. Starting a cycle writes `.harness/cycle.lock`
(pid + start time, gitignored); a second concurrent start refuses immediately with a precondition exit
(code 2) rather than racing the first cycle's additive rollback, which would otherwise mistake the other
cycle's own commit for an unverified change to discard. A lock whose pid is no longer running (a crashed
or killed prior cycle) is treated as stale and reclaimed automatically. The lock is released on every
terminal path, including escalation and timeout.

On non-bootstrap escalation Lotus creates an additive rollback commit whose code tree equals the last verified green tree. Failed/red commits remain in ancestry. No `git reset --hard` or force operation is used. The proof command is:

```bash
git diff --quiet refs/harness/last-green HEAD -- . ':!cycles.jsonl'
```

## 5. Exit codes

| Code | Meaning |
|---:|---|
| `0` | green |
| `2` | precondition/configuration failure |
| `3` | E2E inconclusive/flaky |
| `4` | Dyad/fixer invocation timeout |
| `5` | bounded or safety escalation |

## 6. Cycle audit log

Every completed cycle appends one schema-validated line to `cycles.jsonl`, including:

- start/end code SHA;
- initial/final failure signature;
- signature and per-attempt history, without raw model conversation text;
- attempt count and terminal reason;
- net changed paths and all attempted paths, including rolled-back tamper paths;
- wall, harness-execution, and invocation-wait durations;
- discarded E2E failure IDs;
- declared Dyad version/provider/model/effort.

Undeclared model metadata is stored as null with `metadataSource: "undeclared"`; Lotus never guesses a model/profile for an audit claim.

Per-attempt prompts, reports and verification details remain under `.harness/runs/` and are intentionally untracked.

## 7. Curate evidence

`scripts/evidence.sh` copies an imported project's durable audit trail into this harness repository, so
it survives even if the disposable import workspace does not:

```bash
./scripts/evidence.sh coffee ~/projects/lotus-live/coffee
```

It copies exactly four files (`cycles.jsonl`, `gate-report.json`, `import-report.md`, `harness.json`)
into `evidence/<project>/`, but only after staging them, schema-validating every `cycles.jsonl` line
against `schemas/cycle-record.schema.json`, and running the same high-confidence secret scanner used at
import time over the staged copy. Any schema failure or secret finding refuses the whole copy rather than
writing a partial or unsafe result -- nothing lands in `evidence/` on a refusal.

## 8. Inject a controlled defect

For an acceptance patch that only changes `src/**` or `e2e/**`:

```bash
./scripts/inject-defect.sh type-error /path/to/type-error.patch
```

The script performs `git apply --check`, rejects patches outside the allowed defect roots, applies the patch, and commits the red state so it remains in history.

`evidence/defects/` holds the staged SOW defect-class matrix (type error, lint defect, index-based
removal, currency formatting, tamper bait, an unsatisfiable requirement) as ready-to-apply patches with a
README explaining each one's expected terminal outcome. They are authored against a specific specimen
commit and are unverified until re-checked with `git apply --check` against whatever commit you actually
have -- rebase or regenerate before injecting if the specimen has moved.

## 9. Development and deterministic validation

The harness's normal automated suite does not call an LLM:

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:acceptance
```

The suite covers:

- diagnostic parsing/signature invariance;
- prompt ordering, source mapping, redaction and byte limits;
- capability detection and import rejection paths;
- two Lovable-style import fixtures plus a non-Vite compatibility fixture, with reuse/idempotency;
- missing-lockfile and secret-exclusion behavior;
- ordered Tier 0 gates and fail-fast reporting;
- reproducible vs flaky Tier 1 E2E boundaries;
- committed/uncommitted protected-path checks and symlinks;
- fake-fixer green convergence;
- test-skip tamper escalation;
- banned source suppression;
- A → B → A oscillation;
- no-progress and signature budgets;
- invocation timeout;
- additive rollback and clean-tree invariants;
- bootstrap creation of `harness-green-v1`.
- real Mode B watcher capture for both committed and uncommitted edits;
- unowned generated/vendored path exclusion from the standards scan, protection, and prompt context;
- generator build-output (`.output/`) exclusion from the import and across a rebuild;
- cycle concurrency lock refusal and stale-lock reclaim;
- evidence curation schema/secret-scan refusal paths.

`tests/helpers/fake-fixer.mjs` crosses the same verifier and state-machine boundary as Mode B. Separate acceptance cases exercise the actual interactive watcher for both committed and uncommitted edits. The fake fixer is a deterministic test adapter, not an alternate production fixer.

## 10. Playwright acceptance spec

`e2e/coffee-ordering.spec.ts` contains one test for every SOW rule R1–R8. Tests use `data-testid` for owned interactions and assert exact strings where the SOW makes them normative, including `$4.50`, `coffee-cart-v1`, and `^ORD-\d{6}$`.

Chromium is the only browser installed by the importer.

## 11. Configuration

Useful environment variables:

```text
HARNESS_INVOCATION_TIMEOUT_MS  default 600000
HARNESS_CYCLE_TIMEOUT_MS       default 1200000
HARNESS_POLL_MS                default 2000
HARNESS_COMMIT_STABLE_POLLS    default 5
HARNESS_DIRTY_STABLE_POLLS     default 15
HARNESS_PROMPT_MAX_BYTES       default 49152
HARNESS_DYAD_APPS_DIR          default ~/dyad-apps (copy-mode preflight warning)
DYAD_VERSION                   metadata only
DYAD_PROVIDER                  metadata only
DYAD_MODEL                     metadata only
DYAD_REASONING_EFFORT          metadata only
```

Secrets belong in Dyad/provider settings or process environment. The harness never needs an LLM key for deterministic tests. Prompt material redacts supported key shapes; source import separately refuses high-confidence signatures defined in `config/secret-patterns.json`.

## 12. Repository map

```text
scripts/             stable shell entrypoints + Node implementation
scripts/lib/         parsing, Git, process, prompt, ownership, lockfile, cycle-lock and termination modules
config/              banned-pattern, secret-pattern, unowned-path and dependency policies
schemas/             machine contracts
e2e/                 R1–R8 Playwright spec
evidence/            curated cycle/gate/import evidence (scripts/evidence.sh) and staged defect patches
tests/unit/           pure contracts and parsers
tests/integration/    import, gate and Git boundaries
tests/acceptance/     full deterministic cycle behavior
tests/fixtures/       distinct import fixtures and acceptance specimen
.harness/runs/        ignored runtime evidence
```

See `FINDINGS.md` for observed Dyad constraints, live-run results, and known limitations. Requirement IDs (`IMP-`, `GATE-`, `PRM-`, `CYC-`, `SPEC-`) appear in test names and commit messages.

## Known limitations

See `FINDINGS.md` for the full writeups; this is a pointer, not a duplicate:

- **Adjudication is manual by design, not automatable.** Deciding whether a red e2e test is a defective spec or a defective specimen requires reading the actual normative requirement (the SOW); this is the human-in-the-loop boundary Mode B intentionally preserves, not a gap. See "What unattended operation still needs."
- **No headless Dyad interface exists.** Mode B's GUI paste/approve step is the actual product surface Dyad 1.12 exposes; see the capability spike (`evidence/dyad-spike-2026-08-29.md`) and "What unattended operation still needs."
- **Dyad's default import mode silently breaks the single-tree assumption** Mode B rests on; see the warning in section 4 and "Dyad behavioral observation: copy-mode import is the default, and it is silent" in `FINDINGS.md`.
- **Evidence curation and the R1-R8 spec install are operator-run steps** (`scripts/evidence.sh`, the `cp` in section 3), not triggered automatically by the importer or the cycle runner.
- **A known spec-depth gap**: the R1-R8 suite does not exercise the SOW's per-size line-total modifier (Small/Medium/Large), so a missing-modifier defect on a non-Small item would not be caught today. See "Known spec-depth gap" in `FINDINGS.md`.
