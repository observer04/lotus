# Findings

## Dyad capability spike

Reference environment: Dyad 1.12.0 stable on Linux x64.

- No supported public CLI/headless prompt invocation was found. The MVP therefore uses Mode B.
- Existing projects can be imported in place, so Dyad and the harness can operate on the same Git working tree.
- Build mode is required. Agent mode is intentionally excluded because it owns an inner test/fix loop that would hide intermediate attempts from this harness.
- Build mode proposals require operator approval.
- Dyad may create Git commits for approved edits. The harness verifies the complete before/after SHA range and the current working tree.
- `AI_RULES.md` is advisory. Default-deny Git verification and banned-pattern scanning are authoritative.

## SOW ambiguities resolved

- A missing npm lockfile is generated before `npm ci`.
- The banned scanner does not scan its own pattern-definition source.
- All fixer changes are default-deny except the configured writable allowlist (`src/**` by default).
- Rollback is additive and preserves failed commits in ancestry.
- Initial convergence is an explicit bootstrap case because no verified green ref exists yet.
- The referenced platform dependency list was absent from the SOW, so it is a versioned report-only policy under `config/`.

## Acceptance evidence

Deterministic tests are model-free. Final live Dyad runs are recorded here after execution on the reference machine.
