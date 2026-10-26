# 整体技术方案：Coopanion × Nowledge Mem 插件（coopanion-mem-plugin）

- 任务标识：ARCH-DESIGN-1（architecture，整体设计）
- 主文档引用：`docs/dev/coopanion-mem-plugin/main.md` v0.2（用户裁定 D1–D6、假设验证 A1–A6）
- 探索报告引用：`explorations/coopanion-extension.md`（证据 A*/B*/C*/D*）、`explorations/nmem-api.md`（证据 R*）
- 本文证据约定：`B15` 指 coopanion-extension.md 证据清单 B15；`R2` 指 nmem-api.md 风险表 R2；行号级证据以两份报告为准，本文不重复贴源码。
- 交付时间：2026-10-26。本文是设计文档，不含实现代码。

---

## 0. 范围与输入口径

- 交付物：一个 Cortico World 扩展包（`kind: world`, `api: 6`，TypeScript，ESM），把 Coo 的记忆与 Nowledge Mem 双向打通：读（Coo 调工具搜索/读取 Mem）+ 写（对话中的新记忆沉淀到 Mem），不替换 Coo 内置 PARTNER.md 记忆（D2、D3、D4）。
- 验收环境：本机 macOS，Coopanion 0.2.10 发行版 + Nowledge Mem 0.10.108（127.0.0.1:14242），sideload 验收（D6）。
- 硬约束（来自探索，方案必须遵守）：
  - World 不能读 Coo 的 Memory，也无对话写入 hook（B11、B23、R1）；唯一官方接入路是「World 提供工具，Coo 自主调用」。
  - 工具名在 bot 内全局唯一，冲突拒绝挂载；官方要求短名前缀（B15、B25）。
  - `ctx.cfg` 是活引用（热改现读即生效）；`storeSecret` 拒绝空值与含空白值（B16、B26、R7）。
  - 本机 Mem 免 key，但带错 key 会 401；因此客户端「有 key 才发头」（R2）。
  - 扩展与 Core 同进程、完整 Node 能力，回环免代理（C10、C11）；renderer 白名单不影响 World 后端代码（C7）。
  - `POST /memories` 支持自定义 `id` 的 upsert 语义（`action: created|updated`），是原生幂等通道（R9）。
  - `POST /threads` 有服务端自动提炼副作用（R5）；`content` maxLength 32768（R8）。

---

## 1. 目标架构与模块边界

### 1.1 总体形态

单一 World 包，**零运行时依赖**（只用 Node 全局 `fetch` + 框架经 `cortico/*` 映射提供的类型；`cortico` 与工具链全部是 devDependencies，参照模板 B45）。这一性质让本机 link 安装（B2、C15）不依赖任何网络下载即可加载，sideload 与迭代（改源码重启生效）最简。

包名建议 `cortico-world-nmem`（对齐市场既有命名 `cortico-world-vtuber`/`cortico-world-asr`，B10），World id `nmem`，label `Nowledge Mem`，工具前缀 `nmem_`。

### 1.2 分层与依赖方向

```
src/definition.ts（组合根：装配 defaults/create/describe）
   ├──► src/config.ts          【配置与秘密层】类型 + 默认值 + ConfigGroup + 秘密名
   └──► src/world.ts           【World 工具与事件层】World 实现：tools()/envPromptVars()/webUi()/start()
          ├──► src/tools.ts    工具声明表 + 参数校验 + 回执格式化
          │      └──► src/mem/client.ts   【Mem REST 客户端层】传输/鉴权/超时/重试/错误分类
          │             └──► src/mem/types.ts  请求/响应契约 + ingress 类型收窄
          └──► src/ENV_PROMPT.md  【提示词策略层】数据文件，经 webUi().promptDocs 暴露（B45 模板模式）
```

各层职责与边界：

| 层 | 职责 | 明确不做 |
| --- | --- | --- |
| **Mem REST 客户端层** `src/mem/` | HTTP 传输、鉴权头决策（有 key 才发，R2）、超时与重试矩阵、HTTP 响应→具体 TS 类型的 ingress 收窄（R4）、错误分类（见 §2f） | 不 import `cortico/*`（框架无关，可独立单测）；不做回执格式化；不懂工具语义 |
| **World 工具与事件层** `src/world.ts` `src/tools.ts` `src/definition.ts` `src/index.ts` | `ToolDef` 声明（`nmem_` 前缀）、参数 JSON Schema 与校验、客户端结果→回执文本格式化、`ToolOutcome.failed` 语义、`nmem.started` 挂载事件、`describeTools` 自描述与 `describe.json` 同步 | 不直接发网络请求（必须经 MemClient，见 §4 import 边界）；不在 `envPromptVars()` 里做任何 I/O（§2b） |
| **配置与秘密层** `src/config.ts` | `NmemConfigSection` 类型、默认值（`enabled:false`，B16）、ConfigGroup JSON Schema（`x-hot` 标注）、秘密名常量 | 不依赖 mem/tools/world；秘密永不进 config.json（只经部署 `.env`） |
| **提示词策略层** `src/ENV_PROMPT.md` + `envPromptVars()` | 何时搜索、何时沉淀、PARTNER.md 并行写策略（§2d）、失败时如何告知用户；变量只允许廉价缓存值 | 不是代码 hook（契约上不存在，R5/B11）；不承载工具清单（describe 负责，B7） |

装配（组合根在 `definition.ts`，与 websearch 同模式 B47）：

- `create(ctx)` 构造 `MemClient({ baseUrl: ctx.cfg.baseUrl, apiKey: ctx.secret('NMEM_API_KEY') })` 并注入 `NmemWorld`；测试注入 fake client——这是客户端/工具两层之间的具体测试缝（concrete seam），不用 mock 库替换全局。
- `start(host)` 只投递一条 `nmem.started` 事件（origin: internal，仿模板 B45）。**start 不做 Mem 探活**：挂载成功 ≠ Mem 可达，避免 Core 启动顺序依赖（用户可能先开 Coopanion 后开 Mem）；可达性由工具调用自报告（§2f）。
- `searchLimit`/`searchMode` 热改生效方式：工具 handler 现读 `ctx.cfg`（活引用），不复制进 client。

### 1.3 目录结构（含 tests 布局）

```
coopanion-nmem/
├── .codeharness/code-harness.json      # §4 策略
├── AGENTS.md                           # §4 规约要点
├── README.md                           # 安装/配置/验收说明（T4 交付）
├── package.json                        # name/type:module/keywords/main/cortico manifest
├── tsconfig.json
├── vitest.config.ts
├── describe.json                       # 与 DECLS 同步生成并提交；测试守护一致性（B7：不一致 check:extension 判失败）
├── src/
│   ├── index.ts                        # export default NMEM（默认导出 WorldDefinition）
│   ├── definition.ts
│   ├── config.ts
│   ├── world.ts
│   ├── tools.ts
│   ├── ENV_PROMPT.md
│   └── mem/
│       ├── client.ts
│       └── types.ts
└── tests/
    ├── helpers/fake-host.ts            # FakeHost（照模板 B46 约定拷贝适配）
    ├── world.test.ts                   # dryMountWorld 零失败、start 事件、describe 一致性、cfg 热改
    ├── tools.test.ts                   # 参数校验、回执格式化（注入 fake client）
    ├── mem-client.test.ts              # 注入 transport 的行为矩阵（§3.1）
    └── contract.nmem.test.ts           # 本机真实 Mem 冒烟，opt-in（§3.2）
```

`package.json` manifest 要点（依 B20/B21/B45）：`"type":"module"`（硬性）、`"main":"./src/index.ts"`、`"keywords":["cortico-world","cortico"]`（缺失仅 warning，但发布市场需要，B21）、`"cortico":{"kind":"world","api":6,"describe":"describe.json"}`、devDependencies `cortico ^0.2.7`/`tsx`/`typescript`/`vitest`/`@types/node`（模板同款）、`files` 白名单 `src/README.md/describe.json`、license MIT（与模板一致；仅依赖 MIT 的 cortico 类型，不分发 Coopanion 代码）。

### 1.4 工具清单草案（3 工具 + 1 事件）

全部声明集中在 `tools.ts` 的 `NMEM_TOOL_DECLS`（`describe` 与 `tools()` 同源，B15 约定）。

| 工具 | tags | 端点 | 参数（JSON Schema 要点） | 幂等/溯源 |
| --- | --- | --- | --- | --- |
| `nmem_search` | `['read']` | `POST /memories/search` | `query` 必填 string 1..500；`limit` 整数 1..10（缺省取配置 `searchLimit`）；`mode` enum `fast\|deep`（缺省取配置 `searchMode`） | 只读；回执含 id/标题/相似度/摘要（截断），尾部提示可用 `nmem_get` 取全文 |
| `nmem_get` | `['read']` | `GET /memories/{id}` | `id` 必填 string | 只读；404 → 明确「未找到」回执 |
| `nmem_save` | `['write']` | `POST /memories` | `content` 必填 string 1..30000（§2c 上限说明）；`title?`；`unit_type?` enum（fact/preference/decision/plan/procedure/learning/context/event，nmem-api §2.3）；`labels?` string[]；`id?` string ≤200（upsert）；`importance?` 0..1 | **幂等**：传 `id` 走服务端 upsert（R9），回执报告 `action: created\|updated`；不传 `id` 为新建。**溯源**：服务端自动补 `source:'coopanion'`、`source_app:'cortico-world-nmem'`、`agent_id: ctx.botName`（"Identity is provenance, not auth."，nmem-api §2.3）；默认并入 label `coopanion`（便于 Mem 侧过滤/清理，R7 提示不写自定义 metadata 键避免与检索诊断混淆） |

- `nmem_save` 的 `write` tag 依据：B27 定义 write =「修改 Memory 或 World 的内部记录」；严格看 Mem 是外部系统，但该 tag 的消费意图是「产生持久数据副作用」，与 `act`（对外动作）相比 `write` 是对模型更准确的信号。此为我的判断，若 reviewer 按「外部系统」口径主张 `act`，属可接受变更，不阻塞。
- 事件：`nmem.started`（`origin:'internal'`，挂载确认，仿模板 B45）。无其他事件——本 World 是「仅提供请求/响应工具」形态（websearch 同类，B47），检索结果不落事件库。
- 明确不做（非目标）：删除/取代记忆工具、thread 写入工具（§2c）、面板、健康探活工具。`describe.json` 由 `describeTools(NMEM_TOOL_DECLS, {…zh/en})` 生成，测试断言与提交文件一致（运行时不一致仅 warn，B7，但 `check:extension` 判失败）。
- 工具名冲突：`nmem_` 前缀避开保留帧名与内置 World/Persona 工具（B25）；`dryMountWorld` 自带冲突检查（B8），单测覆盖。

### 1.5 两条数据流

- **读**：用户提问 → Coo 按 ENV_PROMPT 判断需要记忆 → 调 `nmem_search`（或 `nmem_get`）→ world 层校验参数 → MemClient（鉴权头决策→超时/重试→ingress 收窄）→ tools 层格式化回执 → Coo 引用作答。Mem 不可达时回执 `failed`，Coo 按 ENV_PROMPT 告知用户并继续对话（§2f）。
- **写**：对话中出现值得长期保留的事实/偏好/决定 → Coo 调 `nmem_save`（必要时带 `id` 更新既有记忆）→ 服务端 upsert + 自动溯源标识 → 回执报告 id 与 action → Mem 端（应用/CLI/其他 Mem 集成）可见。

---

## 2. 关键技术决策

### 2a. Mem 接入：REST 直连（结论）

**结论：REST 直连（3 个端点 + 可选 /health），不引入 MCP，不用 OpenAPI 生成客户端。**

理由：

1. REST 面本地/远程同构：同路径同 schema，远程只是 host 换 https + 强制 key（nmem-api §3.1）；单 `baseUrl` + 单 `apiKey` 即完成 D4 的统一抽象，无需分支。
2. MCP 需要复刻未文档化的能力协商 header（`X-Nmem-Tool-Set`、`X-Nnowledge-Tool-Schema-Profile`、`x-nmem-space-protocol`，R13 及 nmem-api 未决 4）才能拿到与官方宿主一致的工具视图，且是 Streamable HTTP 会话（initialize → Mcp-Session-Id，nmem-api §2.5），会话管理成本全部落在插件侧；远程 MCP 还有尾斜杠差异。我们没有能力协商的语义文档，等于依赖未承诺行为。
3. 我们本来就要做「工具策展」：Mem MCP 暴露 75 个工具，而 World 契约要求前缀唯一、清单可控（B15/B25），Coo 需要的是 3 个精选工具而非透传。MCP 在这里只会增加一层无收益的间接。
4. 探索未找到官方 TS SDK（nmem-api 结论 6）；OpenAPI 有 555KB/294 paths（nmem-api §2.2），生成客户端对只需 3-4 端点的插件是死代码负担。OpenAPI 仅作为手写类型的**契约参照**（注意其 `info.version` 不可信，R6）。

被否选项：MCP 直连（上述 2/3）；官方 SDK（不存在）；OpenAPI 生成客户端（过重）；每次请求前动态探测能力（R6 已证明版本字段不可用，无谓复杂）。

### 2b. 读召回触发：纯工具（结论）

**结论：读召回完全由 Coo 调 `nmem_search`/`nmem_get` 驱动；`envPromptVars()` 永不做 Mem I/O，v1 返回空变量表（websearch 同模式，B47）。何时搜索的策略写在 ENV_PROMPT（§2d）。**

理由：

1. `envPromptVars()` 在每次 system 前缀重建时被调用（B16/worlds.md:16）。在其中打 Mem 意味着把一次网络往返放进每轮模型调用的关键路径：本地 Mem 未启动时前缀构建会拖超时或需要额外降级逻辑，错误面从「工具回执」扩大到「前缀构建」。
2. **决定性事实**：前缀重建时 World 拿不到用户本轮消息（用户输入是 EventEnvelope 进上下文，World 读不到别的 World 推的事件，R14/B29）。开场召回只能做「最近记忆列表」这类无针对性召回，成本高、语义弱。
3. 官方指定路线就是「World 提供工具，Bot 决定何时调用」（B11）；ENV_PROMPT 可以要求「会话开场或涉及用户事实/历史时先 `nmem_search`」，以提示词达成开场召回的意图而不固化延迟。

被否选项：`envPromptVars()` 开场召回（上述 1/2）；「工具 + 开场召回」组合（组合中召回部分承袭同样缺陷，且产生双真相：同一条记忆既在工具回执又在前缀里）；配置开关切换（为被否方案加旋钮，违背「只为当前消费者增加结构」）。

### 2c. 写沉淀：工具主动写；v1 不用 outputTap、不写 threads（结论）

**结论：写路径唯一——Coo 调 `nmem_save`（ENV_PROMPT 约束调用时机与内容质量）。`outputTap` 不实现；`POST /threads` 不使用。**

- `outputTap` 被否理由：① 拿不到用户输入（R14/B29），拼出的「对话记录」只有 Coo 单侧，沉淀价值残缺；② 增量拼接的边界（重试、`preempt` 取消残留）未被探索验证（coopanion-extension「未覆盖」节）；③ 与工具写形成双写路径，恰好制造它想解决的重复写问题；④ 未经 Coo 策展的自动沉淀违背 Mem 的定位（「memory 用于 durable takeaway」，nmem-api §2.7）。扇入并存事实（B50/B51）只说明**可行性**，不构成**必要性**。
- `POST /threads` 被否理由：服务端自动提炼副作用（`extracted_memories`/`auto_extraction_performed`，R5）会与 `nmem_save` 双写记忆；D2 的需求是「对话中的**新记忆**沉淀」，不是「对话原文归档」，`POST /memories` 已完整覆盖。将来若要对话归档，须先解决自动提炼的关停/去重参数（未验证），另立任务。
- **32KB 限制（R8）处理**：工具参数 `content` maxLength 30000（给 UTF-8 字节/字符口径差异留余量）；超限**不静默截断**——返回 `failed` 回执并明确告知「内容过长（>30000 字符），请提炼后重试」，让模型自行压缩重写（静默截断会制造假记忆，违背失败语义诚实原则）。ENV_PROMPT 同步要求「单条记忆保持精炼」。
- **幂等策略**：新建不传 `id`（Coo 无法预知服务端 id）；「更新既有记忆」由 Coo 在 `nmem_search` 回执里拿到 id 后传给 `nmem_save` 完成服务端 upsert（R9）。不做「先搜后写」的客户端去重（搜索相似度≠同一记忆，误判会造成覆盖丢失；upsert 语义已足够）。

### 2d. 与 PARTNER.md 的关系（A5）：ENV_PROMPT 并行写策略（结论）

**结论：默认「并行写」。ENV_PROMPT 明示：Coo 照常维护 PARTNER.md 工作区习惯（Persona 行为不动），同时把值得长期保留的事实/偏好/决定**另存** Mem（`nmem_save`）。不设模式旋钮。**

理由：

1. D2 用户已裁定「双向」而非「替换内置记忆」——并行写是该裁定的直接落法。
2. 「仅 Mem」在契约上不可实施：PARTNER.md 由 Coo 的 Persona 硬拼进前缀（A5–A8），World 既删不掉它也没有写 hook（R5/B11）；它只能是一句无法兑现的提示词空话，还会造成 Coo 记忆行为混乱。
3. 两系统职责不同：PARTNER.md 是「每轮进前缀的工作记忆」（persona.ts 注释要求精简，A6），Mem 是「可检索的长期知识库」。并行不是重复建设，是两个不同消费者的各自真相源。
4. 不加旋钮：三模式中唯一有实质差异的是提示词措辞（「另存」vs「优先存 Mem」），v1 没有该偏好输入，按需改一段 ENV_PROMPT 文本即可，不值得配置面。

**再次标注：这是提示词策略，不是代码 hook**（hook 在契约层不存在，B11/R5）。建议 orchestrator 向用户做一次非阻塞披露（§6.2）。

### 2e. 配置与秘密（结论）

**ConfigGroup 旋钮（全部路径落在 `worlds.nmem.*` 段内，dry-mount 会校验，B8）：**

| 旋钮 | 类型/默认 | `x-hot` | 说明 |
| --- | --- | --- | --- |
| `worlds.nmem.enabled` | boolean / `false` | — | 默认禁用，用户在 World 总览启用（R3）。**不作为 ConfigGroup 旋钮**（T1 纠正轮 C1 裁定 B：模板仅声明自有旋钮，enabled 由 World 总览开关管理，避免设置页双重「启用」开关；interface/defaults 保留） |
| `worlds.nmem.baseUrl` | string / `http://127.0.0.1:14242` | `false` | 远程填 `https://<host>`；改动需重启（client 在 create() 构造，websearch 同模式 B47） |
| `worlds.nmem.searchLimit` | integer 1..10 / `5` | `true` | `nmem_search` 缺省条数；热改生效（cfg 活引用） |
| `worlds.nmem.searchMode` | enum `fast\|deep` / `fast` | `true` | 交互场景优先低延迟（fast=BM25+vector）；工具参数可按次覆盖 |

**秘密：`NMEM_API_KEY` 经部署 `.env`（`ctx.secret()` 在 create() 读取）。**

- 依据 websearch 模式（B47：`ctx.secret(WEBSEARCH_SECRET)` 读 `.env`）。v1 无面板，因此 `storeSecret` 不被调用：README 指引用户手动编辑部署 `.env`（路径 `~/Library/Application Support/Coopanion/home/companion/.env`，C2/C19 推断，T1 sideload 时确认）写入 `NMEM_API_KEY=...`。
- `storeSecret` 拒空值/含空白值（R7/B26）：nmem key 形如 `nmem_...` 无空白，正常路径不受影响；README 注明 key 不得含空白。若将来做面板，`storeSecret` 是写入路径（B26：写后即时进进程环境，secret() 立即可读——但仍建议重启以重建 client）。
- 空值语义：`apiKey` 为空串/缺失 ⇒ 客户端**完全不发鉴权头**（R2：本机免 key，带错 key 反而 401）。日志与回执永不回显 key。

**不复用 `~/.nowledge-mem/config.json`（结论：不读）。**

- 理由：① 它在 Cortico 配置/秘密机制之外，引入同一设置的第二真相源，还要定义优先级（config.json vs `worlds.nmem.baseUrl` vs `.env`），复杂度不成比例；② 本地默认值 `127.0.0.1:14242` 已覆盖绝大多数场景（config.json 只在远程时有信息量）；③ 远程用户一次性设置 `baseUrl` + `.env` key 即可，README 写清两条命令对照（`nmem config client set url …` / `set api-key …` 是两次独立调用，nmem-api §2.6）。
- 被否选项：读该文件自动继承（上述）；把 `NMEM_API_URL`/`NMEM_API_KEY` 环境变量作为隐式默认（shell 启动的 env 与部署 `.env` 双来源，排查困难）。将来如有真实需求，可加显式「继承 Mem CLI 配置」开关，另立决策。

### 2f. 错误与降级（结论）

**客户端错误分类（`src/mem/` 拥有，具体 Error 子类）：**

| 情形 | 行为 | 工具回执 |
| --- | --- | --- |
| 传输失败/超时（固定 10s，`AbortController`，B47 brave-client 同法） | 不重试（本机 Mem 未启动是最常见原因，立即诚实失败） | `failed:true` +「Nowledge Mem 不可达（…）：请确认 Mem 正在运行」 |
| 401 | **不重试**（错 key 重试会触发 429 限流，R3） | `failed:true` +「认证失败：API key 无效或已轮转」 |
| 429 | 单次退避重试（`Retry-After` 头或缺省 1000ms），再失败即止 | `failed:true` +「Mem 限流，请稍后再试」 |
| 502/503/504 | 单次重试（500ms） | 重试后仍失败 → `failed:true` +「Mem 服务端错误」 |
| 4xx 其他 | 不重试 | `failed:true` + 状态码与响应摘要（截断） |
| 响应形状不可解析 | `MemProtocolError`（防 R4 形态漂移） | `failed:true` +「Mem 响应异常，可能版本不兼容」 |

- 回执语义：handler 不抛裸异常（抛错也会被 Core 转失败回执，B15，但文案不可控）；统一返回 `{ text, failed: true }` 带可行动中文文案。成功回执有界（每条结果摘要截断 ~200 字符，条数上限即 `limit` 上限 10），保护上下文预算。
- **解析纪律（R4）**：`/memories/search` 返回**裸数组**、`/memories/{id}` 返回**裸对象**、`/memories` 列表返回 `{memories:[…]}`——client 按端点分别收窄为具体类型（`MemoryHit[]`、`MemoryRecord|null`、…），统一在一个 ingress 点完成（响应是不可信输入），工具层只见具体类型。search 元素 `memory` 可为 `null`（nmem-api §2.3）：跳过并计数，回执注明「N 条结果因数据缺失被略过」，不猜测补全。
- ENV_PROMPT 配套一句：工具失败时简短告知用户 Mem 不可用/未配置，然后继续力所能及地帮忙（不重试轰炸）。

---

## 3. 测试与验收策略

### 3.1 单元测试（vitest，全部离线）

- **client 层（`mem-client.test.ts`）**：构造注入 transport（`MemClientConfig.transport?`，缺省全局 `fetch`）——不用 mock 库替换全局。行为矩阵：无 key 不发鉴权头 / 有 key 发 `Authorization: Bearer` / 401 映射且不重试 / 429 退避重试一次 / 503 重试一次 / 超时中断 / search 裸数组收窄 / get 404 → `null` / 坏 JSON → `MemProtocolError` / search 元素 `memory:null` 跳过。
- **工具层（`tools.test.ts`）**：参数校验（空 query、content 超长→failed 文案）、回执格式（编号、截断、upsert 回执含 id 与 action）、溯源字段透传（source/source_app/agent_id/默认 label）。
- **world 层（`world.test.ts`）**：`dryMountWorld` 零失败（B46/dry-mount 自带工具名冲突与配置路径检查）；`start` 推送 `nmem.started` 且 `origin:'internal'`；`describeTools` 输出与提交的 `describe.json` 一致；`enabled:false` 默认；cfg 热改 `searchLimit` 后工具行为随之变化（模板测试同法，B45 tests）。
- 测试不调用真实网络；`FakeHost` 照模板 `tests/helpers/fake-host.ts` 适配。

### 3.2 契约测试（对真实本机 Mem，只读为主，opt-in）

- `contract.nmem.test.ts` 以环境变量门控（如 `NMEM_CONTRACT_BASE_URL` 未设则 skip），默认目标 `http://127.0.0.1:14242`：
  1. `GET /health` → 200（探活）；
  2. `POST /memories/search`（fast）→ 200 且可收窄为 `MemoryHit[]`（对齐 R4 实测形态）；
  3. **沙箱写读回**：`POST /memories` 用固定 `id='coopanion-nmem-contract-probe'` + `labels:['coopanion','contract-test']` upsert → 响应 `action` ∈ {created,updated} → `GET /memories/{id}` 读回内容一致。固定 id 使重复运行自我覆写、不累积数据（DELETE 端点存在性未验证，不依赖它清理；探针记录永久留存一条并在测试注释外于 README 说明）；
  4. 带假 key 请求本机 → 期望 401（验证「有 key 才发头」分支与错误映射，对齐 R2 实测）；
  5. deep 模式延迟观测（信息性记录，为 10s 超时常数提供依据）。
- 契约测试不进默认 `pnpm test`（保持离线可跑），由 T4 验收与 CI 可选任务显式开启。

### 3.3 真机验收（sideload，D6）

**三步安装**（A22/B2/C13–C17）：① 设置 → 高级模式 → Extensions 页 → local 分段 → 选本仓库目录 → Install（`POST /api/extensions/install {path}`，pnpm link）；② Restart process；③ World 总览启用 `nmem`。

**场景清单**（每项记录证据：Coo 行为 + Mem 端核对）：

| # | 场景 | 期望 |
| --- | --- | --- |
| A 读召回命中 | 预置一条独特事实（Mem 界面/CLI 写入，如「用户的猫叫 Pixel」）→ 问 Coo「我的猫叫什么？」 | Coo 调 `nmem_search` 并引用该记忆作答 |
| B 写沉淀 | 告诉 Coo 一条新持久事实并要求记住 | Coo 调 `nmem_save`；Mem 应用/`GET /memories` 检索到该条，`labels` 含 `coopanion`、`source='coopanion'`；再次要求补充时带 `id` upsert 而非新建 |
| C 断连 | 退出 Mem 应用 → 问记忆问题 | 工具回执 `failed`，Coo 简短告知 Mem 不可用并继续对话；进程不崩溃不挂起；重启 Mem 后下轮恢复 |
| D 旋钮热改 | 改 `searchLimit`/`searchMode`；再改 `baseUrl` 为错误值并重启 | 前者无重启生效；后者重启后按新址连接（错址表现为场景 C） |
| E 远程（可选） | 用户提供远程 url+key（A6 未验证项） | 同 A/B 在远程端点通过；`.env` 配 key 后请求带 Bearer 头 |

---

## 4. codeharness 策略设计（用户裁定 D5）

### 4.1 `.codeharness/code-harness.json` 草案

```json
{
  "version": 2,
  "include": ["src/*", "tests/*"],
  "exclude": [],
  "third_party_modules": ["cortico", "vitest"],
  "checkers": {
    "function_size": {
      "lines": 50, "statements": 50, "complexity": 10, "nesting": 3, "parameters": 5
    },
    "architecture.owner": {
      "owners": [
        { "name": "world composition and entry", "paths": ["src/index.ts", "src/definition.ts"] },
        { "name": "mem rest client", "paths": ["src/mem/*"] },
        { "name": "world tools and events", "paths": ["src/world.ts", "src/tools.ts"] },
        { "name": "config and secrets", "paths": ["src/config.ts"] },
        { "name": "verification", "paths": ["tests/*"] }
      ]
    },
    "architecture.import": {
      "boundaries": [
        {
          "name": "mem client stays framework-agnostic",
          "sources": ["src/mem/*"],
          "forbidden_imports": ["cortico", "cortico/*", "cortico.*"]
        },
        {
          "name": "only the mem client owns network transport",
          "sources": ["src/index.ts", "src/definition.ts", "src/world.ts", "src/tools.ts", "src/config.ts"],
          "forbidden_imports": [
            "node:http", "node:http/*", "node:https", "node:https/*",
            "undici", "undici/*", "axios", "axios/*"
          ]
        },
        {
          "name": "config section owns the configuration surface",
          "sources": ["src/config.ts"],
          "forbidden_imports": [
            "./mem/*", "../mem/*", "src/mem/*",
            "./tools.ts", "./world.ts", "src/tools.ts", "src/world.ts"
          ]
        },
        {
          "name": "runtime does not depend on tests",
          "sources": ["src/*"],
          "forbidden_imports": ["tests", "tests/*", "vitest"]
        }
      ]
    }
  }
}
```

设计说明与已知限制：

- 边界语义（README：模式大小写敏感、`*` 跨斜杠、JS/TS 相对导入同时匹配根相对路径带/不带扩展名，故 config 边界同时列多种写法）。
- **全局 `fetch` 无法被 import 边界捕获**（Node 22 全局，非导入）：「工具层不得绕过 client 直连 fetch」以两条近似强制——禁 `node:http(s)`/`undici`/`axios` 导入（覆盖显式拉网络库的路径）+ 语义评审义务（门禁不证明运行时行为，属 README「Enforcement and limits」声明的边界）。单测的 transport 注入缝也让「client 是唯一传输所有者」可被评审直接观察。
- `third_party_modules` 匹配方式**已实测定稿（T1，2026-10-26）**：按精确 specifier 匹配，`"cortico"` 与 `"cortico/*"` 均不覆盖路径形导入（`cortico/world.ts` 等，条目惰性）；精确列举虽可匹配但产生 6 条 `type.boundary` 误报（门禁不做类型推断，把已类型化框架函数结果判为未收窄），`vitest` 列入产生 22 条 `expect()` 链误报。**定稿：保留惰性 `"cortico"`、不列 `vitest`**；类型安全由 `tsc --noEmit`（strict）承担，`src/mem/*` 禁 cortico import 由 `architecture.import` 边界实测兜底（T1-R2 探针命中）。
- `JSON.stringify` 在 HTTP 请求体出口属合法 egress，但门禁的 `type.broad` 只识别列出的输出位——若 T2 实测报告该点，按 checker-configuration.md 增加 reviewed `type.broad.encoding.outputs` 声明（`fetch` 调用、body 参数位），该变更属策略变更，需全量审计 + architecture 审查（codeharness AGENTS 纪律）。
- 不配置 `architecture.object_model`：包内入口已是类所有（`MemClient`/`NmemWorld`），模块级常量（`NMEM_TOOL_DECLS`）是 cortico 模板约定的数据声明而非过程入口；如后续出现函数式扩展点再收紧。
- `include` 覆盖 `src/ENV_PROMPT.md` 但门禁只分析受支持语言文件，markdown 不受影响；`describe.json` 在 include 之外。
- `function_size` 用 engineering-standards 默认上限，不做放宽。

### 4.2 本仓库 `AGENTS.md` 规约要点（草案）

1. 改动/评审代码前先读 `../codeharness/docs/engineering-standards.md`（覆盖 TS）。
2. 类型保真：具体类型端到端；Mem 响应在 client ingress 一次性收窄；禁 `any`/`unknown` 宽化、断言、序列化往返绕边界；`JSON.stringify` 仅限 client 的 HTTP 请求体出口（如门禁不识别，按 §4.1 加声明而非绕过）。
3. 架构边界以 `.codeharness/code-harness.json` 为准并与实现一致；策略变更需全量审计 + architecture 审查。
4. 完成前跑：`pnpm typecheck`（`tsc --noEmit`——门禁不做类型推断，TS 项目必须配类型感知检查器）、`pnpm test`（vitest run）、以及（codeharness 环境就绪后）在 `../codeharness` 下 `uv run --no-sync code-harness --root <本仓库绝对路径> --all`。
5. **不自动回滚/还原/丢弃/删除代码改动**；门禁只读；不得以排除文件、调高阈值、刷新 baseline 制造通过。
6. 不写实现注释与压制注释（JS/TS 唯一例外：批准的 next-line 诊断压制，须带精确规则 ID 与理由）。
7. `describe.json` 与工具声明保持同步（一致性测试守护）；dry-mount/check 通过 ≠ 联网可用（B8：check 不验证真实服务）。
8. 秘密只经部署 `.env`（`NMEM_API_KEY`），不进 config.json、日志、回执或测试快照。

---

## 5. 业务子任务拆分建议

原则：一个任务交付一个内聚业务行为；不按工作量切分。集成责任：**T3 拥有 client↔world 的集成**；整体联调验收在 T4 与 orchestrator 整体验收。

| 任务 | 目标（行为） | 范围 | 非目标 | 依赖/前序交付物 | 验收方式 | 并行边界 |
| --- | --- | --- | --- | --- | --- | --- |
| **T1 仓库脚手架与工程门禁** | 一个可安装、可挂载的最小 World 包 + 工程门禁就位 | `package.json`（manifest）、tsconfig/vitest、`src/{index,definition,config,world}.ts`（0 工具 + `nmem.started` 事件 + 全量配置段与 ConfigGroup）、ENV_PROMPT 占位、`describe.json`、`.codeharness/` + `AGENTS.md`、`tests/helpers` + world 骨架测试；同步完成 codeharness 环境同步（`uv sync`，安装动作需此任务授权）与 §7 缺口 2–5 的实测校正 | 任何 Mem 调用、工具实现 | 无 | vitest+tsc+`code-harness --all` 全绿；本机 sideload 三步成功、事件流见 `nmem.started`；无面板下旋钮在设置界面可见（确认缺口 5） | 唯一全并行前序；T2/T3/T4 不得在其合入前动 `package.json`/门禁文件 |
| **T2 Mem REST 客户端层** | 一个类型化、可独立测试的 Mem 客户端 | `src/mem/{client,types}.ts`、`tests/mem-client.test.ts`（§3.1 行为矩阵） | 工具语义、World 契约、真实 Mem 联测（归 T4） | T1（骨架） | 单测矩阵全绿；门禁绿（含「无 cortico import」边界） | 可与 T3 并行：接口契约以本文 §1.4/§2f 为准冻结，`types.ts` 优先合入作 seam |
| **T3 World 工具与提示词策略** | Coo 能经 `nmem_*` 工具读写 Mem（提示词引导） | `src/tools.ts`、`src/world.ts` 接线、`src/ENV_PROMPT.md` 全文（§2b/§2c/§2d 策略）、`describe.json` 更新、`tests/{world,tools}.test.ts`；**负责 client↔world 集成** | 真机联调与 runbook（归 T4）；远程验收 | T1 + T2（或并行至集成点） | dry-mount+工具单测（fake client）全绿；describe 一致性测试绿；门禁绿 | 与 T2 并行至集成点，集成段独占 |
| **T4 契约测试与真机验收支撑** | 验证链路成立并留下可重复的验收材料 | `tests/contract.nmem.test.ts`（§3.2）、`README.md`（安装/配置/秘密/安全说明 + §3.3 runbook）、执行一轮完整场景 A–D（E 视用户输入）并记录证据 | 新功能；市场发布材料（用户决策） | T3 | 契约套件对 127.0.0.1:14242 全绿；场景 A–D 通过且留证 | 契约测试编码可在 T2 后先行，执行依赖 T3 |

并行总览：T1 → {T2 ∥ T3(至集成点)} → 集成（T3 内）→ T4。串行最小路径 T1→T2→T3→T4。

---

## 6. 决策归属清单

### 6.1 本方案已定夺（依据可追溯）

| # | 决策 | 依据 |
| --- | --- | --- |
| 1 | REST 直连，不用 MCP/SDK/生成客户端 | §2a（R12/R13、nmem-api §3.1） |
| 2 | 纯工具召回；`envPromptVars` 禁 I/O，返回空变量表 | §2b（B16、R14/B29） |
| 3 | 写路径唯一 `nmem_save`；v1 不用 `outputTap`、不写 `/threads` | §2c（R5、R14、B50/B51、D2 口径） |
| 4 | PARTNER.md 并行写提示词策略，不加模式旋钮 | §2d（D2、A5–A8、R5/B11） |
| 5 | 配置四旋钮 + `.env` 秘密 `NMEM_API_KEY`；不复用 `~/.nowledge-mem/config.json` | §2e（B16/B26/B47、R2/R7、nmem-api §2.6/§3.1） |
| 6 | 错误分类、重试矩阵、`failed` 回执语义、按端点 ingress 收窄 | §2f（R2/R3/R4、B15） |
| 7 | 工具集 `nmem_search`/`nmem_get`/`nmem_save` + `nmem.started` 事件；`nmem_` 前缀；id upsert 幂等；source/source_app/agent_id 溯源；默认 label `coopanion` | §1.4（B15/B25、R9、nmem-api §2.3） |
| 8 | 分层/目录/零运行时依赖；`start()` 不探活；transport 注入测试缝 | §1.2/§1.3（B45/B47、C10/C11） |
| 9 | codeharness 策略与 AGENTS 规约（含草案全文） | §4（D5、codeharness README/AGENTS/engineering-standards） |
| 10 | 子任务拆分 T1–T4 与集成归属 | §5 |
| 11 | 包名 `cortico-world-nmem`、license MIT（模板同款；仅用 MIT cortico 类型） | §1.1（B10/B45）；发布市场时随 §6.2-1 复议 |

### 6.2 留给用户的决策（经 orchestrator 汇总提问；附建议与影响）

| # | 决策 | 我的建议 | 影响 |
| --- | --- | --- | --- |
| 1 | 是否发布官方市场（`Pal-AI-Lab/cortico-extensions`） | 本期不做，后续独立需求 | 做则需补 `tags`/`locales`/`screenshots`/`CHANGELOG`/`os` 声明与 npm 占名（B4、R13）；不影响本架构 |
| 2 | WebUI 面板做不做 | v1 不做 | 无面板：配置走旋钮、秘密靠 `.env` 手动编辑；做面板需另立任务（`storeSecret` 写入路径 + renderer 白名单 R8/C7 约束：面板不得外联，Mem 请求只在 Node 侧） |
| 3 | 远程验收深度（A6） | 本期仅本地验收 + 远程配置能力与文档就绪；用户给 url+key 后补一次连通冒烟（场景 E） | 不补测则 A6 保持未验证，README 需注明远程路径「文档结论、未实测」 |
| 4 | （非阻塞披露）PARTNER.md 并行写默认、`nmem_save` 默认 label `coopanion` | 维持本文默认 | 用户若倾向「Mem 优先」措辞，改 ENV_PROMPT 一段文本即可 |

---

## 7. 验证缺口与未决事项（实现期需逐项关闭）

1. **codeharness 运行前置（D5①）——已关闭（T1）**：本机 uv 0.13.5 直接 `uv sync --locked --group dev` 成功（无需改装 0.8.22）；`code-harness` `1.0.1.dev6+gbd9ca28e6` 可运行，`../codeharness` git 保持干净；设计期遗留的空 `.venv/` 已被同步填充。
2. **`check:extension`/`describe:extension` 第三方可用性——已关闭（T1）**：npm 发布包 cortico 不含这两个 scripts（exports 仅 `./package.json` 与 `./* → ./src/*`）；长期替代：经 `cortico/extensions/describe-export.ts` 的 `exportDescribe`/`checkDescribe` + describe 一致性单测（byte-equal 守护）。
3. **`third_party_modules` 路径形匹配——已关闭（T1）**：见 §4.1 补记（保留惰性 `"cortico"`、不列 `vitest`，两项误报已独立复现）。
4. `JSON.stringify` 在 fetch 请求体出口是否触发 `type.broad` → T2 实测；触发则加 reviewed encoding outputs 声明（策略变更流程）。
5. **无面板时 ConfigGroup 旋钮呈现——已关闭（T1，API 级）**：`GET /api/config` 的 `world:nmem` 组四旋钮完整呈现（baseUrl 文本框需重启 / searchLimit 数字框热改 / searchMode 下拉热改）；GUI 目视确认未做（按 T1-D4 口径，API 证据已采）。C1 裁定 B 后 enabled 旋钮移除，呈现重叠不复存在。
6. Mem `DELETE /memories/{id}` 端点存在性未验证 → 契约测试不依赖删除（固定 id 覆写），如后续验证存在可加可选清理。
7. deep 模式本机延迟基线未测 → T4 契约测试顺带观测；10s 超时常数如不足在 T2 内调整（保持常数、不加旋钮）。
8. 远程链路（A6）未验证 → 见 §6.2-3。
9. 部署 `.env` 的确切路径（`~/Library/Application Support/Coopanion/home/companion/.env` 由 C2/C19 推断）→ T1/T4 验收时确认并写入 README。

---

*本文档由 architecture 角色在 ARCH-DESIGN-1 内交付；重要决策与边界的合入由 orchestrator 协调进主文档。*
