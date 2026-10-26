# Changelog

## 0.1.0 — 2026-10-26

Initial release.

- Three tools for Coo: `nmem_search` (hybrid memory search with id/title/similarity/excerpt), `nmem_get` (read one memory in full), `nmem_save` (create a memory, or upsert an existing one by `id`); saves always carry provenance (`source: coopanion`, `source_app: cortico-world-nmem`, configurable `agent_id`, default label `coopanion`).
- Four configuration knobs under `worlds.nmem.*`: `baseUrl` (restart to apply), `searchLimit`, `searchMode`, `agentId` (hot).
- Typed, framework-agnostic REST client for Nowledge Mem: local key-free by default, remote/key-enabled via `NMEM_API_KEY` in Coopanion's deployment `.env`; auth header only sent when a key is configured; bounded retries with dual-form `Retry-After` parsing and a fail-fast cap; fixed-wording failure receipts that never leak upstream error bodies.
- Environment prompt strategy: Coo keeps maintaining its built-in `PARTNER.md` workspace while also saving durable takeaways to Mem (parallel write).
- Opt-in contract tests against a real local Mem (fixed probe id, read-back verification, automatic cleanup); offline unit suite of 111 cases; engineering gate (`code-harness`) clean at 0 findings.
- Verified against Coopanion 0.2.10 (Cortico world contract `api: 6`) and Nowledge Mem 0.10.108 on macOS. Remote mode is configuration-ready but not field-verified.

[MIT](LICENSE)
