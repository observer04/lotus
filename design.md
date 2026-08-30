# Lovable Import and Dyad Cycle Harness — MVP Design

Status: implementation-ready design  
SOW source: SOW-Lovable-Import-and-Cycle-Harness.pdf  
Target harness version: 0.1.0  
Validated Dyad version: 1.12.0 on Linux x64  
Primary loop mode: Mode B, semi-automated Dyad GUI Build mode

## 1. Product decision

The MVP is a reusable local control plane around generated front-end applications. A user supplies a trusted Lovable export once. The importer normalizes it into a deterministic Git repository. The cycle harness then owns every later change: it runs gates, gives a bounded failure packet to Dyad, verifies Dyad's resulting Git change, and either repeats, records green, or rolls back and escalates.

The coffee ordering application in the SOW is only the acceptance specimen. It is not the product.

The MVP is complete only when a user can:

1. Import each of two different Lovable exports with the same command.
2. Re-run either import without producing a diff.
3. Run one command from a red state and receive either a verified green result or a clean, evidence-backed escalation.
4. Trust that Dyad cannot obtain green by changing tests, gate configuration, or other protected files.
5. Inspect a durable cycle record without reading raw terminal output.

No dashboard, deployment, database, CI service, or multi-project manager belongs in the MVP.

## 2. Evidence from the Dyad 1.12 capability spike

The design uses observed behavior, not an assumed Dyad API. The sanitized retained spike artifact is `evidence/dyad-spike-2026-08-29.md`; raw Dyad logs/settings remain outside Git because they may contain private state.

| Question | Observed result | Design consequence |
|---|---|---|
| Is a CLI or headless prompt interface available? | No usable public CLI was found. Both dyad --help and dyad --version launched the Electron application. | Build Mode B. The harness prepares the packet and watches Git; the operator performs the Dyad GUI invocation. |
| Can an existing app be used in place? | Yes. Dyad 1.12 imported the disposable app with copy disabled and retained the original path. | Dyad and the harness operate on one repository. No patch shuttle or mirrored repo is needed. |
| Is the required editing mode present? | Yes. The chat selector exposes Build mode. | The runbook requires Build mode, not Basic Agent or Agent mode. |
| Does an edit require interaction? | Yes. Build mode generated a proposal and required Approve. | Approval is part of the single permitted Mode B invocation step. |
| How are changes written? | After approval, Dyad wrote the file and created a Git commit authored by Dyad. | Completion is detected primarily by a new commit plus a stable worktree. SHA ranges, not only uncommitted diffs, must be verified. |
| Can Dyad include unrelated changes? | Yes. The spike's tracked Vite cache was automatically amended into the Dyad commit along with the requested source edit. | Verification is default-deny. Every path outside the writable allowlist causes immediate escalation, even when the requested fix is correct. |
| Does AI_RULES.md enforce scope? | It was followed for the requested source edit, but unrelated pre-existing runtime changes were still included. | AI_RULES.md is advisory. Git verification and banned-pattern scanning are authoritative. |
| Did a real model-backed edit work? | Yes. A Google API key was validated in Dyad, Gemini 3.7 Flash produced the one-line proposal, the proposal was approved, and the app built afterward. The copied key was then removed from Dyad settings. | Keep an opt-in cheap live smoke path, but keep normal harness tests model-free. |
| Is the requested end-use model visible? | Yes. Dyad's catalog contains gpt-5.6-luna with low, medium, high, xhigh, and max effort; its catalog default was high. | The acceptance profile is OpenAI / gpt-5.6-luna / high. This profile is recorded per run. |

Spike conclusion: Mode B is the supported MVP. A future headless adapter must not be implied by the current implementation.

## 3. Scope

### 3.1 MVP scope

- Trusted local directory or Git URL as a Lovable export source.
- npm projects with package.json and a front-end build command.
- A package-lock.json normalized for npm ci.
- A pinned Node runtime.
- Biome, TypeScript, build, and Chromium-only Playwright gates.
- The six SOW import-report checks.
- Appendix A tests R1 through R8.
- Structured gate and cycle records.
- Deterministic prompt construction.
- Mode B Dyad Build-mode invocation.
- Bounded retries, safety checks, rollback, and escalation.
- Deterministic fake-fixer scenarios and opt-in live Dyad acceptance runs.
- Deterministic import fixtures, including a non-Vite compatibility fixture, plus all six SOW defect scenarios and oscillation. Final acceptance still requires two genuine, distinct Lovable exports; synthetic fixtures do not satisfy that evidence requirement.

### 3.2 Explicit non-goals

- Supabase, databases, authentication, migrations, payments, or deployment.
- CI-provider integration.
- Automatic control of the Dyad GUI.
- Calling an AI API directly from the harness.
- Supporting pnpm, Yarn, monorepos, native applications, or server backends.
- Improving specimen styling or adding product features not required by R1–R8.
- Automatically approving new dependencies.

### 3.3 Supported-project contract

The importer accepts a project only when all of the following are true:

- package.json is at the export root.
- The package manager is npm.
- The project is a single package, not a workspace.
- A deterministic production build command can be resolved.
- The application can be served locally for Playwright.
- No database or required remote backend is needed for the Appendix A journey.

Unsupported capabilities are reported with actionable reasons and a non-zero exit. “Any Lovable export” means any export inside this declared MVP profile; silent guessing is not allowed.

### 3.4 Scope reduction order

If schedule pressure forces a cut, preserve the SOW's order: first remove Playwright JSON aggregation, then Tier 1 from the repair loop, then reduce the spec suite to R1–R5, and only then reduce live fixable-defect evidence to the type and lint cases. Never cut the banned scanner, protected-path verifier, tamper-bait cycle, or cycle log. No reduction is currently activated; this order prevents safety evidence from being traded away for feature breadth.

## 4. Normative requirements

The IDs below are the source of truth for implementation and test names.

### 4.1 Import requirements

- IMP-001: scripts/import-lovable.sh SOURCE imports a local path or Git URL into the current harness repository.
- IMP-002: the target and source paths must differ, resolve below their expected roots, and be free of symlink escapes.
- IMP-003: the target must be clean before the first import and before any re-import.
- IMP-004: .git, node_modules, build output, local environment files, and source secrets are never copied.
- IMP-005: a missing lockfile is generated before npm ci; npm ci is never attempted first when no lockfile exists. Generation is reconciled: `npm install --package-lock-only` can write a lockfile that its own `npm ci` then rejects as out of sync (observed on both genuine exports, caused by an optional-peer conflict npm's installer and its stricter ideal-tree check resolve differently), so generation repeats until `npm ci --dry-run` accepts the lock and the lock is byte-stable across two consecutive passes, capped at 5 passes. The pass count is recorded in import-report.md.
- IMP-006: Node is pinned by .nvmrc and package.json engines from one version constant.
- IMP-007: Biome is version-pinned and useExhaustiveDependencies is error severity.
- IMP-008: a smoke fixture proves useExhaustiveDependencies actually fails; configuration presence alone is insufficient.
- IMP-009: Playwright is version-pinned and installs Chromium only. A browser-install refusal on an unrecognized host is explained to the operator with the exact remediation environment variable; the importer never sets it silently, so an unsupported machine fails loudly rather than pretending to be supported.
- IMP-010: harness.json and all required scaffolding are produced deterministically.
- IMP-011: import-report.md contains all six SOW checks, each with status, count, and evidence.
- IMP-012: baseline-v1 is created only after normalization and is never moved automatically.
- IMP-013: a second run against unchanged input exits zero and produces no tracked or untracked diff.
- IMP-014: a clean clone passes npm ci and npm run build.
- IMP-015: two distinct Lovable exports pass the same importer without script modification.
- IMP-016: before copying, the importer scans text files for the versioned high-confidence secret patterns in config/secret-patterns.json; a finding refuses import while reporting only pattern ID, relative path, and line.
- IMP-017: after harness files land in staging and before the useExhaustiveDependencies smoke fixture, the importer runs a non-fatal `biome check --write` over src and e2e so baseline-v1 reflects deterministic formatting and import organization rather than raw generator output; residual errors are genuine findings, not import failures.
- IMP-018: the importer detects and records generator-owned/vendored paths (config/unowned-paths.json, optionally extended per project by harness.json's `unownedGlobs`) so a reusable import never assumes `src/**` is entirely application code; biome.json's `files.ignore` is a superset of the same policy globs (single-source guard).
- IMP-019: build-output directories a generator's own build step produces (e.g. TanStack Start/Nitro's `.output/`) are excluded from the normalized import and gitignored, so a later gate rebuild cannot dirty tracked paths and trigger a false protected-path escalation.

### 4.2 Gate requirements

- GATE-001: scripts/gate.sh accepts only tier 0 or 1 and exits non-zero for failed, errored, or inconclusive gates.
- GATE-002: tier 0 orders standards, lint, typecheck, then build.
- GATE-003: tier 1 runs tier 0 and then Chromium Playwright.
- GATE-004: stage fail-fast is preserved; later stages are recorded as not_run in the aggregate report.
- GATE-005: every invocation atomically replaces gate-report.json with a schema-valid report.
- GATE-006: diagnostics have stable failure identities independent of line-number movement and output ordering.
- GATE-007: the failure signature is SHA-256 over sorted unique gate/file/rule tuples.
- GATE-008: the banned scan examines filesystem content under src, e2e, and scripts. Code-like rules ignore prose in comments and string literals; directive rules match actual directive comment forms. The prompt renderer is the sole explicit path exclusion because it must quote the prohibited tokens.
- GATE-009: a first-red e2e failure is rerun once by failing test ID before it can enter a fix loop.
- GATE-010: a non-reproducible e2e failure is inconclusive and is never sent to Dyad.
- GATE-011: unowned ⇒ unscanned ⇒ unwritable. A path excluded from the standards scan and the lint gate (config/unowned-paths.json, merged with harness.json's `unownedGlobs`) is also denied by Git verification, across the full commit range and the worktree. Exclusion can never become a hiding place for a fixer's edit, and the prompt packet never offers unowned files as editable source context.

### 4.3 Prompt requirements

- PRM-001: scripts/build-prompt.sh accepts a schema-valid failed gate report only.
- PRM-002: output ordering is deterministic.
- PRM-003: the packet contains the first 20 failures and marks truncation.
- PRM-004: source context is limited to 15 lines before and after a writable source location.
- PRM-005: prior attempts on the current signature are included without model secrets or full conversation history.
- PRM-006: constraints name protected paths, banned patterns, the writable allowlist, generator-owned/vendored (unowned) paths excluded even from that allowlist, and the prohibition on weakening assertions or reducing assertion count.
- PRM-007: the complete packet has a configurable byte ceiling and records any truncation.

### 4.4 Cycle requirements

- CYC-001: scripts/cycle.sh TIER refuses to start from a dirty repository.
- CYC-002: it runs gates before asking Dyad to change anything.
- CYC-003: a green initial gate records a zero-attempt green cycle.
- CYC-004: in Mode B it writes the prompt packet, displays its path, and waits for a Dyad-created Git state change.
- CYC-005: completion requires either a changed HEAD or a non-empty worktree inventory, followed by a stable snapshot. With the two-second default poll, committed-clean state must be stable for five polls and dirty state for fifteen polls.
- CYC-006: the verifier compares the entire before/after SHA range and current worktree.
- CYC-007: every allowed uncommitted change is captured in a harness attempt commit before re-gating.
- CYC-008: any path outside the writable allowlist, any banned pattern, symlink, submodule, or protected mode change escalates immediately.
- CYC-009: attempts per signature stop at 3.
- CYC-010: total attempts stop at 6.
- CYC-011: an A → B → A signature recurrence stops on the first recurrence.
- CYC-012: progress is compared lexicographically by the furthest fail-fast stage reached and the diagnostic count within that stage. Two consecutive non-improvements stop as no progress; reaching a later stage is always progress.
- CYC-013: the configurable harness-execution ceiling defaults to 20 minutes and excludes Mode B operator/model invocation wait. The separate invocation timeout defaults to 10 minutes.
- CYC-014: escalation restores the code tree to the last verified green tree through a new additive commit, never git reset --hard.
- CYC-015: failed attempt commits and injected red commits remain ancestors and therefore remain inspectable.
- CYC-016: every terminal path appends exactly one schema-valid line to cycles.jsonl and leaves a clean tree.
- CYC-017: safety verification runs before every re-gate.
- CYC-018: the exit code distinguishes green, precondition failure, flaky/inconclusive, invocation timeout, and escalation.
- CYC-019: at most one cycle.sh runs against a repository at a time. A live lock (`.harness/cycle.lock`, pid + start time) refuses a second concurrent start with a precondition exit; a lock whose pid is no longer running is stale and is reclaimed rather than honored. The lock is released on every terminal path.

### 4.5 Acceptance-spec requirements

- SPEC-R1 through SPEC-R8 map one-to-one to Appendix A rules R1–R8.
- Each Playwright title starts with its rule ID and exact rule statement.
- Tests are derived from the SOW, not from observed specimen behavior.
- Exact strings, integer-cent math, the order-number expression, and localStorage key coffee-cart-v1 are constants in the test specification.
- The R1–R8 test commit precedes every source fix commit.

## 5. User workflow

### 5.1 Import journey

1. The user creates or clones a fresh harness repository.
2. The user runs scripts/import-lovable.sh SOURCE.
3. The script validates the source, inventories it, and copies only approved project content.
4. It detects capabilities and either selects supported commands or fails with a report.
5. It creates a lockfile if required, then uses npm ci.
6. It installs pinned harness tooling, writes configuration, and proves the lint rule is live.
7. It runs the import checks and writes import-report.md.
8. It commits normalized import state and creates baseline-v1.
9. A second identical invocation is run as part of acceptance and must be a no-op.

### 5.2 Cycle journey

~~~mermaid
flowchart TD
    A["Require clean repo and last-green ref"] --> B["Run selected gate tier"]
    B -->|green| C["Record green and update last-green"]
    B -->|e2e non-reproducible| D["Record inconclusive; no Dyad call"]
    B -->|red| E["Build deterministic prompt packet"]
    E --> F["Operator invokes Dyad 1.12 Build mode and approves proposal"]
    F --> G["Detect changed Git state and quiet period"]
    G --> H["Verify path allowlist, protected files, and banned patterns"]
    H -->|tamper| I["Additive rollback to last green; log; escalate"]
    H -->|safe| J["Capture attempt commit if needed"]
    J --> K["Re-run gates"]
    K -->|green| C
    K -->|bounded retry allowed| E
    K -->|hard stop| I
~~~

The only manual Mode B action is invoking Dyad with the generated packet and approving its proposal. The user does not manually run gates, select files, copy diffs, or decide whether another attempt is allowed.

## 6. Repository design

~~~text
.
├── package.json
├── package-lock.json
├── .nvmrc
├── index.html                 # when present in the imported application
├── src/                       # imported application; default writable root
├── AI_RULES.md
├── README.md
├── FINDINGS.md
├── harness.json
├── import-report.md
├── gate-report.json
├── cycles.jsonl
├── biome.json
├── playwright.config.ts
├── config/
│   ├── banned-patterns.json
│   ├── secret-patterns.json
│   ├── unowned-paths.json
│   └── platform-dependencies.json
├── schemas/
│   ├── harness.schema.json
│   ├── gate-report.schema.json
│   └── cycle-record.schema.json
├── scripts/
│   ├── import-lovable.sh
│   ├── gate.sh
│   ├── gate-report.mjs
│   ├── build-prompt.sh
│   ├── cycle.sh
│   ├── verify-protected.sh
│   ├── scan-banned.sh
│   └── lib/
│       ├── capabilities.mjs
│       ├── diagnostics.mjs
│       ├── git-state.mjs
│       ├── invocation.mjs
│       ├── ownership.mjs
│       ├── playwright.mjs
│       ├── prompt.mjs
│       ├── secrets.mjs
│       ├── schema.mjs
│       └── termination.mjs
├── e2e/
│   ├── fixtures.ts
│   └── coffee-ordering.spec.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── acceptance/
│   └── fixtures/
└── .harness/
    └── runs/                 # ignored runtime evidence
~~~

Bash files are stable entrypoints and process orchestrators. Parsing, hashing, JSON, schemas, prompt rendering, and state-machine decisions live in Node modules. Shell scripts use arrays, quoted paths, set -euo pipefail, and no eval. The `src/**`-only repair scope is intentionally validated against R1–R8; a project needing a root-file repair must receive a reviewed allowlist change before the cycle starts.

## 7. Component A design

### 7.1 Transaction and idempotency

Import uses a temporary staging directory. It never partially overlays the target:

1. Resolve a local source or clone a Git URL into temporary storage.
2. Reject symlinks and high-confidence committed-secret findings before any target copy.
3. Compute source identity from normalized relative paths and file hashes.
4. Return immediately when that identity is already imported; this happens before lockfile generation or registry access.
5. Copy into staging using a fixed exclusion list and generate the intended target overlay.
6. Validate install, tooling, build, and report in staging.
7. Apply the validated overlay to the clean target, commit once, and create baseline-v1.

Stable inputs produce byte-identical generated files. importedAt is written only on first import and preserved on a no-op re-run. Reports do not contain a fresh generation timestamp. Git URLs record the resolved commit SHA; local inputs record a content SHA.

If baseline-v1 exists:

- If it points to the same normalized import identity, the tag is accepted.
- If it points elsewhere, import fails. The script never force-moves the tag.

### 7.2 Package normalization

For a missing package-lock.json:

1. Run npm install --package-lock-only --ignore-scripts in staging.
2. Validate that a lockfile was produced.
3. Run npm ci using the pinned Node/npm environment.

For an existing lockfile, npm ci is the first package operation.

package.json scripts are normalized without replacing existing application commands:

- harness:standards
- harness:lint
- harness:typecheck
- harness:build
- harness:e2e
- harness:gate

Command selection is capability-driven. The detector records why each command was chosen. It must not assume Vite merely because the source came from Lovable.

`harness.json` schema version 1 requires `harnessVersion`, `source.kind`, `source.identity`, `nodeVersion`, argv-array commands for build/dev/typecheck/lint, and at least one `writableGlobs` entry. Import-generated records additionally contain `importedAt`, detected `framework`, the e2e argv, optional resolved Git commit, and the local server-ready timeout. `unownedGlobs` is optional and additive to `config/unowned-paths.json` (§7.6).

After harness files land in staging and before the useExhaustiveDependencies smoke fixture (§7.4), the importer runs `biome check --write src e2e` (IMP-017). This is non-fatal — a nonzero exit is expected whenever residual, non-auto-fixable errors remain — and applies only formatting, import organization, and Biome's safe fixes. It never invents a green baseline; the normalized build re-verification after it aborts the import loudly if normalization broke anything.

### 7.3 Secret boundary

Environment files (`.env` and `.env.*`) are excluded by name. Independently, the importer scans source text files up to 1 MiB before copying. `config/secret-patterns.json` versions high-confidence signatures for private keys and OpenAI, OpenRouter, Google, GitHub, AWS, Slack, Stripe, and named secret literals. A match aborts import and reports only the pattern ID, relative file, and line; it never emits the matched value. This detector is intentionally separate from the banned-code scanner and cannot prove the absence of every possible credential, so final evidence receives a second secret audit.

### 7.4 Biome proof

biome.json contains:

~~~json
{
  "linter": {
    "rules": {
      "correctness": {
        "useExhaustiveDependencies": "error"
      }
    }
  }
}
~~~

The importer creates a temporary React hook fixture with a deliberately missing dependency, runs pinned Biome against it, parses the JSON reporter, and requires the exact `lint/correctness/useExhaustiveDependencies` diagnostic at error severity before removing the fixture. A substring in configuration-error prose is not proof. This prevents a vacuous green caused by a renamed group, invalid configuration, disabled rule, or unsupported file.

The normal gate uses the non-mutating Biome CI command against explicit project paths.

### 7.5 Import report

import-report.md always has these six sections:

| Check | Required evidence |
|---|---|
| Float currency math | Count and locations of price-related toFixed calls and suspicious decimal arithmetic. |
| data-testid coverage | Interactive elements missing data-testid, with file and source location. |
| Typecheck baseline | Exit status and parsed error count. |
| Lint baseline | Exit status, error count, and warning count. |
| Banned patterns | Code-suppression pattern ID, path, and line. This check is not secret detection. |
| Dependencies outside platform list | package name, requested range, dependency class, and review status. |

The platform list is versioned in config/platform-dependencies.json. Unknown packages are report findings in the MVP, not automatically deleted or upgraded. The list must contain the separately reviewed specimen and harness dependencies before the acceptance baseline is approved.

Banned-pattern findings inside unowned paths (§7.6) are deliberately still listed here — the import report exists to identify what the generator got wrong, even for files the harness will never ask a fixer to touch. Only the data-testid and float-currency checks skip unowned paths, because those are behavioral checks against application code the generator does not own.

### 7.6 Ownership boundary

Modern Lovable exports are not entirely application code: TanStack Router emits a generated `*.gen.ts`/`*.gen.tsx` route tree, and shadcn/ui components are vendored verbatim under `src/components/ui/**`. Treating all of `src/**` as writable application code would let a fixer edit a file the generator overwrites on its next run, and would make the banned-pattern scanner flag generator output as if it were a product defect.

`config/unowned-paths.json` versions the default policy (each glob carries a `reason`); `harness.json`'s optional `unownedGlobs` extends it per project. `scripts/lib/ownership.mjs` compiles Unix shell globs (`**`, `*`, `?`) to RegExp and exposes `matchesAny`/`loadUnownedGlobs`. The same merged list is applied in three independent places, per GATE-011:

1. The standards scan (`scanBanned`) skips unowned paths, so generator output never appears as a gate failure.
2. `verifyProtected` denies any changed or untracked unowned path — across the full commit range and the current worktree — even though it lives under a writable glob like `src/**`. This is what stops the exclusion from becoming a hiding place: a fixer cannot achieve green by quietly editing (or introducing) a file the standards scan no longer looks at.
3. The prompt packet never renders source context from an unowned file and names the unowned globs in CONSTRAINTS, so a fixer is told not to bother.

`biome.json`'s `files.ignore` is a single-source guard: it must always be a superset of `config/unowned-paths.json`'s globs (plus `**/*.css`, since Biome 1.9's CSS linter/formatter cannot parse Tailwind 4's `@import "tailwindcss" source(none)` syntax and is disabled entirely rather than patched per project).

## 8. Component B design

### 8.1 Gate execution

gate.sh invokes gate-report.mjs, which owns the stage pipeline and atomic report write. A stage collects all diagnostics for that stage; the pipeline does not start later, more expensive stages after a failed stage.

| Stage | Command behavior | Parser |
|---|---|---|
| standards | Full filesystem scan under src, e2e, and scripts; no mutation. | Native scanner results with pattern ID, relative path, line, and a bounded diagnostic excerpt. |
| lint | Pinned Biome CI command with JSON output where available. | Biome diagnostic JSON. |
| typecheck | Project's no-emit TypeScript command. | tsc file(line,column) diagnostics plus a stable fallback record for unparsed failures. |
| build | Recorded production build command. | Structured known diagnostics when available; otherwise a project-level BUILD_EXIT rule. |
| e2e | Pinned Playwright, Chromium project only, zero normal retries. | Playwright JSON reporter. |

Playwright uses a JSON output file inside the run directory. Traces are retained only for confirmed failures. The harness performs its own single confirmation rerun, so Playwright's normal retry count remains zero.

Biome 1.9.4's JSON reporter does not match the shape an earlier draft assumed, confirmed against the real coffee specimen: `message` is an array of rich-text spans (`[{elements,content}]`, never a plain string), the flat human-readable text lives in `description`, and `location.span` is a two-element array of UTF-8 **byte** offsets into `location.sourceCode` rather than a `{start:{line,column}}` object. The parser flattens `message`/`description` to plain text and converts the byte offset to a 1-based line/column through a `Buffer`, never a direct JS string index — a character-index slice silently shifts every line after the first multi-byte character. Getting this wrong does not fail loudly: line/column both become null, so PRM-004's ±15-line source context is silently omitted for the entire lint gate rather than erroring.

### 8.2 Stable failure identity

A diagnostic is normalized as:

~~~json
{
  "failureId": "sha256:...",
  "failureClassId": "sha256:...",
  "gate": "typecheck",
  "file": "src/hooks/useCart.ts",
  "line": 42,
  "column": 9,
  "rule": "TS2345",
  "message": "Argument ...",
  "testId": null
}
~~~

`failureClassId` hashes gate, normalized repo-relative file, and rule. For Playwright, rule is the stable R1–R8 test ID. Line, column, message punctuation, absolute paths, ANSI color, timestamps, and timing are excluded. Multiple diagnostics may share one class, so `failureCount` can exceed the number of unique classes. Schema v1 retains `failureId` as a compatibility alias of `failureClassId`; consumers must not treat either field as a unique diagnostic-instance key.

The cycle failureSignature is the SHA-256 of newline-joined, sorted, unique gate/file/rule tuples. This exactly supports per-signature attempts and A → B → A oscillation detection.

### 8.3 gate-report.json

~~~json
{
  "schemaVersion": 1,
  "runId": "20260829T080000Z-a1b2c3d",
  "tier": 1,
  "commit": "a1b2c3d",
  "status": "failed",
  "failureCount": 1,
  "failureSignature": "sha256:...",
  "durationMs": 8421,
  "gates": [
    {
      "gate": "standards",
      "status": "passed",
      "durationMs": 40,
      "failures": []
    },
    {
      "gate": "lint",
      "status": "failed",
      "durationMs": 105,
      "failures": [
        {
          "failureId": "sha256:...",
          "failureClassId": "sha256:...",
          "gate": "lint",
          "file": "src/hooks/useCart.ts",
          "line": 18,
          "column": 3,
          "rule": "useExhaustiveDependencies",
          "message": "This hook does not specify all of its dependencies."
        }
      ]
    },
    {
      "gate": "typecheck",
      "status": "not_run",
      "durationMs": 0,
      "failures": []
    }
  ]
}
~~~

The final file is written to a temporary sibling, fsynced, schema-validated, then renamed. Raw stdout and stderr live under .harness/runs/RUN_ID and are not committed.

### 8.4 E2E flake boundary

When e2e first fails:

1. Extract stable failing test IDs.
2. Start a fresh application process and isolated browser context.
3. Re-run only those IDs once.
4. Feed only failures present in both runs into the cycle.

The confirmation JSON must prove that at least one test was selected and that every requested R-rule ID was selected; zero selection or a missing ID is an errored gate, never a flaky pass. If none reproduce, the cycle outcome is inconclusive_flaky, no prompt is produced, and the repository is unchanged. Mixed results retain only reproducible failures, and `discardedFailureIds` is propagated from the gate report into the durable cycle record. The fresh process/context is intentional: each test establishes its own preconditions, while R8 tests persistence by reloading within that same test. A failure that needs another test's residue is an isolation defect, not valid R8 evidence.

### 8.5 Prompt construction

The packet is plain Markdown and includes:

- `CYCLE n of 6`, where `n` is the current repair-attempt ordinal (not a global cycle counter), plus tier, commit, signature, and attempt budgets.
- First 20 normalized failures in stable order.
- Writable source context only, at ±15 lines per distinct location.
- For e2e, the rule statement, expected/actual result, and source candidates found from app stack frames or data-testid references.
- One line for each prior attempt on the current signature: attempt number, before/after SHA, changed paths, and resulting signature/count.
- Exact allowlist, protected paths, banned pattern names, the no-assertion-weakening rule, and “stop if the test is wrong” instruction.
- Truncation counts and the full gate-report path.

The packet never contains API keys, environment values, absolute home paths, complete .env files, or more than the configured 48 KiB default.

### 8.6 Dyad Mode B adapter

Before each invocation, cycle.sh writes:

- .harness/runs/RUN_ID/attempt-N/prompt.md
- .harness/runs/RUN_ID/attempt-N/before.json
- .harness/active-prompt.md as a convenience copy

It prints a short instruction:

1. Open the already imported app in Dyad 1.12.
2. Select Build mode and the declared run model.
3. Paste the packet and approve it if acceptable. A rejected/no-write proposal has no Mode B filesystem signal and ends at the invocation timeout.

The watcher records HEAD plus a status inventory containing index/worktree state and path/hash metadata for modified and untracked files. It accepts either (a) a new HEAD with a clean snapshot stable for five two-second polls or (b) a dirty snapshot stable for fifteen polls, after which the harness captures allowed changes in a commit. Multiple Dyad commits are allowed. These different quiet periods favor quick atomic commits while giving uncommitted GUI writes 30 seconds to settle.

The invocation timeout defaults to 10 minutes. Invocation wait is recorded separately and excluded from the 20-minute harness-execution budget. A rejected proposal or a model response that writes nothing is not observable through Mode B's filesystem boundary and therefore ends as `invocation_timeout`; it is never treated as green or a model correctness failure. Any partial change is rolled back and the process exits non-zero.

### 8.7 Protection model

The only default writable glob is src/**. The allowlist may be narrowed per project; widening it requires a reviewed harness.json change before a cycle starts.

Protected content includes:

- e2e/**
- scripts/**
- config/**
- schemas/**
- biome.json and biome.jsonc
- tsconfig*.json
- playwright.config.*
- package.json and package-lock.json
- AI_RULES.md
- harness.json
- .nvmrc
- .gitignore
- cycles.jsonl
- every path not explicitly writable

verify-protected.sh checks the complete before..after commit range, staged changes, unstaged changes, untracked paths, renames, file modes, symlinks, and submodule entries. A change cannot evade verification by being committed by Dyad.

The banned scanner checks filesystem content under src, e2e, and scripts for versioned pattern IDs:

- TS_IGNORE
- TS_EXPECT_ERROR
- AS_ANY
- BIOME_IGNORE
- TEST_SKIP
- TEST_ONLY
- XIT
- DESCRIBE_SKIP
- CONTINUE_ON_ERROR
- OR_TRUE

Code-token rules operate on a masked view that removes comments and string literals, while directive rules require real directive-comment syntax. Pattern definitions are stored as JSON outside the three scan roots. `scripts/lib/prompt.mjs` is the only excluded scanned file because its job requires quoting every prohibited token; it remains protected by Git verification. All other scripts are scanned, so `|| true` and similar script tampering remain structurally detectable.

### 8.8 Git transaction model

Required refs and history:

- baseline-v1: immutable normalized import.
- A committed R1–R8 red state before fixes.
- harness-green-v1: first Tier 1 green commit containing the tests.
- refs/harness/last-green: movable internal ref for the most recently verified green tree.

Normal acceptance cycles start only after harness-green-v1. The initial convergence may use an explicit bootstrap mode. If bootstrap cannot reach green, it restores the initial red cycle-start tree and escalates; it cannot claim to restore a green state that never existed.

Each safe attempt must exist as a commit. If Dyad already committed, the harness records the SHA range. If Dyad left allowed changes uncommitted, the harness creates a clearly named capture commit.

On non-bootstrap escalation:

1. Preserve the attempt metadata and red commit ancestry.
2. Remove any exact, verified untracked attempt paths.
3. Create a new commit whose tree equals refs/harness/last-green and whose parent is the current failed HEAD.
4. Append the terminal cycle record and commit the log.
5. Verify the resulting code tree equals the last-green tree, with `cycles.jsonl` as the sole audit-log difference.
6. Leave the branch clean and exit non-zero.

Bootstrap has no prior green tree. If bootstrap escalates, the same additive procedure restores the cycle-start red tree instead. No failed commit is erased and no force operation is used.

### 8.9 Termination order

Before starting an attempt, stop for an exhausted harness-execution clock. After Dyad changes the tree, verify safety before any re-gate; a violation escalates immediately.

After a completed re-gate, evaluate:

1. Gate green → success, even if the clock crossed its ceiling while that gate was running.
2. Harness-execution ceiling reached → timeout escalation before another attempt.
3. Signature occurred earlier with a different intervening signature → oscillation escalation.
4. Current signature has received 3 attempts → signature-budget escalation.
5. Total attempts reached 6 → total-budget escalation.
6. Two consecutive non-improvements in `(furthest stage index, failures in that stage)` → no-progress escalation.
7. Otherwise build the next packet.

For an identical failure set, no-progress normally stops after two attempts and therefore dominates the three-attempt signature cap. The signature cap remains a backstop when the same failure class/signature has a decreasing number of diagnostic instances. Raw aggregate failure count is retained for audit but is not compared across different fail-fast stages.

### 8.10 cycles.jsonl

Each line is independently schema-valid:

~~~json
{
  "schemaVersion": 1,
  "cycleId": "20260829T080000Z-a1b2c3d",
  "startedAt": "2026-08-29T08:00:00.000Z",
  "finishedAt": "2026-08-29T08:01:34.000Z",
  "tier": 1,
  "startCommit": "a1b2c3d",
  "endCommit": "d4e5f6a",
  "initialSignature": "sha256:...",
  "finalSignature": null,
  "signatureHistory": ["sha256:...", "sha256:...", null],
  "attemptHistory": [
    {
      "attempt": 1,
      "signature": "sha256:...",
      "beforeSha": "a1b2c3d",
      "afterSha": "b2c3d4e",
      "changedPaths": ["src/components/Cart.tsx"],
      "resultingSignature": "sha256:...",
      "failureCount": 1,
      "progress": {"stage": "e2e", "stageIndex": 4, "failureCount": 1}
    }
  ],
  "attempts": 2,
  "outcome": "green",
  "reason": "all_gates_passed",
  "durationSec": 94,
  "harnessDurationSec": 34,
  "invocationWaitSec": 60,
  "filesChanged": ["src/components/Cart.tsx"],
  "attemptedPaths": ["src/components/Cart.tsx"],
  "discardedFailureIds": [],
  "dyad": {
    "version": "1.12.0",
    "mode": "gui-build",
    "provider": "openai",
    "model": "gpt-5.6-luna",
    "reasoningEffort": "high",
    "metadataSource": "operator-declared"
  }
}
~~~

Allowed outcomes are green, escalated_safety, escalated_signature_budget, escalated_total_budget, escalated_oscillation, escalated_no_progress, escalated_timeout, invocation_timeout, inconclusive_flaky, and precondition_failed.

`signatureHistory` records every gate signature, including terminal null on green. `attemptHistory` retains one bounded summary for each invocation, including terminal invocation/safety failures without raw model text. `filesChanged` is the net code-tree difference between cycle start and terminal code commit. `attemptedPaths` retains paths touched by attempts even if additive rollback removes them. `durationSec` is elapsed wall time, while `harnessDurationSec` excludes `invocationWaitSec`. Dyad version/provider/model/effort are nullable: an undeclared run records null values with `metadataSource: undeclared`, never a guessed acceptance profile.

## 9. Spec-driven and test-driven development

### 9.1 Source-of-truth order

1. The SOW and Appendix A define product behavior.
2. This document resolves architecture and ambiguous mechanics without reducing SOW acceptance.
3. Versioned JSON schemas define machine contracts.
4. Tests prove those contracts.
5. Implementation follows tests.
6. The specimen's current behavior is evidence only; it never changes the spec.

A code change is not complete unless its requirement ID appears in a test name or traceability entry.

### 9.2 Red–green–refactor sequence

For each vertical slice:

1. Add or update a requirement and example.
2. Write the smallest failing unit or integration test.
3. Commit the red test.
4. Implement only enough behavior to pass.
5. Refactor while tests remain green.
6. Run the next wider test layer.

The R1–R8 Playwright tests are committed together before specimen source fixes. Injected defect commits are also preserved before each acceptance cycle.

### 9.3 Test layers

| Layer | What it proves | AI/network policy |
|---|---|---|
| `tests/unit` | schema validation, diagnostic parsing, scanner/protection behavior, prompt construction, capability detection, and termination decisions | No network; no model |
| `tests/integration` | import transaction/no-op, gate pipelines, E2E confirmation boundaries, and Git/process integration | Test adapters may replace npm/browser processes; no model |
| `tests/acceptance` | end-to-end deterministic cycle behavior, real Mode B watcher semantics, rollback, tamper, and SPEC inventory | No network; no model |

Product Playwright R1–R8, a live Dyad smoke, and final live SOW acceptance are evidence runs outside the deterministic `npm test` taxonomy. They use a local browser or an explicitly selected model only when the operator initiates them.

### 9.4 Required deterministic fixtures

- lovable-vite-react: a sanitized Lovable-style Vite/React export.
- lovable-vite-react-ts: a structurally different TypeScript export.
- react-custom-bundler: a non-Vite synthetic compatibility fixture proving capability detection does not assume Vite.
- diagnostics-biome, diagnostics-tsc, diagnostics-build, diagnostics-playwright.
- git-clean, git-dyad-committed, git-dyad-uncommitted, git-protected, git-symlink.
- fake-fixer-green, fake-fixer-no-progress, fake-fixer-oscillation, fake-fixer-tamper.

The fake fixer applies predefined commits or patches through the same verifier and state-machine boundary as Mode B; separate acceptance tests exercise the real interactive watcher with both commit and uncommitted-edit completion. Synthetic fixtures prove repeatability, not the SOW's final requirement for two genuine distinct Lovable exports.

### 9.5 Appendix A e2e inventory

| Test ID | Test title prefix | Key assertion |
|---|---|---|
| SPEC-R1 | R1 — empty cart shows exact message and disables checkout | Exact text and disabled state |
| SPEC-R2 | R2 — identical item and options increment one line | One line, quantity 2 |
| SPEC-R3 | R3 — different options create separate lines | Two distinct option lines |
| SPEC-R4 | R4 — decrement at quantity 1 removes the line | Line absent; quantity never zero |
| SPEC-R5 | R5 — subtotal, tax, and total follow integer-cent rules | Exact two-decimal values and rounded 8% tax |
| SPEC-R6 | R6 — checkout requires name and exactly 10 phone digits | Submit state across invalid and valid inputs |
| SPEC-R7 | R7 — submit shows valid order confirmation and matching itemized total | /^ORD-\d{6}$/, exact confirmation text, items, total |
| SPEC-R8 | R8 — cart options and quantities survive reload | coffee-cart-v1 persistence and reconstructed UI |

Selectors use data-testid for interactions the test owns. Exact user-visible strings are asserted where the SOW makes them normative.

### 9.6 SOW defect acceptance matrix

| Scenario | Required result | Structural proof |
|---|---|---|
| Item or undefined passed as Item | Green within budget | Typecheck failure disappears; no protected path changed |
| Unused import plus incomplete hook dependencies | Green within budget | Biome reports both before; useExhaustiveDependencies remains enabled |
| Removal by array index rather than item ID | Green within budget | Runtime test passes; before/after names are src/** only |
| $4.5 rather than $4.50 | Green within budget | R5 exact display passes and cents remain integers |
| Contradictory requirements | Escalation | Hard stop reason and additive rollback to clean green tree |
| Test-skip tamper bait | Immediate safety escalation | scanner identifies pattern; test/config change cannot be accepted |
| Two plausible alternating fixes | First A → B → A recurrence escalates | Signature history in cycle record |

## 10. AI provider and model policy

The harness does not need an AI key for deterministic tests. Dyad owns model calls in Mode B.

### 10.1 Owner-selected acceptance profile

~~~dotenv
DYAD_PROVIDER=openai
DYAD_MODEL=gpt-5.6-luna
DYAD_REASONING_EFFORT=high
DYAD_MODE=gui-build
~~~

This profile is an explicit project-owner choice, not a SOW requirement. [Official OpenAI documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna) lists `gpt-5.6-luna` and support for high reasoning effort. `OPENAI_API_KEY` is supplied to Dyad through its environment or provider settings and is never read into a report. A cycle records this profile only when the operator declares it; missing metadata stays null/undeclared.

### 10.2 Cheap live-smoke profile

When OPENAI_API_KEY is unavailable, an opt-in smoke run may use:

1. GOOGLE_API_KEY with a user-selected Dyad Google model, or
2. OPENROUTER_API_KEY with a user-selected low-cost model.

The provider and model must be explicit in the run command or harness metadata. No fallback silently changes the model used for an acceptance claim.

The smoke result proves the Dyad integration path only. It does not replace the owner-selected gpt-5.6-luna/high final evidence run.

### 10.3 Secret handling

- Commit .env.example only; ignore .env and provider-specific secret files.
- Never echo key values, even on provider-test failure.
- Reject source imports matching the versioned high-confidence secret detector; redact Authorization headers and supported key shapes from prompt material.
- Record provider, model, effort, Dyad version, and whether metadata was observed or operator-declared.
- Do not save a copied key into Dyad settings during automated test setup; prefer process environment. If a temporary settings key is used manually, remove it after the run.

## 11. Security and reliability rules

- Treat the Lovable export and model-produced edits as untrusted code.
- Resolve all input paths before mutation; reject target-root, parent-root, symlink, and source-equals-target cases.
- Never interpolate a project command into eval or sh -c. Commands are configured as executable plus argument arrays.
- Refuse cycles with Git locks, unresolved merges, submodules, or an initially dirty tree.
- Keep node_modules, build output, Playwright output, and .harness/runs ignored and untracked.
- Default-deny every changed path outside src/**.
- Bound output bytes, process duration, failure count, prompt size, attempts, and total cycle time.
- Terminate the spawned app process group and Chromium after every e2e run.
- Use an allocated free localhost port; never assume 5173.
- Write JSON and JSONL records atomically and validate before commit.
- Hash evidence files and use UTC ISO-8601 timestamps.
- Never interpret “green” from a model message; only the gates can produce green.

## 12. Traceability to the SOW

| SOW obligation | Design requirement | Primary proof |
|---|---|---|
| Reusable scripted import and secret refusal | IMP-001–IMP-016 | Multi-profile import integration suite plus secret canary |
| Six-check import report | IMP-011 | Report snapshot and schema tests |
| Node, lockfile, Biome, Playwright normalization | IMP-005–IMP-010 | Clean-clone and live-rule tests |
| baseline-v1 | IMP-012 | Git integration assertion |
| Deterministic pre-baseline formatting; reusable across generator layouts | IMP-017–IMP-019 | Extended importer fixture with generated/vendored/Tailwind-4/build-output content |
| Tier 0 and Tier 1 gates | GATE-001–GATE-005 | Gate pipeline tests |
| One e2e test per R1–R8 | SPEC-R1–SPEC-R8 | Playwright suite |
| Structured gate report and signature | GATE-005–GATE-007 | Schema, parser, hash-invariance tests |
| Banned scan across required roots | GATE-008 | Syntax/prose and script-tamper scanner tests |
| E2E confirmation and flake boundary | GATE-009–GATE-010 | Reproducing, disappearing, and zero-selection integration cases |
| Unowned ⇒ unscanned ⇒ unwritable invariant | GATE-011 | Scanner, protection, prompt, and gate integration tests on generated/vendored paths |
| Failure packet | PRM-001–PRM-007 | Golden prompt tests |
| Bounded loop | CYC-001–CYC-013, CYC-019 | Fake-fixer state-machine tests; concurrent-lock refusal/reclaim tests |
| Protected and banned verification | CYC-006–CYC-008, CYC-017 | Tamper acceptance test |
| Rollback without half-fixed tree | CYC-014–CYC-016 | Tree-equality and clean-status tests |
| Cycle log | CYC-016 | JSONL schema and one-record tests |
| Four fixable defect classes | Acceptance matrix | Live and deterministic acceptance records |
| Unsatisfiable, tamper, oscillation | Acceptance matrix | Three escalation records |
| Mode B no extra manual work | CYC-004–CYC-006 | Live Dyad runbook acceptance |
| Distinct terminal exit paths | CYC-018 | Timeout and precondition acceptance tests |
| FINDINGS.md and README.md | Deliverable definition | Documentation review |

## 13. Implementation order

Implementation proceeds as vertical red-green-refactor slices. For each item, add only the fixture needed to make the next requirement test fail, implement the smallest behavior that passes it, then run the next wider layer:

1. Git-state capture, path policy, syntax-aware banned scanning, and tamper cases.
2. Diagnostic normalization, gate reporting, E2E confirmation, and signature/progress semantics.
3. Import transaction, secret refusal, toolchain normalization, and profile/idempotency cases.
4. Prompt construction and schema contracts.
5. Cycle state machine, real Mode B watcher tests, budgets, and additive rollback.
6. Commit SPEC-R1–SPEC-R8 red tests, establish `harness-green-v1`, and run live evidence.
7. Complete the real two-export, clean-clone, performance, and acceptance-matrix rehearsal.

Safety verification is implemented before any AI-driven loop. The real model is introduced only after the same cycle boundary passes deterministic tamper, no-progress, and rollback tests.

## 14. MVP definition of done

The reference machine is the local environment used for final acceptance; its OS, architecture, Node/npm versions, Chromium version, and measured gate timings must be recorded in FINDINGS.md. The MVP is done only when all of the following are true:

- All IMP, GATE, PRM, CYC, and SPEC requirements have passing automated tests.
- Both distinct Lovable exports import without importer edits.
- Both second imports produce no diff.
- A clean clone passes npm ci and npm run build.
- baseline-v1, the red spec-test commit, and harness-green-v1 are present.
- Tier 0 meets a recorded seconds-scale target and Tier 1 a recorded low-minutes target on the reference machine.
- The four fixable acceptance defects reach green within budget.
- Unsatisfiable, tamper, and oscillation cases escalate for the expected reason.
- Every non-bootstrap escalation leaves a clean repository whose code tree equals `refs/harness/last-green`; `cycles.jsonl` may differ as audit data. A failed bootstrap instead restores its initial red tree.
- cycles.jsonl has exactly one accurate record for each acceptance cycle.
- gate-report.json, cycles.jsonl, and harness.json validate against their schemas.
- A live Mode B run requires no manual step beyond the Dyad invocation and proposal approval.
- The owner-selected final live evidence declares Dyad 1.12, OpenAI gpt-5.6-luna, and high effort; the SOW itself does not mandate a provider/model.
- No secret is committed or present in captured evidence.
- README.md lets a new operator import, run, inject, and interpret a cycle.
- FINDINGS.md records observed attempt counts, model metadata, handled and unhandled defects, and the exact work needed for unattended operation.

## 15. Post-MVP product backlog

Only after the definition of done:

- A headless Dyad adapter if Dyad publishes a supported non-interactive contract.
- A small local UI showing import readiness, current prompt, cycle history, and escalation evidence.
- Additional framework and package-manager profiles.
- CI adapters and artifact upload.
- Multi-project registration and isolated workspace provisioning.
- Reviewed dependency-policy workflows.
- Cost/token telemetry and controlled provider fallback.
- Richer source mapping for browser failures.
- Automatic tuning recommendations based on accumulated cycle data.

These are user-visible improvements, not hidden prerequisites. None may delay or dilute the safety-complete MVP.
