# AI editing rules

This repository is controlled by an external test/fix harness.

During a repair cycle, source edits are allowed only under `src/**`.

Do not modify tests, harness scripts, package metadata, configuration, schemas, lockfiles, Git settings, or audit logs.

Never suppress a failure with `@ts-ignore`, `@ts-expect-error`, `as any`, `biome-ignore`, skipped/only tests, `continue-on-error`, or `|| true`.

Fix the source cause. If a test or requirement is genuinely contradictory or wrong, stop and say so rather than weakening it.

These rules are advisory. The harness enforces the same boundary structurally.
