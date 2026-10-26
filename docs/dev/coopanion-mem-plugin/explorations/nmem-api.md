# 探索报告：Nowledge Mem 接入面（EXPLORE-NMEM-API）

- 任务标识：`EXPLORE-NMEM-API`（全局纠正预算：第 0 轮 / 初始探索）
- 角色：explorer（只读）
- 主文档引用：`docs/dev/coopanion-mem-plugin/main.md` v0.1
- 探索时间：2026-10-26（本机 macOS）
- 交付性质：事实与证据清单。**本文不含实现代码，也不裁决架构**；本地/远程统一抽象由架构阶段决定，本文只给「建议输入」。

---

## ① 结论摘要（6 问逐条）

| # | 问题 | 结论 | 证据等级 |
| --- | --- | --- | --- |
| 1 | 本机是否安装 Nowledge Mem | **已安装并在运行**。桌面应用 `Nowledge Mem.app`（0.10.108），`nmem-server` 监听 `*:14242`（注意是 `*`，非纯 127.0.0.1），CLI `nmem 0.10.108` 可用，API 基址 `http://127.0.0.1:14242` | **本机已验证** |
| 2 | Mem 的 HTTP API（保存/搜索/读取 + 认证） | 保存 `POST /memories`；搜索 `POST /memories/search`（混合检索）；读取 `GET /memories/{memory_id}`、列表 `GET /memories`。认证：**本机默认不需要 key**，远程必须带 `Authorization: Bearer nmem_...` 或 `X-NMEM-API-Key` | **本机已验证 + 文档结论** |
| 3 | MCP server 模式 | 已启用，**同一个 HTTP 端口**：`http://127.0.0.1:14242/mcp`（Streamable HTTP，非 stdio），实测可 `initialize` 并拿到 **75 个工具** | **本机已验证** |
| 4 | 远程模式语义 | `nmem config client set url <URL>` + `nmem config client set api-key nmem_...` 写 `~/.nowledge-mem/config.json`；客户端连的**就是同一个 REST/MCP 基址**，只是换了 host + 带 key。优先级 CLI flags > env > config file > defaults | **本机已验证（含 config 文件路径与优先级输出）+ 文档结论** |
| 5 | 数据模型（memory/thread/source/space） | 4 类记录 + 三层隔离。**保存一条记忆** = `POST /memories`；**保存一段对话** = `POST /threads`（或 `POST /threads/import`、`POST /threads/sessions/save`）；对话→记忆的提炼 = `POST /memories/distill` | **本机已验证（schema）+ 文档结论** |
| 6 | Node/TS 推荐接入 | **有官方 OpenAPI（3.1.0）可实时拉取**：`GET http://127.0.0.1:14242/openapi.json`（555 KB，294 path）。**未见官方 TS SDK**。最小契约 = 3 个 REST 端点 + 1 个可选 header | **本机已验证（OpenAPI 实拉）+ 未找到（SDK）** |

---

## ② 证据清单

### 2.1 本机安装与运行状态（本机已验证）

命令与输出：

```
$ ls -d /Applications/*[Mm]em* ...
/Applications/Nowledge Mem.app

$ which nmem
/usr/local/bin/nmem

$ nmem --version
nmem 0.10.108

$ nmem status

nmem
  cli      v0.10.108
  server   v0.10.108
  status   ok
  mode     local
  api      http://127.0.0.1:14242  (default)
  database connected
```

进程与端口（`ps aux` / `lsof -nP -iTCP -sTCP:LISTEN`）：

```
tomahawkd  77227  /Applications/Nowledge Mem.app/Contents/Resources/_up_/rust-backend/nmem-server
tomahawkd  77186  /Applications/Nowledge Mem.app/Contents/MacOS/nowledge-mem
nmem-serv 77227  tomahawkd  24u  IPv4 ... TCP *:14242 (LISTEN)
```

> 注意：`lsof` 显示绑定为 `*:14242`（全网卡），而非纯 `127.0.0.1`。文档仍称默认为本地。这影响「本地」的语义，见 ③ 风险 R1。

健康检查（无需 key，本机）：

```
$ curl http://127.0.0.1:14242/health
{"status":"ok"}

$ curl http://127.0.0.1:14242/health/details
{"status":"ok","version":"0.10.108","build_sha":"09044267588bcdb6bc1ed509dfd911dbce6c0eac",
 "embedding":{"mode":"local-gguf","degraded":false},
 "search_index":{"reindex_pending":false},
 "graph_store":{"status":"healthy","repair_required":false},
 "compute":{"gpu_backend":"metal","gpu_enabled":true}}
```

> `embedding.mode = local-gguf`：本机语义检索依赖本地 embedding 模型，已就绪、未降级。这对「本地模式能否离线语义搜索」是关键的正向证据。

### 2.2 REST API 基址与 OpenAPI（本机已验证）

```
Base URL: http://127.0.0.1:14242
GET /openapi.json  -> 200, 555349 bytes
openapi: 3.1.0 | title: Nowledge Mem API 0.9.15
servers: [{"url": "http://127.0.0.1:14242", "description": "Nowledge Mem API Server"}]
paths: 294
components: ["schemas"]   # 无 securitySchemes
```

> 版本不一致：`openapi.info.version` 为 `0.9.15`，而 `/health/details` 为 `0.10.108`。属文档/规范版本号未同步，非功能性差异，但说明 **OpenAPI 版本字段不可用于能力判定**。

文档页 `https://mem.nowledge.co/docs/api.md` 原文：

> "The Nowledge Mem server exposes a local REST API on port `14242`. Every feature in the desktop app and MCP tools uses these same endpoints, so you can build your own connectors, scripts, and automations on top of the same data.
> Base URL: `http://127.0.0.1:14242`"

### 2.3 三个核心端点契约（本机 OpenAPI 实拉）

**保存记忆 — `POST /memories`**（schema `MemoryCreateRequest`，仅 `content` 必填）

```jsonc
// 请求（关键可选字段）
{
  "content": "string",        // required, maxLength 32768
  "id": "string|null",        // 自定义 ID -> upsert 语义（存在则更新），maxLength 200；缺省则生成 UUID
  "title": "...",
  "importance": 0.5,          // 0..1, default 0.5
  "confidence": 0.5,          // 0..1
  "labels": ["..."],
  "metadata": {},             // 任意 JSON，可作检索过滤条件
  "source": "manual",         // 展示用来源，如 manual | codex | claude-code
  "source_app": "...",        // 运行期来源，与 source 分开
  "unit_type": "fact",        // fact|preference|decision|plan|procedure|learning|context|event
  "event_start": "YYYY|YYYY-MM|YYYY-MM-DD",
  "event_end": "...",
  "source_thread_id": "...",  // 溯源：来自哪个 thread
  "source_message_indices": [12, 13],
  "agent_id": "...",          // 身份溯源，注释明确 "Identity is provenance, not auth."
  "host_agent_id": "..."
}
// 响应 MemoryCreateResponse
{ "memory": MemoryNode, "extracted_entities": [], "assigned_labels": [],
  "created_relationships": 0, "action": "created|updated", "warnings": [] }
```

> `action: "created" | "updated"` + 可选 `id` ⇒ **原生的幂等 upsert 通道**，对本插件「避免重复写入」很有价值。

**搜索记忆 — `POST /memories/search`**（schema `MemorySearchRequest`，`query` 必填）

```jsonc
{
  "query": "DNS office VPN",
  "limit": 10,                 // 1..100
  "mode": "deep|fast",         // deep=默认；fast = BM25+vector only
  "space_id": "default",
  "unit_type": "decision",
  "filter_labels": ["..."],
  "metadata_filters": ["customer=acme", "purpose=contract-review"], // AND；同 key 重复=OR
  "include_entities": true,
  "event_date_from": "2024-01-15", "event_date_to": "2024-12-31",
  "temporal_context": ...
}
```

响应为 **数组**（不是包装对象），元素 `MemorySearchResult`：

```jsonc
[{ "memory": MemoryNode | null,
   "similarity_score": 0.0..1.0,        // required
   "relevance_reason": "string|null",
   "related_entities": [], "evolves_context": {}, "related_memory_links": [] }]
```

本机实测（只读）：

```
$ curl -X POST http://127.0.0.1:14242/memories/search \
    -d '{"query":"DNS office VPN","limit":1,"mode":"fast"}'
[{"memory":{"id":"e39be68a-...","node_type":"Memory","created_at":"2026-10-24T01:44:55+00:00",
  "metadata":{"score_breakdown":[{"source":"Semantic","share":0.39},
                                 {"source":"Text","share":0.28},
                                 {"source":"Keyword","share":0.22},
                                 {"source":"Label","share":0.06}], ...}}}]
```

> 返回值带 `score_breakdown` / `search_context_snapshot` 等**检索诊断**字段，且 `memory.metadata` 里混入了检索侧信息。插件解析时不应把 `metadata` 当纯业务数据。

**读取记忆 — `GET /memories/{memory_id}`**（响应 `MemoryPublic`）

```jsonc
{ "id":"...", "title":"...", "content":"...", "source":"...", "time":"2 days ago",
  "importance":0.7, "rating":3, "label_ids":[],
  "is_favorite":false, "source_thread":{...}|null, "confidence":0.6,
  "space_id":"default", "unit_type":"fact", "metadata":{...} }
```

查询参数：`space_id`（可选，"Optional isolation space guard"，即隔离空间守卫）。

列表 `GET /memories?limit=2` 返回 `{"memories":[ ...MemoryPublic... ]}`，注意 **单个 GET 返回裸对象、列表返回 `memories` 包装**，形态不一致。

### 2.4 认证方式（本机已验证 + 文档结论）

本机实测三种情形（对 `GET /memories?limit=1`）：

```
no key                       -> 200     # 本机 localhost 默认免 key
Authorization: Bearer nmem_bogus -> 401  # 带了错 key 反而失败
X-NMEM-API-Key: nmem_bogus   -> 401
```

> 重要细节：**本机不要求 key，但一旦提供了错误 key 会 401**。所以客户端不应"无条件附带一个可能为空的 key 变量"，应按是否有配置决定是否发送。

文档 `docs/remote-access.md`：

> - "API key is required for every remote request, both tunnel and LAN connections."
> - "When LAN access is enabled, connections from other devices on your network require the API key. Connections from the same computer are always allowed without a key, unless you enable **Require API key on localhost** in Settings."
> - 鉴权头两种等价形式：`Authorization: Bearer nmem_...` 或 `X-NMEM-API-Key: nmem_...`
> - 代理剥离头时可退化：`$NMEM_API_URL/health/details?nmem_api_key=$NMEM_API_KEY`
> - 错误码：`401 Missing API key`；`429 Too many invalid auth attempts`（错 key 重试会被限流）
> - key 在 Settings / Connectors 中生成与轮转，轮转后旧 key 立即失效

key 来源（本机 `nmem key` 子命令存在）：`nmem key  # Show or rotate the Access Anywhere API key`。

### 2.5 MCP server 模式（本机已验证）

传输：**Streamable HTTP**（同一端口，路径 `/mcp`），**不是 stdio**。

```
$ curl -o /dev/null -w '%{http_code}' http://127.0.0.1:14242/mcp
406                                  # 需正确的 Accept/MCP 握手

$ POST /mcp {"method":"tools/list"}
"Unexpected message, expect initialize request"

# 正确握手（initialize -> Mcp-Session-Id -> tools/list）
init status: 200
session: a00feb97-e2f2-452a-a92e-34bfa2b9ebb1
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",
  "capabilities":{"resources":{},"tools":{}},
  "serverInfo":{"name":"nowledge-mem","version":"0.10.108"},
  "instructions":"Cross-tool personal knowledge graph with semantic search."}}
tools status: 200  -> TOOL COUNT: 75
```

`nmem config mcp show --host codex` 生成的配置（本机）：

```
Endpoint:       http://127.0.0.1:14242/mcp
API key source: none

[mcp_servers.nowledge-mem]
url = "http://127.0.0.1:14242/mcp"
env_http_headers = { "X-Nmem-Agent-Id" = "NMEM_AGENT_ID",
                     "X-Nmem-Host-Agent-Id" = "NMEM_HOST_AGENT_ID",
                     "X-Nmem-Space-Id" = "NMEM_SPACE" }
[mcp_servers.nowledge-mem.http_headers]
APP = "Codex"
"x-nmem-space-protocol" = "exact-v1"
"X-Nmem-Tool-Set" = "external-agent"
"X-Nowledge-Tool-Schema-Profile" = "slim"
```

> 说明 MCP 侧有一组**能力协商 header**（`X-Nmem-Tool-Set`、`X-Nowledge-Tool-Schema-Profile=slim`、`x-nmem-space-protocol=exact-v1`），会影响返回的工具集与 schema 详细度。若插件走 MCP 而非 REST，需要复刻这些 header 才能拿到与宿主一致的视图。

工具清单（75 个，完整保存在 `/tmp/mcp-tools-list.json`），与「记忆读写 + 对话」最相关的子集：

| 工具 | 用途 |
| --- | --- |
| `memory_search` | 语义搜索；**query 省略时退化为列最近记忆**；返回有界预览 + `memory_id`/`reference_uri` |
| `memory_add` | 保存 decision/insight/procedure/learning/preference/context |
| `memory_update` | 精炼既有记忆（内容/标题/importance/labels/review status） |
| `memory_delete` / `memory_supersede` | 删除 / 标记被新记忆取代 |
| `get_memory_by_id` | 取**完整内容**（非截断） |
| `thread_search` / `thread_fetch_messages` / `search_thread_messages` / `thread_delete` | 对话检索与分页读取 |
| `sync_thread` | "Save an original conversation snapshot supplied by the caller. Use the same provider thread_id and stable messages…" ← 相关对话写入 |
| `read_working_memory` / `read_context_bundle` | 会话启动上下文 |
| `list_spaces` / `get_space_profile` | 空间发现 |
| `mem_fs` / `memory_neighbors` / `explore_graph` / `graph_stats` | 虚拟文件树与图谱扩展 |
| `web_search` / `fetch_url` / `obsidian_search` | 外部检索（本插件大概率不用） |

> MCP 里 **没有** 名为 `save_thread` 的工具；对话写入的推荐面是 `sync_thread`（supplied snapshot），REST 侧对应 `POST /threads` / `/threads/import`。

### 2.6 远程模式语义（本机已验证 + 文档结论）

```
$ nmem config client show
Client Connection Settings
  Config file:     /Users/tomahawkd/.nowledge-mem/config.json
  Effective URL:   http://127.0.0.1:14242
  URL source:      default
  API key:         not set

$ nmem config client show -j
{"configFile":"/Users/tomahawkd/.nowledge-mem/config.json",
 "effective":{"apiUrl":"http://127.0.0.1:14242","apiUrlSource":"default","apiKeyConfigured":false}}
```

`nmem config client set` 的签名（与用户任务描述略有差异，**应为位置参数 key 或 `--url/--api-key` 两种写法**）：

```
Usage: nmem config client set [OPTIONS] [KEY] [VALUE]
Arguments: [KEY]  Setting key: url or api-key ; [VALUE] Value for the setting key
Options:  --url <URL>   --api-key <API_KEY>
```

文档 `remote-access.md` 的实际用法：

```bash
nmem config client set url https://<your-url>
nmem config client set api-key nmem_...
```

> 即：**不是** `nmem config client set --url ... --api-key ...` 一次调用；而是两次调用（或以位置参数 `set url <v>` / `set api-key <v>`）。这一点需在插件配置文档中写准。

远程语义要点（文档原文）：

> - "The command writes the same local client config file that OpenClaw, Bub, Claude Code, Claude Desktop, and other integrations read. It is separate from `nmem config access ...`, which controls how a Mem server is exposed to other devices."
> - 优先级："CLI flags > env vars > config file > defaults"（`NMEM_API_URL` / `NMEM_API_KEY`）
> - 远程时连的**就是同一个基址**：`https://<your-url>` 下的 REST 路径，MCP 为 `https://<your-url>/mcp/`（**注意结尾斜杠**）
> - **远程不代表服务端去读本地会话文件**："For transcript-backed saves such as `nmem t save --from claude-code` … remote mode does **not** mean the Mem server reads those agent session files remotely. The client machine running the agent still performs local discovery and parsing, then uploads the normalized thread data to Mem."
> - 同机自动配置："If you run `nmem` on the same computer as the desktop app, this file is created automatically when Access Anywhere generates an API key."
> - 部分端点仅本地：`Browse-Now / Browser Bridge automation endpoints are local-only and are not exposed through Access Anywhere.`

自托管端口可改（`server-deployment.md`）：

> `nmem serve --host 0.0.0.0 --port 8080` / `sudo nmem service install --service-user <u> --host 0.0.0.0 --port 8080`
> `NMEM_SERVER_ADDR` 默认 `127.0.0.1:14242`；`NMEM_API_URL` 默认 `http://127.0.0.1:14242`

### 2.7 数据模型关系（本机 schema + 文档）

```
Space (隔离空间, id 默认 "default")
  ├── Memory        独立的持久知识单元（fact/preference/decision/plan/procedure/learning/context/event）
  │     ├── Labels            多对多
  │     ├── Memory Relations  显式 Memory↔Memory 链接
  │     ├── EVOLVES 链        版本演进（supersede → 保留历史）
  │     └── Entity 提及       → 全局 Entity Graph / Communities / Crystals
  ├── Thread        对话层：Thread 1—N Message(order_index)，source/project/workspace 元数据
  │     └── distill → Memory（带 source_thread_id + source_message_indices 溯源）
  └── Source/Library  外部工件（文件、网页、笔记…），走 ingest 管线
```

文档 `memories.md`：

> "Use a memory for the durable takeaway. Use a thread when you need the original conversation history. A strong workflow is: save or import the thread, then distill the parts worth keeping into memories."

文档 `spaces.md`：

> - "The **entity graph stays global by design**. Spaces change what your day-to-day memory surfaces read and write by default."
> - "The HTTP and MCP APIs still use the `space_id` field name for compatibility, but they accept the visible space name too."
> - "Shared context … **does not** move memories into those spaces. It does **not** merge spaces together."

**两个动作的端点映射：**

| 动作 | 端点 | 必需字段 |
| --- | --- | --- |
| 保存**一条记忆** | `POST /memories` | `content`（+ 可选 `id` 做 upsert） |
| 保存**一段对话**（结构化） | `POST /threads` | `thread_id`（人类可读 ID）、`messages[]`（`role`+`content`） |
| 保存一段对话（导入式/宽松） | `POST /threads/import` | `title`、`source`、`messages[]`；支持批量与 Conversation Markdown |
| 保存编码会话（扫本地文件） | `POST /threads/sessions/save` | `client` ∈ `claude-code|codex|gemini-cli`、`project_path`；+`persist_mode`/`session_id`/`summary` |
| 对话 → 记忆提炼 | `POST /memories/distill` | 见 `DistillationRequest`（未展开） |

`POST /threads` 请求 schema（`ThreadCreateRequest`）：

```jsonc
{ "thread_id": "...",            // required, 人类可读
  "messages": [ { "content":"...", "role":"user|assistant|system",   // required
                  "timestamp":"ISO8601|null", "metadata":{} } ],     // required
  "title": "...", "summary": "...", "participants": ["..."],
  "source": "...", "space_id": "default",
  "project": "...", "workspace": "...", "tool_version": "...",
  "import_date": "ISO8601", "metadata": {} }
// 响应 ThreadCreateResponse
{ "thread": ThreadNode, "messages": [MessageNode],
  "created_relationships": 0,
  "auto_generated_summary": "string|null",
  "extracted_memories": [MemoryNode],     // ← 服务端会自动提炼记忆
  "auto_extraction_performed": false }
```

> `POST /threads` 可能**自动产出 memories**（`auto_extraction_performed` / `extracted_memories`）。这意味着"保存对话"可能顺带写记忆，插件若不希望双重写入需注意这一点。

`GET /threads/search` 参数：`query`(required)、`mode`(`suggestions|full`, default `full`)、`limit`(1..500, default 20)、`source`、`space_id`。
`GET /spaces` 本机实测：

```
{"enabled":false,"spaces":[{"id":"default","key":"default","name":"Default","aliases":[],
  "defaultRetrievalMode":"strict","kind":"personal",
  "usage":{"memories":3,"archivedMemories":0,"crystalCount":0,"hiddenMemories":0,
           "threads":1,"sources":0,"hasWorkingMemory":{"Ok":true}},
  "observed":true,"hasProfile":false}]}
```

> 本机 Spaces **未启用**（`enabled:false`），只有 `default`。插件不应假定多 space 存在。

### 2.8 Node/TS 接入面（本机已验证 / 未找到 SDK）

- **OpenAPI 3.1.0 可运行时获取**：`GET http://127.0.0.1:14242/openapi.json`（294 paths）。可用于生成 TS 类型（如 `openapi-typescript`）。
- **未见官方 Node/TS SDK**：`nmem --help` 列出的全部子命令中无 SDK 相关项；文档站 sitemap 中无 `/docs/sdk` 或 npm 包页面。MCP 工具清单里的 `langgraph` 等是"集成指南"页而非 SDK。（搜索范围：sitemap 全量 docs 页 + `nmem --help` 全量命令；未检索 npm registry。）
- **最小 REST 契约（对插件而言）**：

```
POST {base}/memories          -> 写记忆（可带 id 幂等 upsert）
POST {base}/memories/search   -> 语义检索（返回 similarity_score）
GET  {base}/{memory_id} 实际为 GET {base}/memories/{id}  -> 读全文
GET  {base}/health            -> 探活（200 = ok）
可选头：Authorization: Bearer nmem_...  或  X-NMEM-API-Key: nmem_...
Content-Type: application/json
```

---

## ③ 对插件设计的影响与风险（建议输入，非裁决）

### 3.1 本地 vs 远程统一抽象的建议输入

事实支持这样一个判断：**REST 面在本地与远程是同一套**（同路径、同 schema；远程只是 host 变 https、强制要 key）。MCP 亦同（`/mcp` vs `https://<url>/mcp/`）。

因此架构可考虑的最小抽象轴：

| 维度 | 本地（默认） | 远程 | 统一方式 |
| --- | --- | --- | --- |
| baseURL | `http://127.0.0.1:14242` | `https://<host>` | 单一 `baseUrl` 配置 |
| 认证 | 无 | `Bearer nmem_...` | `apiKey?: string`，**为空则不发头**（见 R2） |
| 路径 | `/memories`… | 同 | 无分支 |
| MCP | `http://127.0.0.1:14242/mcp` | `https://<url>/mcp/`（尾斜杠） | 注意尾斜杠差异 |
| space | `space_id: "default"` | 同 | 可选字段，默认不传或传 default |
| 配置来源 | `~/.nowledge-mem/config.json` | 同（`nmem config client set`） | 可选：读同一文件继承用户已配好的 url/key |

> **可选优化**：Mem 自己已在 `~/.nowledge-mem/config.json` 维护 client 配置，且其他插件（OpenClaw/Bub/Claude Code）都读同一文件。插件若也读它，可做到"用户在 Mem 里配一次，插件自动跟随"；代价是引入一个外部文件依赖（**是否这样做属架构决策**）。

### 3.2 风险与注意事项

| ID | 风险/事实 | 影响 | 证据 |
| --- | --- | --- | --- |
| R1 | 本机 `nmem-server` 绑定 `*:14242`（全网卡），而非纯 loopback | "本地"在实现上可能已可被 LAN 访问；插件对 `127.0.0.1` 的信任假设需与安全评审确认 | `lsof` 输出 `TCP *:14242 (LISTEN)` |
| R2 | 本机免 key，但**带错 key 会 401** | 客户端必须"有 key 才发头"，不能恒发；否则用户从远程切回本地会因残留 key 全部失败 | 实测 `no key:200` / `bad key:401` |
| R3 | `429 Too many invalid auth attempts` | 错误的自动重试会触发限流，需要退避且不重试 401 | 文档 remote-access.md |
| R4 | 响应形态不一致：`POST /memories/search` 返回**裸数组**；`GET /memories` 返回 `{memories:[…]}`；`GET /memories/{id}` 返回裸对象 | 解析层需按端点分别处理，不能统一 `data.items` | OpenAPI + 实测 |
| R5 | `POST /threads` 可能自动提炼并写入 memories（`auto_extraction_performed`） | "写对话"不等于"只写对话"，可能与插件自己的写记忆路径**重复** | `ThreadCreateResponse` 字段 |
| R6 | OpenAPI `info.version`（0.9.15）与实际服务（0.10.108）不一致 | 不能用 version 字段做能力探测，应改用 `/health/details.version` 或能力探测 | 实测对比 |
| R7 | `memory.metadata` 会被检索侧写入 `score_breakdown` / `search_context_snapshot` | 若插件用自己的 metadata 作业务标记，应使用独立命名空间前缀避免混淆 | 实测搜索响应 |
| R8 | 3072 字符/32KB 限制：`content` maxLength **32768** | 长对话/长记忆需分片或走 thread 而非 memory | `MemoryCreateRequest.content.maxLength` |
| R9 | 写记忆有 `id` upsert 语义（`action: created|updated`） | 可用于"同一条记忆不重复写"的幂等，是比"先搜再写"更廉价的方案 | `MemoryCreateRequest.id` 描述 + `MemoryCreateResponse.action` |
| R10 | Spaces 在本机未启用（`enabled:false`） | 插件不应把 space 当必需概念；`space_id` 应可选 | `GET /spaces` 实测 |
| R11 | 语义检索依赖本地 embedding（本机 `local-gguf`, `degraded:false`） | 本地模式可离线语义检索（本机已就绪）；但若 embed 模型未下载/降级，`mode:deep` 的检索质量会变。插件可读 `/health/details` 做前置检查 | `/health/details` 实测 |
| R12 | 远程模式下"MCP host 不自动读取 config.json" | 如果插件走 MCP，需自行注入 header；走 REST 则读 config 更自然 | 文档 "The MCP host owns that connection, so it does **not** automatically read `~/.nowledge-mem/config.json`" |
| R13 | MCP 有 capability header 协商（`X-Nmem-Tool-Set`、`X-Nowledge-Tool-Schema-Profile=slim`） | 不带头可能拿到不同工具集/schema 详细度，实测的 75 工具是**本机默认**视图 | `nmem config mcp show --host codex` 输出 |
| R14 | `docs/integrations.md` 页面无法抓取（返回 `# Connectors` + "API reference page. OpenAPI operation details could not be extracted from this page."，仅 144 字节）；`llms.txt` 返回 404 HTML | 文档站无集中 MCP 页，MCP 事实只能靠本机实测 + `remote-access.md` | curl 实测 |
| R15 | 写记忆的 `content` 是**自由文本 Markdown**，无结构化 schema | "Coo 的记忆"如何映射到 `unit_type`/`title`/`importance`/`labels` 需架构给策略（本报告不给结论） | `MemoryCreateRequest` |

### 3.3 对 D2（双向：读+写）的直接含义

- **读**：`POST /memories/search` 一条即可支撑"召回"；`mode: fast|deep` 提供延迟/质量旋钮，适合桌宠场景按需切换。
- **写**：两条路径需明确取舍——
  - 只写"结论性记忆"：`POST /memories`（配 `id` 幂等 + `source: "coopanion"` 溯源）。
  - 写整段对话：`POST /threads`（注意 R5 的自动提炼副作用）。
  - 建议把 `source` / `source_app` 设为插件自己的标识，便于后续过滤与清理（这是事实建议，不是规约）。

---

## ④ 未决问题

1. **插件运行时能否访问 localhost / 远程 HTTPS**（主文档 A3）：本报告只证明 Mem 侧存在且可达，**未验证 Cortico Core 子进程的网络权限**。属 EXPLORE-COOPANION-EXT 或架构验证范围。
2. **`/memories/distill` 与 `/memories/distill/preview` 的完整契约未展开**（`DistillationRequest` schema 未细读）。若插件想"对话 → 记忆"走服务端提炼而非客户端自撰，需要补这一层。
3. **官方 TS SDK 是否存在**：本报告在文档站 sitemap 与 `nmem --help` 范围内未找到，但**未检索 npm registry / GitHub**。若架构倾向用 SDK，需再确认。
4. **`X-Nmem-Tool-Set` / `X-Nowledge-Tool-Schema-Profile` / `x-nmem-space-protocol` 三个 header 的完整语义与合法取值**：仅从 `nmem config mcp show` 见到，未见文档说明。若插件走 MCP 需澄清。
5. **`~/.nowledge-mem/config.json` 是否作为插件配置来源之一**：属架构决策（涉及外部文件依赖与"用户配一次即可"的体验权衡），本报告不裁决。
6. **R1（绑定 `*:14242`）是否为本机特例**：桌面版默认绑定的确切行为未从文档确认；文档只说 "exposes a local REST API on port 14242"。若安全评审关心，需进一步确认 Mem 的设置项。
7. **`nmem config client show` 的 `apiKeyConfigured: false`** 说明本机尚未配置远程 key。**远程模式的真机链路未被本报告实测**（仅文档结论），如验收要覆盖远程，需要用户提供远程 URL+key 后再做一次连通性验证。

---

## 附：临时文件位置（/tmp，非项目内）

| 路径 | 内容 |
| --- | --- |
| `/tmp/openapi.json` | 本机实拉的 OpenAPI 3.1.0（555 KB，294 paths） |
| `/tmp/mcp-tools.json` | MCP `tools/list` 原始 SSE 响应 |
| `/tmp/mcp-tools-list.json` | 解析后的 75 个工具定义（name/description/schema） |
| `/tmp/nmem-docs/*.md` | 文档站各页 markdown 快照（api, getting-started, memories, threads, concepts, spaces, remote-access, cli, server-deployment, sync, docker） |

## 附：本次使用的主要命令（可复现）

```bash
# 本机状态
ls /Applications | grep -i mem ; which nmem ; nmem --version ; nmem status
ps aux | grep -i nmem | grep -v grep
lsof -nP -iTCP:14242 -sTCP:LISTEN
curl http://127.0.0.1:14242/health
curl http://127.0.0.1:14242/health/details

# 契约
curl http://127.0.0.1:14242/openapi.json -o /tmp/openapi.json
curl -X POST http://127.0.0.1:14242/memories/search \
     -H 'Content-Type: application/json' \
     -d '{"query":"DNS office VPN","limit":1,"mode":"fast"}'
curl "http://127.0.0.1:14242/memories?limit=2"
curl http://127.0.0.1:14242/spaces

# 认证
curl -o /dev/null -w '%{http_code}' http://127.0.0.1:14242/memories?limit=1
curl -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer nmem_bogus' http://127.0.0.1:14242/memories?limit=1

# 配置 / MCP
nmem config client show -j
nmem config client set --help
nmem config mcp show --host codex
# MCP: initialize -> Mcp-Session-Id -> tools/list (见 2.5)

# 文档
curl https://mem.nowledge.co/sitemap.xml
curl https://mem.nowledge.co/docs/<page>.md   # index, api, memories, threads, spaces, remote-access, ...
```
