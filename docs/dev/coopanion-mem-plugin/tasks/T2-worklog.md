# T2 组内任务文档 / Worklog：Mem REST 客户端层

- 任务标识：`T2-mem-client`｜主文档：`docs/dev/coopanion-mem-plugin/main.md` **v0.5**（D1–D11；T1 组级验收通过，基线 `496fd20` + 文档 `96a63c5`）
- 简报：`tasks/T2.md`（含随附项 7：L5 一行修复 + ConfigGroup 旋钮集合守护测试）｜方案：`architecture.md` §1.2/§2a/§2e/§2f/§3.1/§4/§7（缺口 4/7）
- 全局轮次：**第 0 轮（初始实施）**；全局纠正剩余额度 1（共享，本组无独立额度）
- 本文档：T2 planner 维护；不构成新的需求或架构权威。实施结束后标记「实施已结束、待主文档汇入」。

## 1. 目标与边界（引用）

- 目标：类型化、框架无关、可独立单测的 Nowledge Mem REST 客户端 `src/mem/{client,types}.ts` + 行为矩阵单测 `tests/mem-client.test.ts`（全部离线）；关闭缺口 4（JSON.stringify 请求体出口是否触发 `type.broad`）；观测缺口 7（本机 deep 延迟）；随附 L5 修复与旋钮集合守护测试。
- 非目标：工具语义/回执（T3）、World 契约与 `cortico` import（`src/mem/*` 禁）、真实 Mem 联测（T4）、MCP/`/threads`/删除端点/SDK/OpenAPI 生成。
- 冻结：`package.json`、`.codeharness/code-harness.json`、`AGENTS.md`（变更走全量审计 + 经用户带回 architecture 审查）；`vitest.config.ts` 的 L5 一行移动为主文档 v0.5 明确授权项，不属冻结。
- C2 约束（T1 汇入）：热改键不得构造期快照；`MemClient` 仅接收非热改参数（baseUrl/apiKey）；热改项（searchLimit/searchMode）由调用方现读 `ctx.cfg`；禁读磁盘 config.json。

## 2. 初始核查事实（planner，2026-10-26）

| 项 | 事实 |
| --- | --- |
| 基线 | git main：`496fd20`（T1 代码基线）→ `96a63c5`（orchestrator v0.5 文档汇入）；工作树干净；planner 复跑 `pnpm typecheck` 0 / `pnpm test` 6/6 通过 |
| 会话环境 | 机器 `e943be61`（Tomahawkds-MacBook-Pro.local）；项目 local `coopanion-nmem`（git main）；本会话为用户独立启动的 planner 主会话（`4b0a14ea`） |
| 现有 src | `index/definition/config/world.ts` + ENV_PROMPT.md；无 `src/mem/`；测试 `tests/world.test.ts`（6 用例）+ `tests/helpers/fake-host.ts` |
| 角色可用 | coder `82d753f3…`、tester `c847b69d…`、reviewer `107c334d…`、architecture `3440ee5c…`、explorer `fdeb6627…`（机器 e943be61；T1 同批） |
| pnpm | 本机无全局 pnpm/corepack，一律 `npx -y pnpm@11.28.6`（T1-D1 延续） |
| 契约参照 | `/tmp/openapi.json`（555KB，只读；`info.version` 不可信 R6）；探索报告 `explorations/nmem-api.md`（R2/R3/R4/R8/R9） |
| 缺口 7 观测（planner，2026-10-26 14:52，只读 POST search） | 本机 Mem 0.10.108（local-gguf 未降级）：**fast ≈ 0.032–0.171s（2 次）；deep ≈ 2.14–2.19s（2 次）**。10s 超时常数余量充足（deep ≈ 4.6×），**维持 10s 不调**；不加旋钮。证据：`curl -w time_total` 输出（上表即记录） |

## 3. 组内计划与任务映射

| # | 任务 | 角色/会话 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| P1 | 初始实现：`src/mem/types.ts`（seam 优先）+ `src/mem/client.ts` + `tests/mem-client.test.ts` + L5 一行修复 + 旋钮集合守护测试 + 缺口 4 实测 + 四命令 | coder | **执行中** | 单会话承载；写入范围仅 `src/mem/*`、`tests/*`、`vitest.config.ts` |
| P2 | 独立验证：四命令复跑、覆盖缺口检视、行为矩阵对简报逐条核对、L5/守护测试核对、缺口 4 结论复核 | tester | 待 P1 | 只读+运行；不改产品代码 |
| P3 | 联合准入：reviewer + architecture 同一代码状态审查 | reviewer、architecture | 待 P2 | 两方独立结论；可能交叉核对 |
| P4 | 组级验收 + 与 T3 契约快照定稿 + worklog 交付 + 按逻辑分次提交（简报授权） | planner | — | 停止边界 |

会话映射（operation → session）：见 §6 登记表。

## 4. 对执行角色的关键输入（摘录）

- 行为矩阵（§2f）：无 key 不发鉴权头 / 有 key 发 `Authorization: Bearer`；401 不重试；429 单次退避重试（`Retry-After` 或 1000ms）；502/503/504 单次重试 500ms；超时 10s `AbortController`；坏 JSON/坏形状 → `MemProtocolError`；get 404 → `null`；传输失败不重试。
- 方法面恰四：`searchMemories`、`getMemory`、`saveMemory`（`id` 可选 upsert；source/source_app/agent_id 由工具层传入、client 只透传）、`health`。
- 类型收窄（R4）：search 裸数组 → `MemoryHit[]`（元素 `memory` 可为 `null`，client 不滤、由 T3 跳过并计数）；get 裸对象 → `MemoryRecord|null`；save 响应含 `action:'created'|'updated'`；列表 `{memories:[…]}` 无消费者，不建类型（R4 认知体现在按端点分别收窄）。
- 缺口 4 口径：实测并**原样记录** finding（规则 ID/位置/消息）；不改门禁、不压制、不绕过；声明与否的裁定在组外。
- 测试离线：fake transport 注入（构造缝），不用 mock 库替换全局 fetch；无真实网络调用。

## 5. 决定记录

| # | 决定 | 依据 |
| --- | --- | --- |
| T2-D1 | 10s 超时常数维持（deep 实测 ≈2.2s，余量充足）；不加旋钮 | 缺口 7 观测（§2 表）；§2f 固定 10s |
| T2-D2 | 缺口 7 观测由 planner 以只读 curl 完成（信息性，不进测试套件） | 简报第 6 条「信息性」定位；测试默认离线约束 |
| T2-D3 | ingress 收窄改写为「验证后构造」惯用法（内联 `JSON.parse` + typeof/Reflect.get 校验 + 构造声明类型，不用 `unknown`/`object` 注解、不用断言）：属第 0 轮完成修正，非躲避 | 工程标准原文禁 unknown/object 宽化（planner 探针②：该惯用法门禁 0 findings + tsc strict 0）；「Extract only the typed facts needed by consumers」 |
| T2-D4 | 2 条 stringify finding 维持实现原样，升级处置：提议 `type.broad.encoding.instance_outputs: [{path:'src/mem/client.ts', class_name:'MemClient', member:'send', arguments:[2]}]`（探针⑤已验证有效）；属策略变更（门禁文件冻结），经用户带回 orchestrator，全量审计 + architecture 审查后裁定 | 简报缺口 4 口径 + 冻结约束；探针④证明无合规代码路线 |

## 6. 会话登记与验收记录

| 任务 | 角色 | operation | session | 状态 |
| --- | --- | --- | --- | --- |
| T2-P1 初始实现 | coder | `T2-P1-CODER-IMPL` | `c4aa34dc-2533-4a31-b7ea-0de646771fc7` | **完成**（15:00 回执；证据 `/tmp/t2-p1-evidence/`；见 §6.1） |
| T2-P1F 第 0 轮完成修正（D-1 + ingress 惯用法） | coder | `T2-P1F-CODER-FIX` | `d341e44c-6b00-4acf-b9e0-94d318cd23f5` | **完成**（15:13 回执；见 §6.2；证据 `/tmp/t2-p1f-evidence/`） |
| T2-P2 独立验证 | tester | `T2-P2-TESTER-VERIFY` | `2760b042-9dea-4111-a772-1e581d3adfa7` | **完成**（15:17 回执；无阻塞级缺陷；见 §6.3；证据 `/tmp/t2-p2-evidence/`） |
| T2-P2F 测试缺口补全（G6/G1/G2） | coder | `T2-P2F-CODER-TESTGAP` | `b2321505-b5a4-4941-92b0-fd175d4c034a` | **完成**（15:20 回执；见 §6.4；证据 `/tmp/t2-p2f-evidence/`） |
| T2-R1 联合准入（实现审查） | reviewer | `T2-P3-JOINT-ADMIT`#1 | `43233eaf-fcd1-44f8-9df5-3ecd1b5ca35e` | **执行中**（15:22 派发；与 R2 并行；代码状态已冻结） |
| T2-R2 联合准入（架构审查） | architecture | `T2-P3-JOINT-ADMIT`#2 | `3ca19786-d557-42ea-b4f9-f78e3aff5735` | **执行中**（15:22 派发；含待议事项一（缺口 4 声明）与二（O1）第一评审意见） |

| T2-R1×R2 交叉核对（分歧与前提互核） | reviewer / architecture | `T2-P3-XCHECK`（chat 原会话） | `43233eaf…` / `3ca19786…` | **双方完成**（15:39；收敛结论见 §6.7；R1 回执 `/tmp/t2-r1-review.L1SqJn/crosscheck.md`，R2 探针 `/tmp/t2-arch-r1-verify.mts`） |

### 6.4 P2F 结果摘要（coder 回执）

- 仅改 `tests/mem-client.test.ts`：新增 `expectSameRequest` 辅助；G6 就地补 429/503 重试一致性断言 + 新增独立 describe 两条跨方法用例（POST+鉴权重发、GET 无 body 重发）；G1 补 504 间隔边界（499/500ms 双点）；G2 新增非 Error 抛出用例。用例 33→36，总 43。
- 四命令：typecheck 0 / test 43/43 / coverage 0（src/mem 分支 97.24%→98.19%，`client.ts:166` 已覆盖，无劣化）/ harness 恰 2 条 stringify finding。
- 变异闭环：M13 重放红（3 failed）；5xx 退避常量变异红（503+504）；非 Error 分支变异红。
- 过程合规：首版曾触发 2 条 `size.lines`（describe 回调>50 行），未压制/未改门禁，拆独立 describe 收敛回恰 2 条。

### 6.5 T2-R1 结论（reviewer，拒绝：需修改）

- **阻塞 R1-F1**：`client.ts:190` 不识别 `Retry-After` 的 HTTP-date 形式——离线探针实测服务端指示约 60s（date 形式），客户端 ~1009ms 即重发；43 用例全绿无覆盖。需修解析+补 date 边界用例。
- **门禁条件未闭环**：2 条 stringify finding 原样保留处置合理，但声明审批/全量审计/architecture 审查完成前不能视为门禁通过（与 R2 条件一致）。
- **O1**：无 id 写入确实会重放，相同请求体不能证明幂等；当前符合既定矩阵、重复落库尚未实测——转 architecture 裁定（R2 已给意见，交叉核对确认中）。
- 其余：D-1、C2、类型边界、L5、旋钮守护、G1/G2/G6 补全均可接受；typecheck/43 用例亲跑绿；覆盖与变异证据抽验；审查前后代码哈希一致。详细回执 `/tmp/t2-r1-review.L1SqJn/review.md`。

### 6.6 T2-R2 结论（architecture，有条件接受）

- **唯一准入条件**：缺口 4 声明经用户批准落入门禁后，真仓库全量审计复跑须 0 findings（其独立探针已预测 0）；除此之外无代码条件。若用户否决声明则结论失效重审（无合规代码路线，双方探针互证）。
- **待议事项一（缺口 4）**：**建议采纳** `instance_outputs:{path:'src/mem/client.ts', class_name:'MemClient', member:'send', arguments:[2]}`——真源+精确声明亲证 0 findings，三组负对照（第 0/1 参、内部消费者、as 断言均仍报）证明最小性；transport 注入契约满足「审批即信任」前提（私有 readonly、缺省 fetchTransport/测试 fake 两实现、无发出体内部消费）；配套义务四条（用户批准/落地后全量审计 0 findings/登记理由与移除条件/声明随源快照 fail-closed）；合入时 §4.1 补记应更新为最终机制（文档义务）。
- **待议事项二（O1）**：**建议 维持均匀矩阵+登记已接受风险**，远程化（A6/E）成真时再升级（无 id save 跳 5xx 重试或客户端生成 id）——设计层发现非实现不符，不阻塞。
- 非阻塞建议：①`retryAfterDelayMs` 数值退避无上限（建议 §2f 修订轮加上限如 ≥10s 快速失败；同句认为 date 回落可接受——与 R1 分歧，交叉核对中）；②502 未直接断言 500ms（常量级已守护，观测级）；③旋钮守护 key 顺序敏感（可接受）。
- 架构符合性亲证：六项职责唯一所有/依赖单向/无 cortico import/C2 落实/seam 质量/O3 响亮失败/MemHealth 最小化/L5 与守护授权均确认；探针证据 `/tmp/t2-arch-probe`。

### 6.3 P2 结果摘要（tester 回执）

- **结论**：无阻塞级缺陷，可进入 P3 联合准入。四命令：前三 exit 0（40/40）；harness exit 1 **恰 2 条** stringify finding（122:63/135:56，行号因 ingress 改写后文件缩短，性质与登记一致）；`architecture.import` 四边界 0 finding。
- **矩阵→用例映射 24 项全有对应用例**，10 组变异反证（M1–M13）除下述缺口外均红；真实端点只读冒烟全过（health/search/get 解析成功；不存在 id → 真实 404 → null；无效 key → MemAuthError 401 单次无退避；**缺省 fetch 适配器被真实网络实际执行**）；OpenAPI 抽查证实 `/health` Schema 漂移（D-1 修复方向正确）与 `memory:null` 为现实可达形态。
- **L5 实证**：修复前布局下顶层 `coverage` 键被 vitest 静默忽略（收窄 include 报告仍 6 文件）；修复后生效；T1 报告数字仍有效（M7 对照组）。
- **测试缺口（非缺陷，变异实证）**：**G6** 重试丢 body 时 33 用例全绿（无「重试请求=首次请求」断言）→ 已派 T2-P2F 补；**G1** 仅 503 断言 500ms 间隔（502/504 未断言）→ 同上；**G2** `client.ts:166` 非 Error 抛出分支未覆盖 → 同上。
- **观察项**：**O1** 429/5xx 重试对无 `id` 的 saveMemory 同样生效，服务端已落地但回 5xx 时可能重复写（§2f 未按方法区分，方案层议题→交 P3 architecture 意见）；**O2** 本机 `/health` 不鉴权，探活测不出 key 失效→T4 应对数据端点验鉴权；**O3** OpenAPI 允许 `memory`/`id` 缺失，客户端响亮失败（符合 §2f）；**O4** 范围/规约核查干净（门禁/package.json/describe/docs 未动，无注释违规）。
- 未验证边界（归 T4/T3）：真实写入/upsert、工具层回执语义、deep 端到端。

### 6.2 P1F 结果摘要（coder 回执 + planner 复核）

- **D-1 修正**：`MemHealth = {status}`，health 用例改真实形态（`{"status":"ok"}`）；**ingress 改写**：守卫全部换为解析函数 `parseMemoryRecord`/`parseMemoryHits`/`parseMemorySaveResult`/`parseMemHealth`（`(body: string) => T | null`，构造式只提取契约字段，SyntaxError 原样抛由 client 映射）；client 统一 `readBody(endpoint, body, parse)`。重试矩阵/鉴权头/错误子类/`this.send` 结构未动。
- **四命令**：typecheck 0；test 40/40（mem-client 33 + world 7）；test:coverage 0（src/mem 语句 95.85%/分支 97.24%/函数 95.83%；未覆盖仅缺省 fetch 适配器）；**harness 恰 2 条 stringify finding（122:63、135:56）**，与预期终态一致。
- **planner 复核（15:13）**：types.ts 无 `unknown`/`object`/`any`/`as`；构造式保留显式 `title:null`（缺失才省略）语义合理；`types.ts` 无反向 import；改动范围恰为授权三文件；工作树范围核对无越界。契约面（方法签名+导出清单）已入 §6.2 回执，将随准入定稿为 T3 seam 快照。

### 6.1 P1 结果摘要（coder 回执 + planner 核查）

- **交付**：`src/mem/types.ts`（115 行，契约类型+守卫）、`src/mem/client.ts`（242 行，`MemClient` 四方法+错误子类+transport 缝）、`tests/mem-client.test.ts`（30 用例，fake timers 无真实延迟）、`vitest.config.ts` L5 修复、`tests/world.test.ts` +旋钮集合守护用例。冻结文件未触碰；无实现注释/断言/压制。
- **四命令**：typecheck 0；test 37/37（mem-client 30 + world 7）；test:coverage 0（src/mem 语句 95.53%/分支 97.00%，未覆盖仅 `client.ts:85-92` 缺省 fetch 适配器——tsc 覆盖+T4 契约测试兜底，检视合理；index.ts 0% 为 T1 遗留已分流 T4）；**harness exit=1，10 findings（全 `type.broad`）**。
- **缺口 4 结论：触发**。`client.ts:122:63`/`141:56`（JSON.stringify 进 `this.send` 第 3 参）；另 8 条为 ingress 收窄注解（`parseJson` 返回 `unknown`、`readField` 的 `object`/`unknown`、四守卫的 `unknown` 入参）。coder 按纪律未压制/未绕过/未改门禁。
- **planner diff 核查（15:0x）**：测试矩阵逐条对照简报齐备；发现 **D-1 缺陷：health 契约错位**——真实 `GET /health` 仅返回 `{"status":"ok"}`（今日三次实测），OpenAPI `HealthResponse`（含 version/timestamp/database_connected/services_ready）实为 `/health/details` 形态（Schema 漂移，R6 类）；当前 `health()` 打 `/health` 却按 details 形态收窄，对真实服务必抛 `MemProtocolError`。修正口径：`MemHealth = {status: string}`（§3.2「探活」最小语义，其余字段无消费者）。
- **planner 门禁探针（/tmp/t2-gate-probe，只读，不动真仓库）**：①守卫函数 `unknown`/`object` 注解触发 `type.broad`；②**内联 `JSON.parse` 结果（不注解）+ typeof/Reflect.get 收窄 + 验证后构造声明类型 → 0 findings 且 tsc strict 0**；③`as` 断言触发 `type.assertion`（禁）；④stringify 无论直进 fetch 还是经 `this.send` 均触发；⑤**`instance_outputs{path, class_name, member, arguments}` 声明可精确消除 `this.send(…, stringify)` finding（实测 0 findings）**。
- **据此决定 T2-D3（见 §5）**：8 条 ingress finding 走合规改写（非躲避）——工程标准原文本就禁用 unknown/object 宽化，且构造式只提取消费者所需字段（「Extract only the typed facts needed」），属对齐标准而非绕过；2 条 stringify finding 无代码路线（探针④），走升级路径（T2-D4）。

### 6.7 交叉核对收敛结论（15:39）

- **R1-F1 定性收敛：阻塞级**（双方一致）。R2 撤回「date 回落可接受」：HTTP-date 是 RFC 9110 §10.2.3 两种合法形式之一、携带服务端明确指令，§2f「Retry-After 头」按标准语义读即双形式——属对现行设计文本的符合性缺口而非健壮性建议；R2 亲证复跑 R1 探针（attempts=2，elapsed 1009ms，提前 ~59.9s），并新发现边界：空串/纯空白 `Retry-After` 经 `Number('')===0` 落入 0ms 立即重试（而非 1000ms 缺省）。
- **修复范围收敛**（R2 准入条件 B；R1 同意清单且对上限纳入无异议，规定「超限失败、不得截短等待后提前重试」）：①delay-seconds 非负照旧；②HTTP-date 取 `max(0, date − 本地时钟)`，过去=0；③无效/空/空白→1000ms 缺省（顺带修 0ms 边界）；④指令等待 >10s（对齐 `MEM_TIMEOUT_MS`）→不睡眠不重试、立即 `MemRateLimitError` fail-fast（选 fail-fast 而非 clamp 重试：clamp 后重发大概率仍在限流窗口、R3）。测试义务：固定时钟 + fake timers——date 未来（到期前无第二次请求、到期恰第二次）/过去→立即/无效空→1000ms/>10s→attempts=1 且终态 `MemRateLimitError`；既有数值用例保留。
- **instance_outputs 前提三核对点（R1 代码侧复核）**：①发出 body 无解码/内部消费——确认；②`fetchTransport` 唯一生产 transport、body 无条件到达出口——确认（限当前实现）；③错误消息不含 key——**不能无条件确认**：代码未主动拼入 key，但 excerpt 与 transport 错误消息均未脱敏，上游若回显 key 标记会保留（离线探针证实）；记为「未主动泄露鉴权配置」，无真实泄露证据、不新增阻塞项→转 T3 注意事项（回执不得原样透传 excerpt）。
- **O1 收敛**：非阻塞风险登记接受（R2 意见 a；R1 同意不再要求 T2 改码）；登记措辞约束（R1）：不得宣称本地无风险或重复落库已实测；未来义务（R2 补充）：若改重放政策，受影响路径须带「首次提交后失败」的有状态测试。
- **准入终态**：R1 维持拒绝（至 F1 修复+定点复核）；R2 有条件接受，条件由 1 增至 2：**A**（缺口 4 声明经用户批准落地+全量审计 0 findings）+ **B**（F1 按②范围修复+四命令+reviewer 定点复核；§2f 一句话澄清随 T2 闭环经主文档同批登记）。非阻塞终态：原 R2-①被 B 吸收撤销；502 间隔断言、守护 key 顺序敏感维持非阻塞。

## 7. 遗留问题 / 超范围记录

| # | 项 | 状态 | 去向 |
| --- | --- | --- | --- |
| X1 | R1-F1（Retry-After 双形式+边界+fail-fast 上限） | 待纠正轮（准入条件 B，范围已收敛见 §6.7） | 用户→orchestrator 登记轮次 |
| X2 | 缺口 4 门禁声明（instance_outputs）待批准 | 升级包就绪（§8.2，R2 建议采纳+四条配套义务）；门禁文件冻结 | 用户→orchestrator（策略变更流程） |
| X3 | O1 重试重复写风险登记 | 措辞已约束（§6.7） | 主文档登记一句已接受风险 |
| X4 | 错误 excerpt/transport 消息未脱敏（上游回显即保留） | R1 定性非阻塞；设计注意 | T3（回执不原样透传 excerpt） |
| X5 | `/health` 本机不鉴权，探活测不出 key 失效 | O2 | T4（鉴权验证对数据端点） |
| X6 | OpenAPI 允许 `memory`/`id` 缺失→客户端响亮失败 | O3，符合 §2f，双方接受 | 无需动作（记录） |
| X7 | 真实写入/upsert、工具层回执语义、deep 端到端未验 | 归 T4/T3 边界 | T3/T4 |

## 8. 第 0 轮交接材料（组级未验收，待 orchestrator 登记纠正轮）

**状态**：初始实现（P1→P1F→P2→P2F）与联合准入（R1/R2+交叉核对）全部完成；双方收敛「**需修改后接受**」；阻塞 R1-F1 未修，本组未标记组级验收。工作树已按逻辑分次提交（§8.3）。

### 8.1 纠正包提案（供 orchestrator 登记轮次与范围）

| # | 事项 | 修复面（双方收敛） | 规模 |
| --- | --- | --- | --- |
| C1 | R1-F1：`retryAfterDelayMs` 双形式解析+边界+上限 | `src/mem/client.ts` 单函数+`tests/mem-client.test.ts` 新增边界用例（范围/测试义务见 §6.7 收敛清单）；四命令+reviewer 定点复核（R1 撤回条件）；§2f 一句话澄清随主文档同批登记（R2 文档义务） | 小 |

不在包内（已收敛排除）：O1 矩阵修订（维持 v1 均匀矩阵+登记风险）；502 间隔断言/守护顺序敏感（非阻塞维持）。

### 8.2 缺口 4 升级包（策略变更，经用户带回 orchestrator）

- **提案**：`.codeharness/code-harness.json` 增 `checkers.type.broad.encoding.instance_outputs: [{"path":"src/mem/client.ts","class_name":"MemClient","member":"send","arguments":[2]}]`。
- **有效性**：planner 探针（`/tmp/t2-gate-probe`）与 architecture 独立探针（真源+精确声明，`/tmp/t2-arch-probe`）双证 0 findings；三组负对照证明最小性（第 0/1 参、内部消费者、`as` 断言均仍报）。
- **architecture 第一评审意见**：建议采纳（§6.6/§6.7）；前提「审批即信任注入实现」经代码侧复核成立（§6.7 三点）。
- **配套义务（R2）**：①用户经 orchestrator 批准（冻结文件变更）；②落地后真仓库 `--all` 全量审计 0 findings 作收口证据；③合入时主文档/worklog 登记决定、理由与移除条件（`send` body 语义或 transport 契约出现非出口消费者时复审）；④声明随源快照 fail-closed（`send` 签名/路径变化即惰性失效、finding 回归）。另：architecture.md §4.1 预想的 `outputs`(fetch body 位) 与实际触发形态不符，合入时应把 §4.1 补记更新为最终机制（同一批准包内文档义务）。
- **若用户否决**：无合规代码路线（双方探针互证），需另行设计；R2 准入结论失效重审。

### 8.3 提交记录（第 0 轮终态）

按简报授权分三次逻辑提交（代码/测试修复与守护/docs）：`caf7b2a`（mem 客户端+行为矩阵测试）、`667c2de`（L5+旋钮守护）、`1c71bb0`（worklog 第 0 轮交接）。提交后工作树干净。

### 8.4 与 T3 的契约快照（第 0 轮终态，以此为 seam）

`MemClient` 公开面：
```ts
constructor(options: { baseUrl: string; apiKey?: string; transport?: MemTransport })
async searchMemories(query: string, options?: { limit?: number; mode?: 'fast' | 'deep' }): Promise<MemoryHit[]>
async getMemory(id: string): Promise<MemoryRecord | null>   // 404 → null，唯一非抛错 4xx
async saveMemory(payload: MemorySavePayload): Promise<MemorySaveResult>
async health(): Promise<MemHealth>                            // { status: string }
```
`types.ts` 导出：`MemoryRecord{id,content,title?}`、`MemoryHit{memory:MemoryRecord|null,similarity_score}`、`MemorySearchMode/Options/Request`、`MemoryUnitType`、`MemorySavePayload`（content + id?/title?/labels?/importance?/unit_type?/source?/source_app?/agent_id?，溯源纯透传）、`MemorySaveAction/Result{memory,action}`、`MemHealth`；解析函数 `parseMemoryRecord/parseMemoryHits/parseMemorySaveResult/parseMemHealth`（client 内部用，T3 不依赖）。
`client.ts` 另导出：`MEM_TIMEOUT_MS`、错误子类 `MemError`/`MemHttpError{status,excerpt}`/`MemAuthError`/`MemRateLimitError`/`MemServerError`/`MemProtocolError`/`MemTransportError`（T3 按子类分派回执文案）；transport 缝类型。
**变更需 T2/T3 双方确认并记 worklog**（简报约束）。纠正轮 C1 不改变此公开面（仅内部函数行为）。

**本组状态标记：第 0 轮完成，联合准入收敛「需修改后接受」，组级未验收；待 orchestrator 登记纠正轮（C1）并裁定缺口 4 升级包（X2）与 O1 登记后，由用户继续本组执行。**
