# Dyad 1.12 Mode B capability spike evidence

Captured: 2026-08-29 (Asia/Kolkata)

This is a minimum, sanitized retention of the local capability spike. It contains no API keys, prompts, model responses, or application source.

## Installation and startup

- `dpkg-query -W dyad` returned `dyad 1.12.0`.
- `/usr/bin/dyad` resolves to `/usr/lib/dyad/dyad`.
- Dyad's main log recorded: `Dyad started | ... | 1.12.0 | linux x64 | electron 40.0.0 | node 24.11.1`.
- The log records one earlier native browser `SIGSEGV`; a later launch proceeded through the successful edit below. Stability therefore remains a live-run observation to watch, not an assumed property.

## Imported-project and edit boundary

- Dyad's local `apps` table contained one in-place project named `dyad-112-spike` at `/home/op/projects/lotus/tmp/dyad-spike/app`.
- The runtime log recorded Vite becoming ready.
- The proposal log recorded one generated code proposal, title `Updating probe status text`, with one file and zero packages.
- The approval log recorded `approve-proposal` followed by `Successfully committed changes: wrote 1 file(s)`.
- Dyad also reported `extraFiles:["node_modules/.vite/"]`, proving that an otherwise correct request can collect unrelated runtime changes and that default-deny Git verification is required.

## Provider/model observations

- The run log loaded Google's built-in provider catalog and listed `gemini-3.7-flash` / `Gemini 3.7 Flash`.
- The installed application bundle contains the exact model identifier `gpt-5.6-luna`; official OpenAI documentation independently lists high reasoning effort for that model.
- This artifact does not prove that a final `gpt-5.6-luna`/high SOW cycle ran. That remains required owner-selected acceptance evidence.

## Source artifact fingerprints

The unredacted source artifacts remain local and outside Git because they can contain private application/provider state:

- `/home/op/.config/dyad/logs/main.log`: SHA-256 `3a2133e96f3ef9ed9b9524fd92c8e22292b0a99a7d9fc677c08919880001884c` at capture, 147409 bytes.
- `/home/op/.config/dyad/sqlite.db`: SHA-256 `99295ae24b3cb6df7ee86bc84d86099d6560bed6195377175e2b519e4deb8955` at capture, 233472 bytes.

The fingerprints are point-in-time identifiers; Dyad may append to or update these files later.
