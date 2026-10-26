# T3 组内任务文档 / Worklog：World 工具与提示词策略

- 任务标识：`T3-world-tools`｜主文档：`docs/dev/coopanion-mem-plugin/main.md` **v0.7**（D1–D11；T1/T2 组级验收通过；全局纠正额度 2/2 已用尽）
- 简报：`tasks/T3.md`（含 C2 热改键约束+F4/F5 随带项、X4 excerpt 不透传约束）｜方案：`architecture.md` §1.2–§1.5、§2b/§2c/§2d、§2f、§3.1、§6.1
- 探索证据：`explorations/coopanion-extension.md`（B15/B25/B27、B7、B8/B46、B45）
- seam 基准：`tasks/T2-worklog.md` **§8.4 契约快照（冻结）**；变更需 T2/T3 双方确认并记 worklog
- 全局轮次：第 0 轮（初始实施）；**全局纠正额度已归零**——本组超范围问题只登记不修正，经用户带回 orchestrator
- 本文档：T3 planner 维护；不构成新的需求或架构权威。实施结束后标记「实施已结束、待主文档汇入」。

## 1. 目标与边界（引用）

- 目标：Coo 能经 `nmem_search`/`nmem_get`/`nmem_save` 三工具读写 Nowledge Mem；world 接线接入真实 `MemClient`（集成段本组独占）；`src/ENV_PROMPT.md` 全文（含 D10 并行写策略）；`describe.json` 同步；`tests/tools.test.ts` + `tests/world.test.ts` 扩展；随带 F4（pushOpts 断言）、F5（describe 固定契约断言）、X4（错误 excerpt 不透传，按子类分派固定文案）。
- 非目标：真机联调与 runbook（T4）；远程验收（D9）；面板（D8）；市场材料（D7）；删除/取代工具、thread 写入、outputTap（§2c/§6.1 已定不做）；改 T2 的 `src/mem/*` 与 `tests/mem-client.test.ts`（发现问题记录并经用户带回 orchestrator）。
- 冻结：`package.json`、`AGENTS.md`、`.codeharness/code-harness.json`（含已批准 instance_outputs 声明）；`src/mem/*`（T2 seam，§8.4 快照）。
- C2 约束（T1 汇入）：热改键（searchLimit/searchMode）必须现读 `ctx.cfg` 活引用；禁读磁盘 config.json、禁构造期快照配置。baseUrl（x-hot:false）在 `create()` 构造期进 client 属设计允许。

## 2. 初始核查事实（planner，2026-10-26 16:16）

| 项 | 事实 |
| --- | --- |
| 基线 | git main `0a96012`（T2 闭环登记），工作树干净 |
| 四命令复跑 | typecheck 0｜test 51/51｜coverage 0（All 96.62/97.67/94.28；client.ts 94.63/97.1 未覆盖仅 85-92 缺省 fetch 适配器、index.ts 0% —— T1/T2 既定分流 T4）｜harness **9 files, 0 findings, exit 0** |
| 现有 src | `index/definition/config/world.ts` + ENV_PROMPT.md（占位）+ `mem/{client,types}.ts`；无 `src/tools.ts`；world 0 工具、`envPromptVars()` 空表 |
| 现有测试 | `tests/world.test.ts`（7 用例 + FakeHost 行为 1）+ `tests/mem-client.test.ts`（44）+ `helpers/fake-host.ts`（记录 `pushOpts`，F4 可用） |
| 契约核对 | `MemClient` 公开面与 §8.4 快照逐字一致（四方法+错误子类+transport 缝）；`describeTools(decls, summaries)`、`ToolDef`/`ToolOutcome{failed?}`、`WorldContext.botName` 均如探索证据 B24/B28/B16 |
| describe 再生成 | npm 包无 `describe:extension` script（T1 缺口 2 结论）；以 `cortico/extensions/describe-export.ts` 的 `exportDescribe('world', NMEM, {packageDir, scratchDir})` 生成 |
| 角色可用 | coder `82d753f3…`、tester `c847b69d…`、reviewer `107c334d…`、architecture `3440ee5c…`（机器 `e943be61`；T1/T2 同批，本会话 planner 亲核 role list） |
| pnpm | 本机无全局 pnpm，一律 `npx -y pnpm@11.28.6`（T1-D1 延续） |

## 3. 组内计划与任务映射

| # | 任务 | 角色/会话 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| P1 | 初始实现：`src/tools.ts`（NMEM_TOOL_DECLS 三工具+校验+回执）+ `src/world.ts` 接线（真实 MemClient 注入缝）+ `src/ENV_PROMPT.md` 全文 + `describe.json` 再生成 + `src/config.ts` 秘密名常量 + `tests/tools.test.ts` + `tests/world.test.ts` 扩展（F4/F5）+ 四命令 | coder | **完成**（§6.1） | 单会话承载；写入范围见 §1 |
| P2 | 独立验证：四命令复跑、用例矩阵对简报/§2f 逐条核对、覆盖缺口检视、C2/X4/F4/F5 定点核对 | tester | **执行中**（16:3x 派发） | 只读+运行；不改产品代码 |
| P3 | 联合准入：reviewer + architecture 同一代码状态审查 | reviewer、architecture | 待 P2 | 两方独立结论 |
| P4 | 组级验收 + worklog 交付 + 按逻辑分次提交 | planner | — | 停止边界 |
| P5 | 闭环：F1 修复（T3-F1FIX）+ R1 定点复核撤阻 + R2 终态 delta 确认 + 提交 + S2 真机 smoke + worklog 终稿 | coder→reviewer/architecture→planner | `T3-F1FIX-CODER`（完成）→`T3-P3-CLOSE` | F1FIX **完成**（§6.6）；R1 **接受，F1 撤阻**（17:03，原探针复跑 11→10+尾注；证据 `/tmp/t3-r1-review/fix-verify/`）；R2 **终态维持无保留接受**（17:03，增量恰二文件、C2/D7/X4 保持；证据 `/tmp/t3-r2-arch/fix-delta/`） | 用户授权（T3-D12/D13）；提交后停止 |

### 6.7 联合准入闭环与组级验收（17:03）

- **R1（reviewer）**：接受，F1 撤阻——亲跑原离线 transport 探针（11 条响应→恰 10 行+「另有 1 条未列出」）；新五用例有效；四命令亲跑绿（101/101、四文件 100%、门禁 0 findings）。原未验证边界（真机/远程/装配层冲突）维持保留。
- **R2（architecture）**：终态维持无保留接受——增量恰 `src/tools.ts`（+9 行三处）+`tests/tools.test.ts`（+5 用例），其余六文件 diff 统计与审阅态逐项一致、冻结面零 diff；F1 修复成立（回执条数双重有界、越界 clamp 断言到请求侧）；C2/D7/X4/溯源/DECLS 未动，describe 面无需再生成；四命令终态亲跑绿。非阻塞登记：searchLimit<1 绕过 schema 途径的边角（尾注仍如实披露，与 F1 无关）。
- **组级验收：通过**（组内口径）：联合准入双方接受（R1 无阻塞、R2 无保留），必要验证四命令经 coder/planner/R1/R2 多方独立复跑全绿；阻塞（F1）已修复并定点复核撤阻。第 0 轮内补齐（P2F/F1FIX）均经用户授权登记（T3-D12），未动全局纠正额度。
- **会话总数（第 0 轮）**：7 会话（coder×3 / tester / reviewer×1+复核 / architecture×1+复核）+ planner 亲核；无在途回合外会话。

### 6.6 F1FIX 结果摘要（coder 回执 + planner 亲核）

- **实现**：searchHandler 现读 cfg 后 `const limit = Math.min(input.value.limit ?? cfg.searchLimit, LIMIT_MAX)`，同一值用于请求 options 与回执截断（C2 语义不变）；`formatSearch(hits, limit)` 单循环三分支（null→skipped 全量计数、前 limit 条可用→列出、超出→omitted）；尾注序「另有 N 条结果未列出」→「另有 N 条结果因数据缺失被略过」可并存；首行 N=实际列出条数。**coder 增补（planner 接受）**：配置越界防御 clamp（cfg.searchLimit 经手改起出 schema 范围时钳到 10——请求侧不再发出进反工具契约的 limit，与简报「上限 10 条」一致）。
- **测试**：新增「nmem_search 回执条数上限」describe 五用例（11×缺省 5 / 11×limit10 / 5可用+12null+6可用混合 / 5×limit3 / cfg.searchLimit=23 clamp）；既有断言零改动。
- **四命令（planner 独立复跑一致）**：typecheck 0｜test **101/101**（tools 48 + world 9 + mem-client 44）｜coverage 四文件 100% 维持（All 98.53/99.29/96.82）｜harness **11 files, 0 findings**（UV_CACHE_DIR 临时缓存，R1 先例）。
- **自验变异（/tmp 副本已删）**：去上限→5 例全红；去 clamp→用例 5 红；复原→48/48 绿。证据 `/tmp/t3-f1fix-evidence/`。

会话映射（operation → session）：见 §6 登记表。

## 4. 对执行角色的关键输入（planner 定稿的实现口径）

### 4.1 分层与接缝

- `tools.ts` 拥有：`NMEM_TOOL_DECLS`（`ReadonlyArray<Omit<ToolDef,'handler'>>`，describe 与 `tools()` 同源 B15）、参数校验（ingress 一次性收窄，`Validated<T> = {ok:true;value:T}|{ok:false;outcome:ToolOutcome}` 判别联合）、回执格式化、X4 错误分派、窄接口 `NmemToolClient`（工具层消费面：`searchMemories/getMemory/saveMemory` 三方法签名取自 §8.4 快照，复用 `src/mem/types.ts` 契约类型——这是 §1.2 的「客户端/工具两层具体测试缝」，测试注入手写 fake，不用 mock 库）。
- `world.ts`：`NmemWorldOptions` 增 `botName`、`client: NmemToolClient`；`tools()` 返回 `nmemTools({client, cfg, botName})`；handler 内热改键现读 `cfg`（C2）；`envPromptVars()` 维持空表（§2b）；start 事件文案更新为「…nmem_search/nmem_get/nmem_save 可用」（保留「挂载」措辞供既有 grep）。
- `definition.ts`：`create(ctx)` 构造 `new MemClient({baseUrl: ctx.cfg.baseUrl, apiKey: ctx.secret(NMEM_API_KEY)})` 注入（集成段）；`describe.tools = describeTools(NMEM_TOOL_DECLS, {zh,en 摘要})`。
- `config.ts`：仅新增 `export const NMEM_API_KEY = 'NMEM_API_KEY';`（§1.2 秘密名常量归配置层）。
- 工具层禁 `node:http`/`undici`/`axios` import（门禁边界「仅 client 拥有网络传输」）；tools/world/definition 可 import `cortico/*`（mem 层禁令不变）。

### 4.2 参数与校验（JSON Schema 声明 + handler 双层）

| 工具 | Schema 要点 | handler 校验失败文案（全部 `failed:true`，不抛异常） |
| --- | --- | --- |
| `nmem_search`(read) | `query` string 1..500 必填；`limit` integer 1..10；`mode` enum fast\|deep | 空白/非串→「检索词不能为空:请提供 1–500 字符的检索词。」；>500→「检索词过长(N 字符,上限 500),请提炼后重试。」；limit 非法→「limit 必须是 1–10 的整数。」；mode 非法→「mode 必须是 fast 或 deep。」 |
| `nmem_get`(read) | `id` string 必填 | 空/非串→「id 不能为空:请传入要读取的记忆 id。」 |
| `nmem_save`(write) | `content` string 1..30000 必填；`id` ≤200；`title`/`unit_type` enum 八值/`labels` string[]/`importance` 0..1 | content 空白→「content 不能为空:请提供 1–30000 字符的记忆内容。」；>30000→「内容过长(N 字符,上限 30000),请提炼后重试。」（不截断、不调 client）；id 空→「id 不能为空(新建请直接省略该参数)。」/超长→「id 过长(N 字符,上限 200)。」；title 非串→「title 必须是字符串。」；unit_type→「unit_type 必须是 fact/preference/decision/plan/procedure/learning/context/event 之一。」；labels→「labels 必须是字符串数组。」；importance→「importance 必须是 0–1 的数值。」 |

- 可选字段构造：无条件赋值（含 undefined 值）而非逐字段条件拷贝/条件展开（规避 `structure.guarded_projection`；`JSON.stringify` 出口自动丢弃 undefined 键）。
- 溯源（§1.4）：payload 恒带 `source:'coopanion'`、`source_app:'cortico-world-nmem'`、`agent_id:botName`；labels 恒并入 `coopanion`（已含则不重复）。

### 4.3 回执格式（成功有界：摘要 ~200 字符/条、条数≤10）

- search 命中：首行「找到 N 条相关记忆:」+ 逐条 `i. [score.toFixed(2)] 标题或「无标题」 — 摘要(id: xxx)`（摘要 >200 截断加「…」）；`memory:null` 命中跳过并计数，尾注「（另有 N 条结果因数据缺失被略过）」；有结果时尾行「需要全文时,用 nmem_get 按 id 读取。」；零结果→「没有找到相关记忆。」
- get 命中：`记忆 <id>[「<title>」]:\n<content 全文>`；404（client 返回 null）→「未找到 id 为 <id> 的记忆。」（**普通回执非 failed**——T3-D2，见 §5）；get 的价值即取全文，不截断。
- save：`已新建记忆 <id>。`（action=created）/ `已更新既有记忆 <id>。`（action=updated）。
- **X4 错误分派（固定文案，绝不包含 error.message/excerpt）**：`MemTransportError`→「Nowledge Mem 不可达:请确认 Mem 正在运行,且 baseUrl 配置正确。」；`MemAuthError`→「Nowledge Mem 认证失败:API key 无效或已轮转,请检查 NMEM_API_KEY 配置。」；`MemRateLimitError`→「Nowledge Mem 限流,请稍后再试。」；`MemServerError`→「Nowledge Mem 服务端错误,请稍后再试。」；`MemProtocolError`→「Nowledge Mem 响应异常,可能版本不兼容。」；其余 `MemHttpError`→「Nowledge Mem 请求失败(状态码 <status>):请稍后再试或检查参数。」（仅状态码数字）；非 MemError→「Nowledge Mem 工具执行失败:发生未预期的错误。」。instanceof 判序：子类在前、`MemHttpError` 兜底在后。

### 4.4 ENV_PROMPT.md（英文，模型文本；全文替换占位）

覆盖五点：①何时 search（涉及用户事实/偏好/历史先搜；开场可探一次）+ get 取全文；②何时 save（值得长期保留的事实/偏好/决定；精炼自包含 ≤30000；更新先 search 拿 id 再 save，save 即 upsert）；③D10 并行写（照常维护 PARTNER.md，**另存** Mem；Mem 不替代 PARTNER.md）；④工具失败简短告知用户并继续，不重试轰炸；⑤单条记忆保持精炼。

### 4.5 测试义务

- `tests/tools.test.ts`（fake client 手写类 implements `NmemToolClient`，可抛真实 MemError 子类）：search（cfg 缺省透传/显式覆盖/热改引用直改生效/编号+score+标题+摘要+id 格式/摘要 200 截断/null 命中跳过计数/零结果/query 空/超 500/limit 与 mode 非法/七类错误固定文案且**不含 excerpt 标记串**——X4）；get（命中含标题与不含标题/404 非 failed/空 id/错误文案）；save（created 与 updated 回执/溯源三字段+默认 label/labels 并入与去重/可选字段透传且 undefined 键不出现/content 30001 拒绝且未调 client/id 201/unit_type/labels/importance/title 非法）。
- `tests/world.test.ts`：更新「当前不提供工具」用例为三工具（名序 `nmem_search/nmem_get/nmem_save`，tags read/read/write〔按 architecture §1.4；初稿误写 read/write/read，T3-D6 修正〕）；start 事件补 `pushOpts` 断言（**F4**：`toEqual([undefined])`）；describe 一致性保留并加**字面固定契约断言（F5）**：`envDocs` key 恰为 `['worlds.nmem.envPrompt']`、describe.json 工具名序恰为三工具——两处同错可检出；新增 cfg 热改用例（`ctx.persist({searchLimit/searchMode})` 后 fake client 收到新值，模板 B45 同法）；新增注入 fake client 的接线用例（handler 回执来自 fake）。
- `ToolCallContext` 用具体对象 `{role, log: 手写 noop Logger}` 构造，禁 `as` 断言（fake-host 同口径）。

## 5. 决定记录

| # | 决定 | 依据 |
| --- | --- | --- |
| T3-D1 | 测试缝取「手写 fake client 注入」（`NmemToolClient` 窄接口），不用真实 MemClient+fake transport：与 §1.2/§3.1「测试注入 fake client」原文一致；错误子类用真实异常实例直接抛，X4 断言更直接 | architecture §1.2/§3.1；工程标准「narrow interfaces / concrete seams」 |
| T3-D2 | `nmem_get` 404 → 普通回执「未找到」而非 `failed:true`：查询语义上的确定答案，非工具执行失败；§1.4 只要求「明确未找到」，§2f 失败矩阵针对 client 抛错路径（get 404 是唯一不抛错的 4xx 分支） | §8.4 快照「404 → null，唯一非抛错 4xx」；§1.4 |
| T3-D3 | `nmem_save` 校验失败一律 `failed:true` 回执且不调 client（超长不截断）；其余 4xx 通用文案含状态码数字但不含 excerpt | 简报 X4/§2c；§2f |
| T3-D4 | start 事件文案更新提及三工具可用（仿模板「…example_echo 可用」） | B45 |
| T3-D5 | 集成后真机 smoke（sideload 下 Coo 调通三工具）涉及重启用户运行中的 Coopanion Core：T1-D4 授权范围限 T1 当轮；本轮不自动执行，作为待确认项交用户裁定（见 §7 S2） | 流程规约「不得自行改变交付环境」 |
| T3-D6 | 三工具 tags 按 architecture §1.4 定为 read/read/write——planner §4.5 初稿「read/write/read」为笔误（get↔save 错位），coder 指出冲突后按方案文本裁定 | architecture §1.4 表 |
| T3-D7 | search 回执首行「找到 N 条」的 N=实际列出条数（null 命中不计数，另以尾注计数）；全部命中为 null 时回「没有找到相关记忆。」+尾注；摘要将连续空白折叠为单行再截断 200（上下文预算保护） | §4.3 未明示处补全 |
| T3-D8 | handler 入参类型以 `NmemToolArgs = Parameters<ToolDef['handler']>[0]` 引用框架契约，不写显式 `Record<string, unknown>` 注解（后者触发门禁 `type.broad`）；语义不变，收窄仍在校验函数一次性完成 | T2 同类实测（显式 unknown/object 注解触发 type.broad）；门禁不改 |
| T3-D9 | save payload 省略字段以 undefined 值出现（键恒在、键序固定），由 client `JSON.stringify` 出口自动丢弃；测试以键序+undefined 断言，不做序列化往返（避免再造 type.broad） | §4.2 无条件赋值口径 |
| T3-D10 | query/content 原样透传（仅 trim 判空）；id 两侧空白去除后使用 | 简报未规定处的补全 |
| T3-D11 | P2 变异存活 M7（envPromptVars 禁 I/O 无守护）与 O2（search 回执标题不截断）对应简报失败示例清单两项，连同 O5 边界值用例，按**第 0 轮完成度补齐**（T3-P2F）处理——非纠正轮、不动全局额度；O3/O4/O6 仅登记不修 | 简报「成功与失败示例」；工程标准边界用例义务；T2-P2F 先例 |
| T3-D12 | **F1 处置（用户 2026-10-26 授权）**：R1 阻塞 F1 按第 0 轮完成度补齐立即修（与 T3-D11 同类：F1 对应简报失败示例「回执无界…上限 10 条」明文项），修后 R1 原会话定点复核撤阻、R2 终态 delta 确认，然后统一提交；不动全局纠正额度登记 | 用户裁定；R2「失败示例清单即第 0 轮范围定义」意见 |
| T3-D13 | **S2 真机 smoke（用户 2026-10-26 授权）**：本轮执行——重启 Coopanion Core 使 link 安装的 T3 代码生效，Coo 实调三工具，取事件流/运行日志/Mem 侧证据；场景化验收 A–D 仍归 T4 | 用户裁定；T3-D5 解除 |

## 6. 会话登记与验收记录

| 任务 | 角色 | operation | session | 状态 |
| --- | --- | --- | --- | --- |
| T3-P1 初始实现 | coder | `T3-P1-CODER-IMPL` | `a355db07-9122-4cc3-8464-e124eaa5563a` | **完成**（16:28 回执；证据 `/tmp/t3-p1-evidence/`；见 §6.1；planner 亲核） |
| T3-P2 独立验证 | tester | `T3-P2-TESTER-VERIFY` | `c60f25aa-bf84-4a66-962f-9b727dbccca8` | **完成**（16:34 回执；无阻塞级缺陷；见 §6.2；证据 `/tmp/t3-p2-evidence/`） |
| T3-P2F 完成度补齐（M7/O1 守护 + O2 标题限界 + 边界值用例） | coder | `T3-P2F-CODER-GUARD` | `45bef18d-d2ac-4ec6-aeb6-b9d14583e149` | **完成**（16:38 回执；见 §6.3；证据 `/tmp/t3-p2f-evidence/`；planner 亲核） |
| T3-R1 联合准入（实现审查） | reviewer | `T3-P3-R1-ADMIT` | `5e49f79c-e36f-48c7-b158-c065346eadb6` | **完成**（16:51 回执：**拒绝需修改**，唯一阻塞 F1；见 §6.5；证据 `/tmp/t3-r1-review/`） |
| T3-R2 联合准入（架构审查） | architecture | `T3-P3-JOINT-ADMIT`#2 | `9ba6ae3b-f057-406f-a9d6-5faff78710b7` | **完成**（16:45 回执：**无保留接受**；见 §6.4；证据 `/tmp/t3-r2-arch/`） |

### 6.1 P1 结果摘要（coder 回执 + planner 亲核）

- **交付**：新增 `src/tools.ts`（450 行）、`tests/tools.test.ts`（38 用例）；改 `src/world.ts`（botName/client 注入 + tools() 接线 + start 文案）、`src/definition.ts`（真实 MemClient 构造注入 + describeTools 三工具 zh/en 摘要）、`src/config.ts`（`NMEM_API_KEY` 常量）、`src/ENV_PROMPT.md`（英文全文，五要点齐）、`describe.json`（exportDescribe 再生成，checkDescribe ok/无 failures）、`tests/world.test.ts`（8 用例）。写入面与指派一致，冻结文件零触碰（git status 亲核）。
- **四命令（planner 独立复跑一致）**：typecheck 0｜test **90/90**（mem-client 44 只读 + tools 38 + world 8）｜coverage All 98.51/99.27/96.82（tools/world/definition/config 均 100%；既定缺口不变：client.ts 85-92、index.ts 0%）｜harness **11 files, 0 findings, exit 0**。
- **实现核查（planner 通读 tools.ts/tools.test.ts/world.test.ts）**：X4 分派序 transport→auth→rate→server→protocol→HttpError(仅状态码)→兜底，回执不含 error.message/excerpt（七类错误×marker 断言）；C2 热改键每次调用现读 cfg（无快照/无磁盘读）；`Validated<T>` 判别联合收窄、无 any/断言/压制；可选字段无条件赋值；溯源三字段+默认 label 恒写入且不重复；F4 `pushOpts === [undefined]`；F5 字面断言 key 与工具名序；fake client 手写类 implements `NmemToolClient`，ToolCallContext 具体对象构造。
- **偏离裁定（§5 T3-D6–D10）**：全部接受——tags 笔误修正（D6）、回执计数口径补全（D7）、NmemToolArgs 别名（D8）、undefined 键断言（D9）、空白处理（D10）。
- **门禁缺陷登记（S4）**：coder 在合成最小工程复现 `../codeharness` 崩溃（对导入 const 直接取成员调用时 `aliases._binding` 取到另一文件绑定，`SemanticIndex.text` 按当前文件字节切片 → 多字节字符中间 → `UnicodeDecodeError`，exit 2；ASCII 对照组 0 findings）。本仓库现状 11 files 0 findings 未受影响（测试形态已绕开，断言等价）；按 D5 不改 codeharness，只登记转交。

### 6.2 P2 结果摘要（tester 回执）

- **结论：无阻塞级缺陷**。四命令独立复跑全绿（typecheck 0 / 90/90 / 四文件 100% 覆盖声明成立、缺口仅既定分流 / harness 11 files 0 findings）；`checkDescribe` 3 ok 0 failures；`dryMountWorld` 5 ok；工作树未动。
- **用例矩阵**：§1.4 逐项、§2f 七类错误、简报五项失败示例中 4/5 有变红守护；溯源/undefined 键经真实 client 边界探针实证（wire body 无 undefined 键、七类错误回执均不含 marker）。
- **变异实证（/tmp 副本 17 组，16 变红）**：唯一存活 **M7——envPromptVars 发起 Mem I/O 无任何测试能变红**（O1）；另发现 **O2——search 回执只截摘要不截标题**（4000 字符标题→4066 字符回执，与简报「回执无界须截断 ~200 字符/条」失败示例冲突）。
- **观察项（登记不修）**：O3 id 长度按 trim 前长度校验；O4 七类错误矩阵仅 search 全铺（get/save 各 1 例代表，共享 attemptOutcome）；O6 内置 World/Persona 工具名冲突属装配层，离线不可验（留 T4 真机，同 T1 口径）。〔勘误（R1-F1 后补记）：本节「回执无界双重守护」推论不成立——limit≤10 是请求侧约束，非工具层输出约束；条数侧守护缺失由 R1 实证（§6.5 F1），P2F 仅闭环摘要/标题两侧。〕
- **planner 裁定（T3-D11）**：M7/O1 与 O2 对应简报「失败示例应被发现并修复」清单两项，属**第 0 轮完成度补齐**（非纠正轮、不动全局额度，循 T2-P2F 先例）；O5 边界值（limit 1/10、content 30000、id 200、importance 0/1）仅 tester 探针验过，按工程标准边界用例义务一并补入；O3/O4/O6 仅登记。补齐包 = T3-P2F。

### 6.3 P2F 结果摘要（coder 回执 + planner 亲核）

- **改动**（恰三处）：`src/tools.ts` 常量 `TITLE_MAX=80` + `titleOf()` 超限截断（`formatGet` 全文与摘要 200 逻辑未动）；`tests/world.test.ts` `RecordingClient` 补 get/save 调用记录 + 「envPromptVars 返回空表且不发起任何 Mem I/O」守护用例（M7/O1）；`tests/tools.test.ts` 标题 4000→截断用例（O2）+「边界值接受」describe 四用例（O5）。唯一结构调整：两条「缺数据」既有用例移入同级 `describe('nmem_search 数据缺失')`——新用例加入后原回调 59 行触发 `size.lines` 50，拆分归零，断言文本一字未改。
- **四命令（planner 独立复跑一致）**：typecheck 0｜test **96/96**（mem-client 44 + tools 43 + world 9）｜coverage 四文件 100% 维持（All 98.52/99.28/96.82）｜harness **11 files, 0 findings**。
- **自验变异（/tmp 全量副本，已删）**：M7 复原（envPromptVars 发起一次 search）→ 守护用例红；O2 复原（去 80 截断）→ 标题用例红。
- **工作树核对（planner）**：文件集与 P1 交付一致 + 上述三文件增量；冻结面零触碰。P2 存活变异与超界观察项全部闭环（M7/O1/O2/O5）；O3/O4/O6 维持登记。

### 6.4 T3-R2 结论（architecture，无保留接受，16:45）

- **七项义务全过**（均为亲读冻结代码+亲跑探针）：分层无倒置、`NmemToolClient` 窄接口成立（三方法与 §8.4 逐字一致，具体类名只出现在组合根，优于直接依赖类）；策略符合（§2c/§2d/§2f/X4/§1.4，溯源字段工具层硬编码模型不可覆写）；门禁四边界双验证、owner 表无需变更、instance_outputs 声明仍精确匹配；seam 冻结 diff 空；describe 再生成===磁盘、checkDescribe 3 ok；四命令亲跑全绿（96/96、11 files 0 findings）。
- **待议四项**：① S4 建议「登记接受+短期约束（带移除条件）+转 orchestrator 裁定另立 codeharness 修复」（崩溃属 fail-closed，无假绿风险；修复宜以 05 最小复现为回归夹具）；② P2F 归类认可（失败示例清单本身是第 0 轮范围定义）；③ T3-D1–D10 全部同意（D8 补证：`NmemToolArgs` 引用的正是框架契约 types.ts:279，仓库自身无宽化）；④ get 404 非 failed 与 §2f 无冲突（矩阵只覆盖抛错路径；§8.4 的 404→null 是唯一非抛错 4xx）。
- **非阻塞建议**：architecture.md §1.4 溯源「服务端自动补」措辞与实现（工具层写入、client 透传）有出入，实现是更强契约，建议 orchestrator 汇入时按实现口径修正文字；O3/O4/O6 维持登记、get 全文不截断属设计（服务端 32768 天然有界）。

### 6.5 T3-R1 结论（reviewer，拒绝需修改，16:51）

- **唯一阻塞 F1（中等）**：search 回执条数上限未在工具层落实——`formatSearch` 遍历全部 hits，请求侧 `limit≤10` 不能约束输出；真实 `MemClient`+离线 transport 亲证：请求体 `limit:10`、伪造 11 条响应 → 回执列出全部 11 条（planner 已复现证据并核对探针脚本；违反简报失败示例「回执无界（须截断 ~200 字符/条、**上限 10 条**）」与 §2f「条数上限即 limit 上限 10」）。真实本机 Mem 未观察到超量返回（R1 亦未如此声称）；属防御性上界缺失，触发需服务端违反自身契约。
- **最小修正面（R1 给出，planner 认可）**：仅 `src/tools.ts` 搜索回执处理 + `tests/tools.test.ts`；每次调用的有效 limit 应用于输出且硬上限 10；null 跳过计数与截取关系明确；补「响应超 limit、超 10、混入 null」回归用例。不改 `src/mem/*`。
- **P2 矩阵勘误**：P2 §6.2「回执无界双重守护」推论不成立——limit≤10 是请求约束非输出约束；P2F 只闭环了摘要/标题两侧，条数侧守护缺失由 R1 实证。planner 已在 §6.2 勘误登记。
- **其余全部接受**：契约/幂等/溯源/回执、X4（含无日志泄漏路径）、C2、类型纪律（D8 不是别名掩藏擦除）、所有权、测试质量（断言针对性/F4/F5 有效）、覆盖证据（四文件 100%、无 changed-file 缺口）、冻结面 diff 空、ENV_PROMPT/describe 同步、D1–D10 无异议；D11/P2F 作为第 0 轮被审对象接受、不重新分配预算。四命令亲跑绿（96/96；门禁首次遇 uv 缓存权限与沙箱 DNS 环境问题，原始日志保留，改临时缓存重跑通过，未改依赖/门禁制造通过）。
- **联合准入终态**：R1 拒绝（至 F1 修复+定点复核撤阻）；R2 无保留接受。**组级未验收**；处置授权待用户（见 §8.1）。

## 7. 遗留问题 / 超范围记录

| # | 项 | 状态 | 去向 |
| --- | --- | --- | --- |
| S1 | （预留：src/mem/* 发现的问题——只登记不修正） | — | — |
| S2 | 集成后真机 smoke（重启 Core + Coo 实调三工具） | 待用户裁定是否本轮执行（T3-D5）；场景化验收归 T4 | 用户 |
| S3 | index.ts 入口覆盖 0%、README/files 核对（F2）、X5 鉴权验证、GUI 目视 | T1/T2 既定分流 | T4 |
| S4 | **`../codeharness` 门禁缺陷（P1 发现，非本仓库代码）**：测试对导入 const 直接取成员调用时，`aliases._binding` 跨文件误绑 + `SemanticIndex.text` 按当前文件字节按对方偏移切片 → 切在多字节字符中间即 `UnicodeDecodeError`（exit 2）。合成工程稳定复现，CJK 内容必现、ASCII 不现（证据 `/tmp/t3-p1-evidence/05-gate-crash-minimal.txt`/`05b`）；本仓库现状 0 findings 未受影响。短期约束（T4 起生效）：测试勿对导入 const 直接取成员调用。按 D5「不改 codeharness 本身」不修，转用户/orchestrator 裁定是否另立修复 | 登记 | 用户/orchestrator |

## 8. 交接材料（第 0 轮终态：联合准入已收齐，R1 阻塞 F1 待授权处置）

**组级状态：未验收**——R1（reviewer）拒绝需修改（唯一阻塞 F1）；R2（architecture）无保留接受。代码改动全部在工作树未提交，待 F1 处置后统一提交。

### 8.1 F1 纠正包提案（供用户/orchestrator 裁定；全局纠正额度已归零，本组不自行派发）

| # | 事项 | 修复面（R1 给出、planner 认可） | 规模 |
| --- | --- | --- | --- |
| F1 | search 回执条数上限未落实（服务端超量返回时回执无界） | 仅 `src/tools.ts`（formatSearch 应用有效 limit 且硬上限 10；null 跳过计数与截取关系明确）+ `tests/tools.test.ts`（超 limit/超 10/混 null 回归用例，断言实际输出条数与首行计数）；后接 R1 原会话定点复核撤阻（T2 闭环先例） | 小 |

- **处置选项**：①授权按第 0 轮完成度补齐立即修（planner 建议：与 T3-D11 同类——F1 对应简报失败示例清单「回执无界…上限 10 条」明文项，R2 亦认定该清单为第 0 轮范围定义；修后 R1 撤阻即闭环）；②正式登记为纠正轮（需用户明确增加授权，orchestrator 登记）；③只登记不修（进已知限制/T4——不推荐：属简报明文要求且修面小）。
- **同步待裁**：S2 真机 smoke（T3-D5，重启运行中 Coopanion Core + Coo 实调三工具）是否本轮执行。

### 8.2 第 0 轮交付清单（当前工作树，相对 `0a96012`）

新增 `src/tools.ts`（三工具声明/校验/回执/X4 分派）、`tests/tools.test.ts`（43 用例）；改 `src/world.ts`（接线）、`src/definition.ts`（真实 MemClient 注入+describeTools）、`src/config.ts`（`NMEM_API_KEY`）、`src/ENV_PROMPT.md`（英文全文五要点）、`describe.json`（再生成）、`tests/world.test.ts`（9 用例）；本文档。冻结面零触碰。

### 8.3 四命令与证据索引（R1/R2 双方亲跑+planner 三方一致）

typecheck 0｜test 96/96（mem-client 44 + tools 43 + world 9）｜coverage All 98.52/99.28/96.82（config/definition/tools/world 四文件 100%；既定缺口 client.ts 85-92、index.ts 0%）｜harness 11 files 0 findings。证据：`/tmp/t3-p1-evidence/`、`/tmp/t3-p2-evidence/`、`/tmp/t3-p2f-evidence/`、`/tmp/t3-r1-review/`、`/tmp/t3-r2-arch/`。

### 8.4 给 T4 的交接口径

完整可安装插件（含 ENV_PROMPT 与三工具）待 F1 处置后提交；真机场景 A–D/E、index.ts 入口覆盖、F2（README/files）、X5（鉴权走数据端点）、O6（装配层工具名冲突）、S4 短期约束（测试勿对导入 const 直接取成员调用）均归 T4。
