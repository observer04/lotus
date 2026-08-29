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

The design uses observed behavior, not an assumed Dyad API.

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
- Two distinct Lovable export fixtures and all six SOW defect scenarios, including oscillation.

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

## 4. Normative requirements

The IDs below are the source of truth for implementation and test names.

### 4.1 Import requirements

- IMP-001: scripts/import-lovable.sh SOURCE imports a local path or Git URL into the current harness repository.
- IMP-002: the target and source paths must differ, resolve below their expected roots, and be free of symlink escapes.
- IMP-003: the target must be clean before the first import and before any re-import.
- IMP-004: .git, node_modules, build output, local environment files, and source secrets are never copied.
- IMP-005: a missing lockfile is generated before npm ci; npm ci is never attempted first when no lockfile exists.
- IMP-006: Node is pinned by .nvmrc and package.json engines from one version constant.
- IMP-007: Biome is version-pinned and useExhaustiveDependencies is error severity.
- IMP-008: a smoke fixture proves useExhaustiveDependencies actually fails; configuration presence alone is insufficient.
- IMP-009: Playwright is version-pinned and installs Chromium only.
- IMP-010: harness.json and all required scaffolding are produced deterministically.
- IMP-011: import-report.md contains all six SOW checks, each with status, count, and evidence.
- IMP-012: baseline-v1 is created only after normalization and is never moved automatically.
- IMP-013: a second run against unchanged input exits zero and produces no tracked or untracked diff.
- IMP-014: a clean clone passes npm ci and npm run build.
- IMP-015: two distinct Lovable exports pass the same importer without script modification.

### 4.2 Gate requirements

- GATE-001: scripts/gate.sh accepts only tier 0 or 1 and exits non-zero for failed, errored, or inconclusive gates.
- GATE-002: tier 0 orders standards, lint, typecheck, then build.
- GATE-003: tier 1 runs tier 0 and then Chromium Playwright.
- GATE-004: stage fail-fast is preserved; later stages are recorded as not_run in the aggregate report.
- GATE-005: every invocation atomically replaces gate-report.json with a schema-valid report.
- GATE-006: diagnostics have stable failure identities independent of line-number movement and output ordering.
- GATE-007: the failure signature is SHA-256 over sorted unique gate/file/rule tuples.
- GATE-008: the banned scan examines project source and tests, never its own pattern-definition source.
- GATE-009: a first-red e2e failure is rerun once by failing test ID before it can enter a fix loop.
- GATE-010: a non-reproducible e2e failure is inconclusive and is never sent to Dyad.

### 4.3 Prompt requirements

- PRM-001: scripts/build-prompt.sh accepts a schema-valid failed gate report only.
- PRM-002: output ordering is deterministic.
- PRM-003: the packet contains the first 20 failures and marks truncation.
- PRM-004: source context is limited to 15 lines before and after a writable source location.
- PRM-005: prior attempts on the current signature are included without model secrets or full conversation history.
- PRM-006: constraints name protected paths, banned patterns, and the writable allowlist.
- PRM-007: the complete packet has a configurable byte ceiling and records any truncation.

### 4.4 Cycle requirements

- CYC-001: scripts/cycle.sh TIER refuses to start from a dirty repository.
- CYC-002: it runs gates before asking Dyad to change anything.
- CYC-003: a green initial gate records a zero-attempt green cycle.
- CYC-004: in Mode B it writes the prompt packet, displays its path, and waits for a Dyad-created Git state change.
- CYC-005: completion requires a changed HEAD and a clean, stable worktree for three consecutive polls. The default poll interval is two seconds.
- CYC-006: the verifier compares the entire before/after SHA range and current worktree.
- CYC-007: every allowed uncommitted change is captured in a harness attempt commit before re-gating.
- CYC-008: any path outside the writable allowlist, any banned pattern, symlink, submodule, or protected mode change escalates immediately.
- CYC-009: attempts per signature stop at 3.
- CYC-010: total attempts stop at 6.
- CYC-011: an A → B → A signature recurrence stops on the first recurrence.
- CYC-012: two consecutive results whose failure count does not decrease stop as no progress.
- CYC-013: the default wall-clock ceiling is 20 minutes and is configurable.
- CYC-014: escalation restores the code tree to the last verified green tree through a new additive commit, never git reset --hard.
- CYC-015: failed attempt commits and injected red commits remain ancestors and therefore remain inspectable.
- CYC-016: every terminal path appends exactly one schema-valid line to cycles.jsonl and leaves a clean tree.
- CYC-017: safety verification runs before every re-gate.
- CYC-018: the exit code distinguishes green, precondition failure, flaky/inconclusive, invocation timeout, and escalation.

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
│       ├── prompt.mjs
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

Bash files are stable entrypoints and process orchestrators. Parsing, hashing, JSON, schemas, prompt rendering, and state-machine decisions live in Node modules. Shell scripts use arrays, quoted paths, set -euo pipefail, and no eval.

## 7. Component A design

### 7.1 Transaction and idempotency

Import uses a temporary staging directory. It never partially overlays the target:

1. Resolve and validate source.
2. Clone or copy into staging using a fixed exclusion list.
3. Compute source identity from normalized relative paths and file hashes.
4. Generate the intended target overlay in staging.
5. Validate install, tooling, build, and report in staging.
6. Apply the validated overlay to the clean target.
7. Commit once and create baseline-v1.

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

### 7.3 Biome proof

biome.json contains:

~~~json
{
  "linter": {
    "domains": { "react": "recommended" },
    "rules": {
      "correctness": {
        "useExhaustiveDependencies": "error"
      }
    }
  }
}
~~~

The importer creates a temporary React hook fixture with a deliberately missing dependency, runs pinned Biome against it, asserts the expected rule ID is present with error severity, then removes the fixture. This prevents a vacuous green caused by a renamed group, disabled domain, or unsupported file.

The normal gate uses the non-mutating Biome CI command against explicit project paths.

### 7.4 Import report

import-report.md always has these six sections:

| Check | Required evidence |
|---|---|
| Float currency math | Count and locations of price-related toFixed calls and suspicious decimal arithmetic. |
| data-testid coverage | Interactive elements missing data-testid, with file and source location. |
| Typecheck baseline | Exit status and parsed error count. |
| Lint baseline | Exit status, error count, and warning count. |
| Banned patterns | Pattern ID, path, and line; never the raw secret-like content around it. |
| Dependencies outside platform list | package name, requested range, dependency class, and review status. |

The platform list is versioned in config/platform-dependencies.json. Unknown packages are report findings in the MVP, not automatically deleted or upgraded. The list must contain the separately reviewed specimen and harness dependencies before the acceptance baseline is approved.

## 8. Component B design

### 8.1 Gate execution

gate.sh invokes gate-report.mjs, which owns the stage pipeline and atomic report write. A stage collects all diagnostics for that stage; the pipeline does not start later, more expensive stages after a failed stage.

| Stage | Command behavior | Parser |
|---|---|---|
| standards | Full scan of tracked src and e2e files; no mutation. | Native scanner results. |
| lint | Pinned Biome CI command with JSON output where available. | Biome diagnostic JSON. |
| typecheck | Project's no-emit TypeScript command. | tsc file(line,column) diagnostics plus a stable fallback record for unparsed failures. |
| build | Recorded production build command. | Structured known diagnostics when available; otherwise a project-level BUILD_EXIT rule. |
| e2e | Pinned Playwright, Chromium project only, zero normal retries. | Playwright JSON reporter. |

Playwright uses a JSON output file inside the run directory. Traces are retained only for confirmed failures. The harness performs its own single confirmation rerun, so Playwright's normal retry count remains zero.

### 8.2 Stable failure identity

A diagnostic is normalized as:

~~~json
{
  "failureId": "sha256:...",
  "gate": "typecheck",
  "file": "src/hooks/useCart.ts",
  "line": 42,
  "column": 9,
  "rule": "TS2345",
  "message": "Argument ...",
  "testId": null
}
~~~

The failureId input is gate, normalized repo-relative file, and rule. For Playwright, rule is the stable R1–R8 test ID. Line, column, message punctuation, absolute paths, ANSI color, timestamps, and timing are excluded.

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

If none reproduce, the cycle outcome is inconclusive_flaky, no prompt is produced, and the repository is unchanged. Mixed results retain only reproducible failures and record discarded IDs.

### 8.5 Prompt construction

The packet is plain Markdown and includes:

- Cycle number, tier, commit, signature, and attempt budgets.
- First 20 normalized failures in stable order.
- Writable source context only, at ±15 lines per distinct location.
- For e2e, the rule statement, expected/actual result, and source candidates found from app stack frames or data-testid references.
- One line for each prior attempt on the current signature: attempt number, before/after SHA, changed paths, and resulting signature/count.
- Exact allowlist, protected paths, banned pattern names, and “stop if the test is wrong” instruction.
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
3. Paste the packet and approve or reject the proposal.

The watcher records HEAD, index tree, tracked worktree hash, and untracked path/hash inventory. A normal completion is a new HEAD followed by a clean repository that remains unchanged for three polls. Multiple Dyad commits are allowed.

An invocation timeout is not treated as green or as a model failure. It is logged distinctly, rolled back if a partial change exists, and exits non-zero.

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

The banned scanner checks tracked src and e2e content for versioned pattern IDs:

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

Pattern definitions are stored as data and the scanner itself is outside the scan scope, preventing the SOW's self-match problem. scripts/** remains protected by Git verification.

### 8.8 Git transaction model

Required refs and history:

- baseline-v1: immutable normalized import.
- A committed R1–R8 red state before fixes.
- harness-green-v1: first Tier 1 green commit containing the tests.
- refs/harness/last-green: movable internal ref for the most recently verified green tree.

Normal acceptance cycles start only after harness-green-v1. The initial convergence may use an explicit bootstrap mode. If bootstrap cannot reach green, it restores the initial red cycle-start tree and escalates; it cannot claim to restore a green state that never existed.

Each safe attempt must exist as a commit. If Dyad already committed, the harness records the SHA range. If Dyad left allowed changes uncommitted, the harness creates a clearly named capture commit.

On escalation:

1. Preserve the attempt metadata and red commit ancestry.
2. Remove any exact, verified untracked attempt paths.
3. Create a new commit whose tree equals refs/harness/last-green and whose parent is the current failed HEAD.
4. Append the terminal cycle record and commit the log.
5. Verify the code tree still equals the last green tree, excluding audit-only log data.
6. Leave the branch clean and exit non-zero.

This is additive rollback. No failed commit is erased and no force operation is used.

### 8.9 Termination order

After every attempt, evaluate in this order:

1. Protected-path or banned-pattern violation → safety escalation.
2. Wall-clock ceiling reached → timeout escalation.
3. Gate green → success.
4. Signature occurred earlier with a different intervening signature → oscillation escalation.
5. Current signature has received 3 attempts → signature-budget escalation.
6. Total attempts reached 6 → total-budget escalation.
7. Failure count failed to decrease for 2 consecutive results → no-progress escalation.
8. Otherwise build the next packet.

The failure count rule is intentionally enforced exactly as the SOW states. Additional quality signals may be logged but cannot weaken a hard stop.

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
  "attempts": 2,
  "outcome": "green",
  "reason": "all_gates_passed",
  "durationSec": 94,
  "filesChanged": ["src/components/Cart.tsx"],
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
| Unit | path normalization, schema validation, diagnostic parsing, failure hashing, prompt ordering/truncation, termination decisions | No network; no model |
| Component | banned scanner, protected diff verification, capability detection, report generation | No network; no model |
| Integration | import transaction, second-run no-op, clean clone build, Git commit-range capture, additive rollback | Package install may use npm; no model |
| Harness acceptance | deterministic fake fixer reaches green, no-op stops, A/B oscillation stops, tamper stops, logs remain accurate | No model |
| Product e2e | one Playwright test for each SPEC-R1–SPEC-R8 | Local browser only |
| Live Dyad smoke | one bounded source edit in Dyad Build mode using a cheap configured provider | Opt-in only |
| Live SOW acceptance | all required defect cycles with the declared end-use Dyad profile | Opt-in, operator initiated |

### 9.4 Required deterministic fixtures

- lovable-vite-react: a sanitized Lovable-style Vite/React export.
- lovable-vite-react-ts: a structurally different TypeScript export.
- diagnostics-biome, diagnostics-tsc, diagnostics-build, diagnostics-playwright.
- git-clean, git-dyad-committed, git-dyad-uncommitted, git-protected, git-symlink.
- fake-fixer-green, fake-fixer-no-progress, fake-fixer-oscillation, fake-fixer-tamper.

The fake fixer applies predefined commits or patches through the same watcher and verifier boundary as Mode B. It is not a separate shortcut around the cycle state machine.

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

### 10.1 End-use acceptance profile

~~~dotenv
DYAD_PROVIDER=openai
DYAD_MODEL=gpt-5.6-luna
DYAD_REASONING_EFFORT=high
DYAD_MODE=gui-build
~~~

OPENAI_API_KEY is supplied to Dyad through its environment or provider settings and is never read into a report. The model ID and high effort are consistent with the tested Dyad 1.12 catalog and the [official OpenAI model contract](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

### 10.2 Cheap live-smoke profile

When OPENAI_API_KEY is unavailable, an opt-in smoke run may use:

1. GOOGLE_API_KEY with a user-selected Dyad Google model, or
2. OPENROUTER_API_KEY with a user-selected low-cost model.

The provider and model must be explicit in the run command or harness metadata. No fallback silently changes the model used for an acceptance claim.

The smoke result proves the Dyad integration path only. It cannot replace the required gpt-5.6-luna/high acceptance run.

### 10.3 Secret handling

- Commit .env.example only; ignore .env and provider-specific secret files.
- Never echo key values, even on provider-test failure.
- Redact Authorization headers and key-shaped strings from captured logs.
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
| Reusable scripted import | IMP-001–IMP-015 | Two-export integration suite |
| Six-check import report | IMP-011 | Report snapshot and schema tests |
| Node, lockfile, Biome, Playwright normalization | IMP-005–IMP-010 | Clean-clone and live-rule tests |
| baseline-v1 | IMP-012 | Git integration assertion |
| Tier 0 and Tier 1 gates | GATE-001–GATE-005 | Gate pipeline tests |
| One e2e test per R1–R8 | SPEC-R1–SPEC-R8 | Playwright suite |
| Structured gate report and signature | GATE-005–GATE-007 | Schema, parser, hash-invariance tests |
| Failure packet | PRM-001–PRM-007 | Golden prompt tests |
| Bounded loop | CYC-001–CYC-013 | Fake-fixer state-machine tests |
| Protected and banned verification | CYC-006–CYC-008, CYC-017 | Tamper acceptance test |
| Rollback without half-fixed tree | CYC-014–CYC-016 | Tree-equality and clean-status tests |
| Cycle log | CYC-016 | JSONL schema and one-record tests |
| Four fixable defect classes | Acceptance matrix | Live and deterministic acceptance records |
| Unsatisfiable, tamper, oscillation | Acceptance matrix | Three escalation records |
| Mode B no extra manual work | CYC-004–CYC-006 | Live Dyad runbook acceptance |
| FINDINGS.md and README.md | Deliverable definition | Documentation review |

## 13. Implementation order

The order follows dependency and test boundaries:

1. Commit schemas, requirement-ID test conventions, and deterministic fixtures.
2. Implement Git-state capture, path policy, banned scan, and their tamper tests.
3. Implement diagnostic normalization, gate report, and signature tests.
4. Implement tier 0 gates; prove Biome's hook rule with the smoke fixture.
5. Implement the importer and prove two-export idempotency plus clean-clone build.
6. Add Chromium Playwright infrastructure and commit SPEC-R1–SPEC-R8 red tests.
7. Implement prompt construction with golden tests.
8. Implement the cycle state machine against the fake fixer.
9. Establish harness-green-v1 with tests present.
10. Run the real Dyad Mode B smoke and document FINDINGS.md.
11. Inject and run every SOW acceptance scenario using gpt-5.6-luna/high for final live evidence.
12. Complete README.md, validate logs, and perform a clean-machine rehearsal.

Safety verification is implemented before any AI-driven loop. The real model is introduced only after the same cycle boundary passes deterministic tamper, no-progress, and rollback tests.

## 14. MVP definition of done

The MVP is done only when all of the following are true:

- All IMP, GATE, PRM, CYC, and SPEC requirements have passing automated tests.
- Both distinct Lovable exports import without importer edits.
- Both second imports produce no diff.
- A clean clone passes npm ci and npm run build.
- baseline-v1, the red spec-test commit, and harness-green-v1 are present.
- Tier 0 meets a recorded seconds-scale target and Tier 1 a recorded low-minutes target on the reference machine.
- The four fixable acceptance defects reach green within budget.
- Unsatisfiable, tamper, and oscillation cases escalate for the expected reason.
- Every escalation restores code to the verified green tree and leaves git status clean.
- cycles.jsonl has exactly one accurate record for each acceptance cycle.
- gate-report.json, cycles.jsonl, and harness.json validate against their schemas.
- A live Mode B run requires no manual step beyond the Dyad invocation and proposal approval.
- Final live evidence declares Dyad 1.12, OpenAI gpt-5.6-luna, and high effort.
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
