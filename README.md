# cortico-world-nmem

**English** | [简体中文](README.cn.md)

A Cortico World extension (`kind: world`, `api: 6`, TypeScript / ESM, zero runtime dependencies) that connects [Coopanion](https://github.com/Pal-AI-Lab/Coopanion)'s desktop pet Coo to a Nowledge Mem knowledge base.

It bridges Coo and Nowledge Mem in both directions: **read** — Coo searches and reads Mem when it needs to recall something; **write** — durable facts, preferences, and decisions from the conversation can be saved into Mem. Coo's built-in `PARTNER.md` working memory is untouched; the two memory systems are maintained in parallel.

The World only provides tools; when to call them is Coo's own decision (the framework offers no conversation-write hook, and a World cannot read Coo's memory).

## The three tools

| Tool | Access | Purpose | Key parameters |
| --- | --- | --- | --- |
| `nmem_search` | read | Hybrid search over Mem; returns id, title, similarity, and an excerpt | `query` (required, 1–500 chars); `limit` (1–10, defaults to `searchLimit`); `mode` (`fast`/`deep`, defaults to `searchMode`) |
| `nmem_get` | read | Read one memory in full by id | `id` (required) |
| `nmem_save` | write | Save a memory; with an `id`, updates the existing memory via server-side upsert | `content` (required, 1–30000 chars); `title?`; `unit_type?`; `labels?`; `id?`; `importance?` |

`nmem_save` always writes provenance fields: `source: "coopanion"`, `source_app: "cortico-world-nmem"`, and `agent_id` (taken from the `agentId` knob, default `coopanion`), and merges the label `coopanion` by default. The save receipt reports the `id` and the `action` (`created` or `updated`).

## Prerequisites

- **Coopanion ≥ 0.2.10** (verified against 0.2.10).
- A running **Nowledge Mem**; default local API base `http://127.0.0.1:14242` (verified against 0.10.108).
- A local Mem needs no API key; a remote or key-enabled Mem additionally requires `NMEM_API_KEY` (see below).

## Install (three steps)

1. Open Coopanion's **Settings → Advanced mode → Extensions page**, pick this repository directory under the **local** section, and click **Install** (the package is installed via `link`).
2. **Restart process** (restarts the Coopanion process; equivalent to `POST /api/run/restart`) so the new extension is loaded.
3. Enable `nmem` in the **World overview** (it defaults to `enabled: false`).

Once enabled, the three tools are available to Coo and a single `nmem.started` event appears in the event stream.

## Configuration (four knobs)

All knobs live under the `worlds.nmem.*` section and can be edited on the settings page or via `POST /api/config` (group `world:nmem`).

| Knob | Type / default | Effect | Notes |
| --- | --- | --- | --- |
| `worlds.nmem.baseUrl` | string / `http://127.0.0.1:14242` | **restart required** | Mem HTTP API base. Use `https://<host>` for remote. |
| `worlds.nmem.searchLimit` | integer 1..10 / `5` | hot | Default hit count for `nmem_search` when `limit` is omitted. |
| `worlds.nmem.searchMode` | `fast` \| `deep` / `fast` | hot | Default mode for `nmem_search`; overridable per call. `fast` is recommended for interactive use. |
| `worlds.nmem.agentId` | string / `coopanion` | hot | The `agent_id` provenance marker written to Mem. |

`agentId` must satisfy Mem's agent profile id constraints: **start with a lowercase letter or digit; contain only lowercase letters, digits, and `_` `.` `:` `-`**. The plugin's configuration surface declares `pattern: "^[a-z0-9][a-z0-9_.:-]*$"`, but the current framework (form and Core) does not enforce the pattern — **the server is authoritative**: an invalid value (for example a Chinese displayName) is rejected by Mem with `422` and the `nmem_save` receipt reports failure.

## Secrets (API key)

A remote or key-enabled Mem requires an API key. This extension has **no panel**; the key is written manually into Coopanion's deployment `.env`:

- Path: `~/Library/Application Support/Coopanion/home/companion/.env`
- Create the file if missing and add one line: `NMEM_API_KEY=nmem_...`
- The value must not contain whitespace (the framework's `storeSecret` rejects values with whitespace; CLI/manual writes should follow the same rule).
- Key reads follow the framework's `ctx.secret()` semantics: **the process environment variable `NMEM_API_KEY` takes priority, then the deployment `.env`** (consistent with the nmem CLI precedence); the key is **never written to `config.json`, never logged, and never echoed in tool receipts or error messages**.
- Do not configure a key against a local key-free Mem: a local server returns `401` when presented a wrong key. When no key is configured, the client sends **no** `Authorization` header at all.

After writing `.env`, restart Coopanion so the client picks up the new key (the client is constructed when the World is created); **this note holds only when no `NMEM_API_KEY` variable exists in the process environment** — if the host environment already sets it, that value wins and a rotated key in `.env` is shadowed.

## Remote mode (not field-verified)

This release was only accepted against a local Mem (decision D9); **the remote path is not field-verified**. The steps below are configuration guidance, not verified conclusions.

Two-step configuration:

1. Change `worlds.nmem.baseUrl` to `https://<host>` on the settings page, then restart Coopanion (`baseUrl` is not hot).
2. Write `NMEM_API_KEY=nmem_...` into the deployment `.env`, then restart once more so the client carries the key.

Equivalent settings via the Nowledge Mem CLI (two **separate** invocations, not one call with both flags):

```bash
nmem config client set --url https://<host>
nmem config client set --api-key nmem_...
```

Always enable a key in remote mode: if the remote endpoint requires authentication, a missing key yields `401` (the tool receipt reports an authentication failure).

## Security notes

- The local Nowledge Mem `nmem-server` was observed listening on **`*:14242` (all interfaces)**, not just `127.0.0.1`. Other devices on the same network can reach that API. **Mind this exposure on untrusted networks** (restrict it with a host firewall, or switch to loopback-only listening).
- Always enable an API key in remote mode (see above).
- Request destinations: the **first request** this extension sends goes to the configured `baseUrl`; however, Node `fetch` follows server redirects by default (such as `307`), in which case **the request body is forwarded to the redirect target** (the Authorization header is not forwarded cross-origin). Use this extension only against a **trusted Mem server** (the local default qualifies); for remote setups, confirm the server is trustworthy. The extension never echoes the key in logs or receipts.

## Acceptance runbook (scenarios A–D; E not executed this release)

For each scenario, keep two kinds of evidence: Coo's behavior records (session function calls and receipts) and Mem-side verification output (e.g. `GET /memories/{id}`). Commands below use the default local address.

### Scenario A: read recall hit

1. Seed one distinctive fact, for example:
   ```bash
   curl -s -X POST http://127.0.0.1:14242/memories -H 'Content-Type: application/json' \
     -d '{"id":"coopanion-nmem-accept-a","content":"The user'"'"'s cat is named Pixel","labels":["coopanion","acceptance"],"source":"coopanion","source_app":"cortico-world-nmem","agent_id":"coopanion"}'
   ```
2. Ask Coo: "What is my cat's name?"
3. Expected: Coo calls `nmem_search` and cites "Pixel" in the answer. Afterwards, clean up the seeded entry with `DELETE /memories/coopanion-nmem-accept-a`.

### Scenario B: write persistence

1. Tell Coo one new durable fact and ask it to remember.
2. Expected: Coo calls `nmem_save`; the entry is findable in Mem with `labels` containing `coopanion`, `source` equal to `coopanion`, and `metadata.agent_id` equal to `coopanion`.
3. Ask Coo to amend the same fact: expected to upsert with **the same `id`** (receipt `action: updated`) rather than creating a second entry.

### Scenario C: disconnection

1. Fully quit Nowledge Mem (service unreachable).
2. Ask Coo a memory question.
3. Expected: the tool receipt is `failed` ("Nowledge Mem 不可达:请确认 Mem 正在运行,且 baseUrl 配置正确。"); Coo briefly reports that Mem is unavailable and continues the conversation; the Coopanion process neither crashes nor hangs.
4. After restarting Mem, the next turn works again.

### Scenario D: hot knob changes

1. Change `worlds.nmem.searchLimit` (e.g. 5 → 2) and `worlds.nmem.searchMode` (`fast` → `deep`) **without restarting**; the next `nmem_search` call should reflect both (different hit count; higher latency in `deep`).
2. Set `baseUrl` to a wrong value and restart Coopanion; expected behavior matches scenario C (connection failure → `failed` receipt, stable process).
3. Restore the default `baseUrl` and restart again.

### Scenario E: remote

Not executed this release (unverified; see the "Remote mode" section).

## Contract tests (against a real local Mem, opt-in)

`tests/contract.nmem.test.ts` talks to a real Mem service via the global `fetch` and does not import package sources, so it stays outside the default `pnpm test` assertion surface: **without the gate variable, every case is skipped** (shown explicitly as skipped in the vitest report).

```bash
NMEM_CONTRACT_BASE_URL=http://127.0.0.1:14242 npx -y pnpm@11.28.6 vitest run tests/contract.nmem.test.ts
```

- Without `NMEM_CONTRACT_BASE_URL`, all cases skip; with it set but the service unreachable, cases **fail** with a clear error (never a silent skip). An empty string falls back to the default `http://127.0.0.1:14242`.
- Coverage: `GET /health` liveness; authentication against a **data** endpoint (invalid key → `401`, no header → `200`; the health endpoint is unauthenticated and must not be used to verify auth); per-element shape of `POST /memories/search` `fast` results (`memory` may be `null`; `similarity_score` is numeric) and an informational `deep` latency record (no threshold assertion).
- Sandboxed write-read-back: fixed probe id **`coopanion-nmem-contract-probe`** (labels `coopanion,contract-test`; provenance fields identical to the plugin's write path), asserting `action ∈ {created, updated}`, read-back content and `metadata` provenance, then `DELETE /memories/{id}` automatic cleanup with a follow-up `404` assertion. Repeated runs do not accumulate data.
- `agent_id` rule: the default `coopanion` saves fine (covered above); the Chinese sample `大肥鱼` is asserted to yield `422` from Mem (a response-body excerpt is printed as evidence).
- The contract tests write to a real Mem, but only via the fixed probe id above; the `DELETE` cleanup runs **only after all assertions pass** (a run interrupted by a failure may leave one fixed-id probe behind; the next run overwrites the same id and cleans up after passing, so nothing accumulates).

## License

MIT
