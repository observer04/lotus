# Lotus: Lovable Import + Dyad Cycle Harness

Lotus is a reusable local control plane for generated front-end applications. It imports a supported Lovable export into a deterministic Git repository, runs specification gates, constructs bounded failure packets for Dyad 1.12 Build mode, verifies every resulting Git change, and either converges to green or rolls back and escalates with an audit record.

The coffee-ordering application from the SOW is an acceptance specimen. The harness is the product.

## Reference profile

- Harness: `0.1.0`
- Node: `22.16.0` (`.nvmrc`, `engines`)
- Package manager: npm
- Dyad: `1.12.0` stable
- Dyad loop mode: Mode B, GUI Build mode
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
2. copies into a staging transaction while excluding `.git`, `node_modules`, build output and environment secrets;
3. creates `package-lock.json` before `npm ci` when necessary;
4. verifies the source install/build;
5. pins Node, Biome and Playwright scaffolding;
6. proves `useExhaustiveDependencies` actually fires;
7. generates `harness.json` and `import-report.md`;
8. resets `e2e/` to an empty harness-owned scaffold so tests from a prior customer cannot leak into the new project;
9. commits the normalized import and creates immutable `baseline-v1`.

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

The first convergence is explicit because no verified green ref exists yet:

```bash
./scripts/cycle.sh 1 --bootstrap
```

When bootstrap reaches green, Lotus creates:

- immutable `harness-green-v1` at the verified code commit;
- movable `refs/harness/last-green` at that same code commit.

Subsequent cycles require `refs/harness/last-green`.

## 4. Run a Dyad repair cycle

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
4. approve or reject the proposal.

Lotus waits for the Dyad-created Git state to settle, then verifies the complete `before..after` SHA range plus staged, unstaged and untracked state. Dyad cannot obtain green by editing tests/config/package metadata or by committing those edits before the harness notices.

### Protection policy

By default only `src/**` is writable. Everything else is denied, including:

- `e2e/**`, `scripts/**`, `config/**`, `schemas/**`;
- Biome, TypeScript and Playwright configuration;
- `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`;
- `AI_RULES.md`, `harness.json`, `cycles.jsonl`.

The structural scanner also rejects:

`@ts-ignore`, `@ts-expect-error`, `as any`, `biome-ignore`, `test.skip`, `test.only`, `xit`, `describe.skip`, `continue-on-error`, and `|| true`.

`AI_RULES.md` is advisory. Git verification and the scanner are authoritative.

### Hard stops

A cycle stops on:

- safety/tamper violation: immediately;
- same signature: 3 attempts;
- total attempts: 6;
- A → B → A signature recurrence: first recurrence;
- failure count not decreasing for 2 consecutive results;
- wall clock: 20 minutes by default;
- Dyad invocation timeout: 10 minutes by default.

On escalation Lotus creates an additive rollback commit whose code tree equals the last verified green tree. Failed/red commits remain in ancestry. No `git reset --hard` or force operation is used.

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
- attempt count and terminal reason;
- changed paths;
- duration;
- declared Dyad version/provider/model/effort.

Per-attempt prompts, reports and verification details remain under `.harness/runs/` and are intentionally untracked.

## 7. Inject a controlled defect

For an acceptance patch that only changes `src/**` or `e2e/**`:

```bash
./scripts/inject-defect.sh type-error /path/to/type-error.patch
```

The script performs `git apply --check`, rejects patches outside the allowed defect roots, applies the patch, and commits the red state so it remains in history.

## 8. Development and deterministic validation

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
- two-export import reuse/idempotency;
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

`tests/helpers/fake-fixer.mjs` crosses the same watcher/verifier boundary as Mode B. It is a deterministic test adapter, not an alternate production fixer.

## 9. Playwright acceptance spec

`e2e/coffee-ordering.spec.ts` contains one test for every SOW rule R1–R8. Tests use `data-testid` for owned interactions and assert exact strings where the SOW makes them normative, including `$4.50`, `coffee-cart-v1`, and `^ORD-\d{6}$`.

Chromium is the only browser installed by the importer.

## 10. Configuration

Useful environment variables:

```text
HARNESS_INVOCATION_TIMEOUT_MS  default 600000
HARNESS_CYCLE_TIMEOUT_MS       default 1200000
HARNESS_POLL_MS                default 2000
HARNESS_STABLE_POLLS           default 3
HARNESS_PROMPT_MAX_BYTES       default 49152
DYAD_PROVIDER                  metadata only
DYAD_MODEL                     metadata only
DYAD_REASONING_EFFORT          metadata only
```

Secrets belong in Dyad/provider settings or process environment. The harness never needs an LLM key for deterministic tests and redacts common key shapes from prompt/log material.

## 11. Repository map

```text
scripts/             stable shell entrypoints + Node implementation
scripts/lib/         parsing, Git, process, prompt and termination modules
config/              banned-pattern and dependency policies
schemas/             machine contracts
e2e/                 R1–R8 Playwright spec
tests/unit/           pure contracts and parsers
tests/integration/    import, gate and Git boundaries
tests/acceptance/     full deterministic cycle behavior
tests/fixtures/       distinct import fixtures and acceptance specimen
.harness/runs/        ignored runtime evidence
```

See `design.md` for the normative MVP architecture and `FINDINGS.md` for observed Dyad constraints and validation results.
