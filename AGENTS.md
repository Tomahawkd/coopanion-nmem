# AGENTS.md

Engineering policy for this repository. Read the shared engineering standards per rule 1 before changing or reviewing code.

1. Before changing or reviewing code, read `../codeharness/docs/engineering-standards.md` (a sibling checkout of the code-harness repository; covers TypeScript).
2. Type fidelity: concrete types end to end; Mem responses are narrowed once at the client ingress; no `any`/`unknown` widening, assertions, or serialization round trips to bypass boundaries; `JSON.stringify` is allowed only at the client's HTTP request-body exit (if the gate does not recognize it, add a declaration per `docs/dev/coopanion-mem-plugin/architecture.md` §4.1 instead of bypassing).
3. Architecture boundaries are defined by `.codeharness/code-harness.json` and must stay consistent with the implementation; policy changes require a full audit plus architecture review.
4. Before completing work, run: `pnpm typecheck` (`tsc --noEmit` — the gate performs no type inference, so a TypeScript project must have a type-aware checker), `pnpm test` (vitest run), `pnpm test:coverage` (v8; statement/branch reports and gap review are delivery evidence; no thresholds configured), and (once the codeharness environment is ready) from `../codeharness`: `uv run --no-sync code-harness --root <absolute path of this repository> --all`. Mutation evidence supplements but does not replace coverage measurement; both are recorded in the worklog.
5. **Never automatically roll back, revert, discard, or delete code changes**; the gate stays read-only; do not manufacture a pass by excluding files, raising thresholds, or refreshing baselines.
6. No implementation comments or suppression comments (the only JS/TS exception: an approved next-line diagnostic suppression, with the exact rule ID and rationale).
7. Keep `describe.json` in sync with tool declarations (guarded by a consistency test); passing dry-mount/check does not mean the network path works (`check:extension` does not verify real services).
8. Secret reads follow the framework's `ctx.secret()` semantics (process environment variables take priority over the deployment `.env`; `NMEM_API_KEY`); the key must still never enter config.json, logs, tool receipts, or test snapshots.
