# T4 组内任务文档 / Worklog：契约测试与真机验收支撑

- 任务标识：`T4-acceptance`｜主文档：`docs/dev/coopanion-mem-plugin/main.md` **v0.9**（D1–D12；T1–T3 全部闭环；全局纠正额度 2/2 已用尽——本组失败项只登记不修复）
- 简报：`tasks/T4.md`（含分流项 X5/S6①/DELETE 解除限制/index.ts 覆盖/F2/GUI 目视可选/S4 短期约束）｜方案：`architecture.md` §3.2/§3.3/§7（缺口 6/7/9）
- 前序交付：T3 §8.4/§10（含 D12 轮真机复验口径与证据索引 `/tmp/t3-d12-evidence/`、`/tmp/t3-smoke-evidence/`）
- 本文档：T4 planner 维护；不构成新的需求或架构权威。实施结束后标记「实施已结束、待主文档汇入」。

## 1. 目标与边界（引用）

- 目标：① `tests/contract.nmem.test.ts`（opt-in 门控，对真实本机 Mem）；② `README.md`（安装三步/四旋钮/NMEM_API_KEY .env/agent_id 约束/远程「未实测」/安全说明含 R1 绑定提示/验收 runbook）；③ 真机验收场景 A–D 执行留证（E 远程不执行，D9）；④ 关闭缺口 6（DELETE 已实证，加可选清理）与缺口 9（.env 确切路径入 README）；⑤ 随附：index.ts 入口覆盖、F2（README 后核实 npm pack 清单）、GUI 目视（可选，用户参与）。
- 非目标：新功能或修复（失败项登记不修，额度已尽）；远程验收（D9）；市场材料（D7）；面板（D8）。
- 冻结：`package.json`、`AGENTS.md`、`.codeharness/code-harness.json`、`src/*`、`describe.json`、`vitest.config.ts`（本组无 src 改动需求）。
- 纪律：写入真实 Mem 仅限固定探针 id 与场景 B 证据（labels 标注辨识）；不安装/升级软件（`npx -y pnpm@11.28.6` 沿用）；**S4 短期约束：测试勿对导入 const 直接取成员调用**；不自行 commit（T4 简报未授权提交，交付物留工作树待指示）。

## 2. 初始核查事实（planner，2026-10-26 17:5x）

| 项 | 事实 |
| --- | --- |
| 基线 | git main `ce11405`（orchestrator v0.9 汇入），工作树干净；planner 复跑 typecheck 0 / test 105/105 |
| 运行环境 | Mem 0.10.108 运行中（`/health` ok，`nmem-server` PID 77227，`*:14242`）；Coopanion Core 运行中；nmem world **active**，三工具 `nmem_search/nmem_get/nmem_save` 在位；`/api/config` 恰四旋钮（baseUrl/searchLimit/searchMode/agentId，agentId 含 pattern+x-hot） |
| 挂载态 | `extensions/package.json` link 本仓库；`config.json` 落盘 `worlds.nmem.enabled:true`；`.env` **尚不存在**（无远程 key 需求，正常） |
| 缺口 9 佐证 | `vendor/cortico/src/world.ts`：`cfgPath = join(rootDir,'config.json')`、`storeSecret → join(rootDir,'.env')`；live config.json 位于 `~/Library/Application Support/Coopanion/home/companion/config.json` ⇒ rootDir = `home/companion` ⇒ **.env 确切路径 = `~/Library/Application Support/Coopanion/home/companion/.env`**（文件当前不存在，手动创建即被 `ctx.secret()` 读取） |
| 对话驱动 | console world WebUI 流：`WS /ws/providers/world%3Aconsole/panels/chat?language=zh`（Origin `http://127.0.0.1:17789`，免鉴权、口令未设置）；协议 JSON 行 `{type:'hello',name}` → `{type:'msg',text}`，广播 `{type:'msg',from,text,ts}`（ref 源码 worlds/console/world.ts + tests/console-api.test.ts） |
| 证据源 | `home/companion/data/session-main.jsonl`（journal：function_call arguments + function_call_output 即工具调用与回执全文）；`data/runs/r-*/events.jsonl`（事件流）；Mem 端 curl 输出 |
| 配置写入 | `POST /api/config {group:'world:nmem', values:{...}}`（ref core/guide.ts 同型调用）；重启 `POST /api/run/restart` |
| Mem 应用 | `/Applications/Nowledge Mem.app`（场景 C：`osascript quit` → `open -a` 复启） |
| 角色可用 | coder `82d753f3…`、tester `c847b69d…`、reviewer `107c334d…`、architecture `3440ee5c…`（机器 `e943be61`，本会话 planner 亲核 role list） |

## 3. 组内计划与任务映射

| # | 任务 | 角色/会话 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| P1 | 初始实现：`tests/contract.nmem.test.ts` + `README.md` + index.ts 入口覆盖测试 + F2（npm pack 核实）+ 四命令 | coder | **完成**（18:03 回执；session `e51e5974…`；见 §6.1；证据 `/tmp/t4-p1-evidence/`；planner 亲核） | 写入范围仅 `tests/*`、`README.md` |
| P2 | 独立验证：四命令、契约套件 live 复跑、门控 skip/pass 显式区分、README 与 live 状态一致性、S4/X5/S6① 定点、覆盖（index.ts 消 0%） | tester | **完成**（18:09 回执；session `4e578720…`；无阻塞级缺陷；见 §6.2；证据 `/tmp/t4-p2-evidence/`） | 只读+运行；未改产品代码 |
| P3 | 真机验收场景 A–D 执行留证（console 通道驱动 Coo + Mem 端核对 + journal/事件流取证；含 Core 重启与 Mem 退出/复启；结束恢复全部缺省） | planner 执行 | **完成**（18:10–18:21；A/B/C/D 全部通过；见 §6.3；证据 `/tmp/t4-accept-evidence/`） | 环境变更集中在此段，避免与 P2 并发 |
| P4 | 联合准入：reviewer + architecture 对同一交付状态审查（契约测试/README/入口测试/场景记录） | reviewer、architecture | 待 P3 | 两方独立结论 |
| P5 | 组级验收 + worklog 交付（不 commit，待用户指示） | planner | — | 停止边界 |

会话映射（operation → session）：见 §6 登记表。

## 4. 对执行角色的关键输入（planner 定稿口径）

### 4.1 契约测试（P1 coder）

- 门控：`NMEM_CONTRACT_BASE_URL` 未设 → 全部 skip（vitest 显式报告 skipped）；已设但 `/health` 不可达 → **fail 不 skip**（显式区分，对齐简报失败示例）。默认目标 `http://127.0.0.1:14242`（env 值可覆盖）。
- 用例（plain `fetch`，不 import 本仓 src；避免 S4 形态）：
  1. `GET /health` → 200 且 `{"status":"ok"}` 形态（探活，T2-D1 已定稿最小语义）；
  2. **X5 鉴权走数据端点**：`GET /memories` 带假 key（`Authorization: Bearer nmem_contract_invalid_probe`）→ **401**；不带 key → 200（本机免 key 事实）；不得以 `/health` 代替；
  3. `POST /memories/search`（fast）→ 200，逐元素收窄校验（`memory` 可为 null、`similarity_score` 数值）；deep 模式同查询观测延迟（信息性记录，无硬阈值断言，缺口 7 顺带）；
  4. **沙箱写读回**：`POST /memories` 固定 `id='coopanion-nmem-contract-probe'`，labels `['coopanion','contract-test']`，溯源字段对齐插件写路径（`source:'coopanion'`、`source_app:'cortico-world-nmem'`、`agent_id:'coopanion'`）→ `action ∈ {created,updated}` → `GET /memories/{id}` 读回 content 一致且 metadata 溯源在位 → **可选清理（缺口 6 解除）**：`DELETE /memories/{id}` → 2xx，随后 `GET` → 404；
  5. **S6① agent_id 规则（对配置旋钮路径）**：`agent_id:'coopanion'`（旋钮缺省）可写（并入用例 4 载体）；`agent_id:'大肥鱼'`（中文 displayName 真实样本）→ **422 真实样本断言**（断言状态码，响应体原样留证）；
  6. 不进默认 `pnpm test` 断言面（skip 门控保证）；默认运行时既有 105 用例不受影响。
- 工程规约：先读 `AGENTS.md` 与 `../codeharness/docs/engineering-standards.md`；类型保真（收窄惯用法同既有测试：typeof/Array.isArray 守卫后构造，禁 any/unknown 宽化/断言）；不写实现注释；**S4：勿对导入 const 直接取成员调用**（本文件含 CJK 内容，必避该形态）；门禁 0 findings 要求保持。

### 4.2 README（P1 coder）

中文；只陈述已验证事实，远程一律标「未实测（D9）」。必备段：简介与三工具；环境前提；**安装三步**（Extensions 页 local 安装 → Restart process → World 总览启用）；**四旋钮**（baseUrl 需重启 / searchLimit、searchMode、agentId 热改；agentId 缺省 `'coopanion'` 与 Mem agent profile id 约束：小写字母/数字起始，仅字母数字与 `_.:-`，非法值由 Mem 服务端 422 拒绝）；**秘密**（手动编辑部署 `.env`：`~/Library/Application Support/Coopanion/home/companion/.env`，写 `NMEM_API_KEY=...`，值不得含空白；key 不进 config.json/日志/回执；本机免 key 时不发鉴权头）；**远程模式**（baseUrl + `.env` key 两步；附 `nmem config client set` 对照；**注明未实测**）；**安全说明**（Mem `nmem-server` 绑定 `*:14242` 全网卡——局域网内可达，R1 提示：勿在不受信网络暴露/远程模式务必配 key；插件仅向配置的 baseUrl 发请求）；**验收 runbook**（场景 A–D 步骤与证据口径；E 远程不执行）；**契约测试**（运行方式 `NMEM_CONTRACT_BASE_URL=… npx -y pnpm@11.28.6 vitest run tests/contract.nmem.test.ts`、覆盖面、探针 id 与自动清理说明）；License MIT。

### 4.3 入口覆盖与 F2（P1 coder）

- index.ts 入口覆盖：新增小测试（建议独立 `tests/entry.test.ts` 或并入 world.test.ts——择一，不扩文件面）导入 `../src/index.ts` 默认导出并断言与 `definition.ts` 的 `NMEM` 同一引用（`toBe`；不做成员调用，避 S4）；默认 coverage 中 `src/index.ts` 消 0%。
- F2：README 交付后 `npm pack --dry-run`（npm 11.20.0 本机在位）核实识别清单含 `README.md`；输出留证。

### 4.4 场景 A–D 执行口径（P3 planner，证据落 `/tmp/t4-accept-evidence/`）

- 通道：console WebUI 流（程序化、可复现；记录帧流全文）；Coo 行为佐证取 journal（function_call/output）与 events.jsonl；每场景同步 Mem 端 curl 核对。
- A 读召回：预置固定 id `coopanion-nmem-accept-a`（labels `coopanion,acceptance`，独特事实「用户的猫叫 Pixel」）→ 问 Coo「我的猫叫什么名字？」→ 期望 journal 见 `nmem_search` 且答语含 Pixel → 证据留档后 DELETE 探针。
- B 写沉淀：告知 Coo 一条新持久事实（固定内容含可检索标记）→ 期望 `nmem_save`；Mem 端检索核对 labels 含 `coopanion`、source/agent_id 溯源；再要求补充 → 期望带同 id upsert（action=updated）；条目保留作证据（登记 id）。
- C 断连：quit Mem → 问记忆问题 → 期望 failed 回执（X4 固定文案）、Coo 简短告知、Core 进程不崩（PID/`/api/worlds` 复核）→ `open -a` 复启 Mem → 下轮恢复。
- D 旋钮热改：`POST /api/config` 改 `searchLimit=2`（预置 ≥3 条同主题探针，回执条数变化作行为证据）与 `searchMode=deep`（journal 调用→回执时延作信息性证据；代码路径由既有单测守护）免重启生效；再改 `baseUrl` 错值 + `POST /api/run/restart` → 按场景 C 表现（failed）→ 恢复缺省 + 重启。
- 结束态核对：四旋钮回缺省、nmem active、Mem 运行、Core 运行、探针清理（B 条目除外）。

## 5. 决定记录

| # | 决定 | 依据 |
| --- | --- | --- |
| T4-D1 | 契约测试用 plain `fetch` 直连 Mem，不 import 本仓 src：契约对象是 Mem 服务行为（§3.2 原文口径），同时规避 S4 崩溃形态（文件含 CJK） | tasks/T4.md §S4；architecture §3.2 |
| T4-D2 | 契约探针在断言完成后 DELETE 清理（缺口 6 已实证解除「不依赖删除」限制），README 说明 id 与清理行为 | tasks/T4.md 范围 4 |
| T4-D3 | index.ts 入口覆盖以「默认导出与 NMEM 同一引用」离线测试落实（默认 coverage 消 0%），不依赖契约测试 | T1 §9.1 建议；离线可跑优先 |
| T4-D4 | 场景 A–D 由 planner 经 console WebUI 流驱动执行（程序化可复现、免 GUI 依赖；通道为操作员同级对话，internal origin），Coo 行为证据三源互证（帧流/journal/events） | T3-D13 先例；console world 源码事实 |
| T4-D5 | 场景 B 条目保留为活证据（属 Coo 真实写入，登记 id 与内容摘要）；场景 A/契约探针用后 DELETE；不做超范围删除 | 写入纪律（固定探针 id 与场景 B 证据） |
| T4-D6 | 不自行 commit：T4 简报与主文档均未授权本组提交（T1–T3 有明示授权，T4 无）；交付物留工作树并在交接注明 | 流程规约「不得自行 commit」 |
| T4-D7 | P1 回执后 planner 亲核发现 README 首段链接 `https://coopanion.com` 无依据（应用 package.json homepage = `https://github.com/Pal-AI-Lab/Coopanion`）——属第 0 轮交付内文档准确性修正（T3-D12 轮 JSDoc 修正先例），planner 直接改链接并登记，非纠正轮 | 「只陈述已验证事实」口径；T3 先例 |

## 6. 会话登记与验收记录

| 任务 | 角色 | operation | session | 状态 |
| --- | --- | --- | --- | --- |
| T4-P1 初始实现 | coder | `T4-P1-CODER-IMPL` | `e51e5974-7ceb-4067-a25b-95d78b900b75` | **完成**（18:03 回执；见 §6.1；证据 `/tmp/t4-p1-evidence/`） |
| T4-P2 独立验证 | tester | `T4-P2-TESTER-VERIFY` | `4e578720-5d77-4f0c-96fb-d1c1dcb6632e` | **完成**（18:09 回执；无阻塞级缺陷；见 §6.2；证据 `/tmp/t4-p2-evidence/`） |

### 6.1 P1 结果摘要（coder 回执 + planner 亲核）

- **交付**：新增 `tests/contract.nmem.test.ts`（299 行，plain fetch 零 src import）、`tests/entry.test.ts`（9 行，入口同引断言）、`README.md`（135 行）。写入面与指派一致（git status 亲核：恰三个新增未跟踪文件 + 本 worklog），冻结面零触碰，未 commit。
- **契约测试**：门控 `NMEM_CONTRACT_BASE_URL`（未设→5 用例显式 skip；已设不可达→fail 带明确文案；空串回落默认值）；用例覆盖 /health、X5 数据端点鉴权（假 key 401/无 key 200）、search fast 收窄 + deep 延迟信息记录、固定探针 `coopanion-nmem-contract-probe` 写读回+溯源断言+DELETE 清理+404 复核、S6① agent_id 中文样本 422（意外成功路径带清理）。请求体用模板串（规避测试内 JSON.stringify 的 type.broad，已批准声明仅覆盖 client.send）。
- **四命令（planner 独立复跑一致）**：typecheck 0｜test **106 passed + 5 skipped (111)**｜coverage All 98.84/99.65/98.38/98.84，`src/index.ts` **100%（原 0%）**，缺口仅 client.ts 85-92（缺省 fetchTransport，T2 既定）｜harness **13 files, 0 findings**（coder 首遇 size.lines，拆 describe 收敛，未压制）。
- **契约三态运行**：默认 skip（106 过）｜live `http://127.0.0.1:14242` 5 passed ×2 次（deep 846–1082ms 信息记录；探针用后 404）｜不可达端口 `:9` 5 failed（fail 非 skip）。
- **F2**：`npm pack --dry-run` 清单含 `README.md`（11 files）——T1 遗留 F2 闭环。
- **planner 修正（T4-D7）**：README 首段链接 `coopanion.com`→GitHub 官方 homepage（依据 Coopanion package.json）。
- **coder 登记项**：① live `action=updated`（upsert）分支因「用后 DELETE」不会在契约套件出现——upsert 语义由离线单测守护，live upsert 证据归场景 B；② 测试内 JSON.stringify 触发 type.broad 的工程事实（模板串规避）；③ 产品代码缺陷未发现。

| T4-P3 真机验收场景 A–D | planner | —（planner 亲执行） | — | **完成**（18:10–18:21；A/B/C/D 全部通过；见 §6.3；证据 `/tmp/t4-accept-evidence/`） |
| T4-P4 联合准入（实现审查） | reviewer | `T4-P4-JOINT-ADMIT`#1 | `59343cc5-bc02-4323-bf8c-b93d35a01d58` | **完成**（18:26 回执：**接受但有意见，无阻塞**；见 §6.4；证据 `/tmp/t4-r1-review/`） |
| T4-P4 联合准入（架构审查） | architecture | `T4-P4-JOINT-ADMIT`#2 | `e790aab7-b740-4234-b1b1-7232f5e9af46` | **完成**（18:28 回执：**无保留接受**；见 §6.4；证据 `/tmp/t4-r2-arch/`） |

### 6.2 P2 结果摘要（tester 回执）

- **结论：无阻塞级缺陷**。四命令独立复跑全绿（typecheck 0 / 106+5skipped / coverage src 100%、index.ts 100% / 门禁 13 files 0 findings，含 `--base HEAD` 增量复核恰两份新测试、策略无 diff）；契约三态亲跑全过（默认 skip / live 5 passed 含「大肥鱼」→422 真实体 / `:9` 5 failed 非 skip；空串回落、尾斜杠剥除；三次跑后探针 404）；S4（唯一 import 全直接调用）/X5（鉴权走 GET /memories）/S6①（422 真实断言+意外成功清理）定点通过；变异抽查三组各自只红目标用例；F2 复核含 README；仓库零写入。
- **README 一致性：22 项中 20 准确**；O1（场景 C 文案引用全角标点+省略与代码不符——planner 已按 `src/tools.ts` TRANSPORT_TEXT 逐字修正，同 T4-D7 性质）；「运行结束即删除」在断言失败中断时不成立（O3，后续运行收敛，无累积风险——已在证据留档）。
- **观察项登记（不修）**：O2 search 形状断言 0 命中退化；O3 DELETE 后置；O4 默认跑 5 skipped exit 0（opt-in 取舍，README 已说明）；O5 「无 key→200」为本机事实断言；O6 entry 仅引用等价覆盖（T4-D3 口径）；O7 未验证边界（远程/场景 E、nmem CLI 对照命令、低版本兼容声明、安装重跑、Coo 行为层归 P3）；O8 测试内 JSON.parse 收窄惯用法与已评审而一致。

### 6.3 P3 真机验收场景 A–D 结果（planner 执行，2026-10-26 18:10–18:21）

**四场景全部通过**（证据索引 `/tmp/t4-accept-evidence/INDEX.md`；Coo 行为证据源=journal function_call/output 全文，Mem 端核对=curl 输出）：

| 场景 | 结果 | 关键证据 |
| --- | --- | --- |
| A 读召回 | **通过** | 预置探针（猫叫 Pixel）→ 18:11:19 `nmem_search` 命中 0.80 → 引用作答「你猫叫 Pixel」；探针用后清理（404） |
| B 写沉淀 | **通过** | `nmem_save`→「已新建 c8b18918…」；Mem 端 source/agent_id/source_app 溯源在位 + `label_coopanion` 默认并入；二次更新带**同 id**→「已更新既有记忆」（live upsert 实证）；终态恰一条无重复；条目保留为活证据 |
| C 断连 | **通过** | 退出 Mem 后两次 `nmem_search` 均 X4 固定文案（与 `TRANSPORT_TEXT` 逐字一致）；Coo 告知用户并凭自记继续（明确标注非现场查得）；Core PID 未变、turn 正常结束；复启 t+2s → 下轮 search 0.99 命中恢复 |
| D 旋钮热改 | **通过** | searchLimit 5→2 免重启：无显式 limit 查询恰返 2 条（Coo 自述「缺省条数变小」）；searchMode fast→deep 免重启：时延 2.027s + 分数分布变化双信号；baseUrl 错值+重启：按 C 表现（不可达回执、进程稳定）；恢复缺省+重启：全链路恢复（缺省 5 条、水星条目回归） |

- **终态恢复**：四旋钮缺省、nmem active 三工具、Mem/Core 运行、探针全部清理（B 条目按 T4-D5 保留）、git 仅 4 个交付文件未跟踪。
- **过程事实登记**：①shell 循环转义破坏 UTF-8 致 3 次 seed 400（工具侧问题非产品缺陷，Python 直发 200）；②Coo 回复通道为 pet_say（console 消息不回帧，journal 为权威证据源）；③Coo 在场景期间自行向其工作区 log 追加 T4 观察记录（保留未动）；④Core 两次重启（D 段），PID 67286→77573→77767，重启后 nmem 均 active t+1s。

### 6.4 P4 联合准入结论（18:26/18:28）

- **R1（reviewer）：接受但有意见，无阻塞**。亲验：typecheck 0、106 passed + 5 skipped、coverage 98.84/99.65 与 index.ts 100%、门禁 13 files 0 findings（uv 缓存权限→临时缓存重跑，先例同 T3-R1）；现场核对：A–D journal 与交付证据吻合、四旋钮缺省、五个探针 404、B 条目保留、HEAD `ce11405` 与四文件哈希前后一致。非阻塞：①契约解析器把缺失 `memory` 当 null（较生产收窄器宽松）；②零命中时逐元素断言空转；③README「运行结束即删除」不覆盖断言中断。验证边界：live 契约复用 P1/P2 原始日志、未复跑远程/安装/GUI；journal 不直接存 failed 布尔（deep 现场证据属间接信号）。报告 `/tmp/t4-r1-review/REVIEW.txt`。
- **R2（architecture）：无保留接受**。亲验：门禁/typecheck/test/coverage/契约三态（live 5 passed + 探针 404、`:9` 5 failed）/npm pack/git 冻结面零 diff/四文件与 src 逐项交叉核对/live journal 对 d5/d7 窗口直接提取补证/缺口 9 证据链（rootDir↔live config.json 落位）/B 条目 200。逐要点：契约测试与 §3.2 逐项对齐（DELETE 清理=缺口 6 预置可选分支）；T4-D1/D3 成立、S4 两文件规避；README 与 §2e/§3.3/D9/D12/T3-D15 一致；场景 A–D 与 §3.3 期望表逐项相符；T4-D1~D7 无越权。非阻塞建议：①d5/d7 提取文件首版 0 字节（已由 R2 live 补证成立；planner 已重提取补齐+INDEX 注记）；②worklog §2 源码参照路径已补「仓库签出 vs 发行版 build」说明；③architecture.md §3.2/§7-6/§7-9 设计期措辞待 orchestrator 收口（含「不进默认 pnpm test」实现为门控 skip 的口径）；④O3 同 R1；⑤`ctx.secret()` 手工 .env 实读回路未 live 验证（D9 范围，随场景 E）。记录 `/tmp/t4-r2-arch/REVIEW-RECORD.md`。
- **联合准入：通过**（R1 无阻塞接受 + R2 无保留接受；非阻塞项全部登记 §7，无待修项）。

## 7. 遗留问题 / 超范围记录

| # | 项 | 状态 | 去向 |
| --- | --- | --- | --- |
| S1 | 契约测试观察项（P2 O2/O3/O4/O5、R1 同类）：零命中断言空转；DELETE 后置（断言中断时探针残留一次，后续运行收敛，无累积风险）；默认跑 5 skipped exit 0（opt-in 取舍，README 已说明）；「无 key→200」为本机事实断言；契约解析器把缺失 memory 当 null（较生产宽松） | 登记（均非阻塞，双审接受） | orchestrator 整体验收参考 |
| S2 | 远程链路（场景 E、D9）：未实测（README 已标注）；`ctx.secret()` 手工 .env 实读回路、`nmem config client set` 对照命令均未 live 验证 | 登记（设计决策 D9 范围） | 用户远程化时补验收 |
| S3 | GUI 目视确认（缺口 5 可选项）：设置页四旋钮呈现与 pattern GUI 呈现未目视（API 级证据 T1/T4 均在；用户参与可选项） | 登记（可选） | 用户 |
| S4 | codeharness 外部缺陷（T3 登记）：本组遵守短期约束（契约/入口测试均无「导入 const 取成员调用」形态，门禁 0 findings 未受影响） | 沿用登记 | 用户/orchestrator（是否另立修复任务） |
| S5 | architecture.md 文档收口清单（R2 建议③）：§3.2「不进默认 pnpm test」实现为门控 skip 的口径、§7-6/§7-9 关闭标记补记、live upsert 证据归场景 B 的事实 | 登记 | orchestrator 汇入时 |
| S6 | 环境/过程事实（无产品缺陷）：①P3 期间 shell 循环转义破坏 UTF-8 致 3 次 seed 400（工具侧）；②Coo 回复走 pet_say 通道（console 不回帧，journal 为权威证据源）；③Coo 自行向其工作区 log 追加 T4 观察记录（保留未动）；④Core 两次重启后 nmem 均 t+1s active | 登记 | 记录在案 |

## 8. 交接材料（组级验收通过，2026-10-26 18:3x）

**组级状态：已验收（组内口径；不替代整体最终验收）**——联合准入 R1（reviewer）无阻塞接受、R2（architecture）无保留接受；必要验证（四命令含 coverage、契约三态）经 coder/tester/planner/R1/R2 多方独立复跑全绿；场景 A–D 全部通过且证据可追溯；无阻塞问题待关闭。

### 8.1 交付清单（工作树未提交，T4-D6）

- 新增 `tests/contract.nmem.test.ts`（299 行，opt-in 契约套件）；新增 `tests/entry.test.ts`（9 行，入口覆盖）；新增 `README.md`（135 行，含 T4-D7/O1 两处准确性修正）；本 worklog。冻结面（src/*、package.json、AGENTS.md、.codeharness/*、describe.json、vitest.config.ts）零触碰；HEAD `ce11405`。
- **未 commit**：T4 简报与主文档均未授权本组提交（T1–T3 有明示，T4 无）；建议 orchestrator/用户指示后分次逻辑提交（建议：代码+测试+README 一笔、worklog 一笔）。

### 8.2 验收结论汇总

- 契约套件：三态验证通过（默认 skip 显式 / live 5 passed×多轮、探针零残留 / 不可达 fail 非 skip）；X5、S6①、DELETE 可选清理（缺口 6 关闭）、deep 延迟信息记录（缺口 7 顺带）均落实。
- README：22 项一致性核对 20 项直接准确，2 项已在本轮内修正（链接、X4 文案）；缺口 9（.env 确切路径）证据链充分并写入 README。
- 真机场景 A–D：全部通过（§6.3）；E 远程不执行（D9）；index.ts 覆盖消 0%（T1 遗留闭环）；F2 闭环（npm pack 含 README）。
- 环境终态：四旋钮缺省、探针清理完毕（B 条目保留为活证据，id `c8b18918-6d23-49c4-b92d-e2ebb1131abb`）、Mem/Coopanion 运行正常。

### 8.3 证据索引

- 实现：`/tmp/t4-p1-evidence/`（INDEX.md + 四命令/契约三态/npm pack）
- 独立验证：`/tmp/t4-p2-evidence/`（INDEX.md + README 22 项表 + 变异）
- 真机场景：`/tmp/t4-accept-evidence/`（INDEX.md + A–D 全套帧流/journal/Mem 端输出/终态）
- 联合准入：`/tmp/t4-r1-review/`、`/tmp/t4-r2-arch/`

### 8.4 给 orchestrator 的入口

- 残余问题清单见 §7（均非阻塞：S1 观察项、S2 远程 D9、S3 GUI 可选、S4 外部缺陷沿用、S5 文档收口、S6 过程事实）；提交授权待指示（§8.1）；整体验收阶段可复用 `/tmp/t4-*` 证据目录。

**本组状态标记（2026-10-26 18:3x）：实施已结束，待主文档汇入。组级验收通过（R1 无阻塞接受/R2 无保留接受）；全局纠正额度维持 2/2 已用尽（本轮内 T4-D7/O1 两处文档准确性修正属交付内修正，非纠正轮）；在途会话/operation 无。T4 停止，不自动 chat orchestrator、不启动整体验收。**

## 9. 验收收口修正轮（用户授权方案 A，2026-10-26 晚；主文档 v0.12 §7）

前置：整体验收三方意见已交付（acceptance/，评审基准 `511f879`）——ACCEPT-REVIEWER 不予准入（B1/C1 阻塞，N1 非阻塞）；用户授权方案 A 文档修正轮，范围恰四点不扩大；本组交付已由 orchestrator 提交（`9965b75`/`511f879`，T4-D6解除）。

| # | 事项 | 修改 | 依据 |
| --- | --- | --- | --- |
| 1 | B1（README:80） | 删「只向 baseUrl 发起请求不向其他地址外联」无条件承诺；如实披露：首个请求发向 baseUrl；Node fetch 默认跟随服务端重定向（如 307），请求正文会被转发到重定向目标（鉴权头不跨 origin 转发）；仅信任的 Mem 服务端（本机默认）下使用；远程注意服务端可信性 | reviewer §2 B1（两方探针互证）；不改变传输行为（代码级重定向限制登记为后续可选加固，不在本轮） |
| 2 | N1（README:131） | 「运行结束即删除」限定成功路径：断言全部通过后才执行 DELETE；失败运行可能残留固定 id 探针一次，下次运行覆写并清理，不累积 | reviewer §5 N1 |
| 3 | C1（README:53/56） | 秘密来源措辞：NMEM_API_KEY 经框架 ctx.secret() 读取——进程环境变量优先、其次部署 .env（与 nmem CLI 优先级一致）；「写 .env 后重启读到新 key」仅进程环境无同名变量时成立（轮换值可能被遮蔽） | reviewer §2 C1；orchestrator 处置：接受框架语义并同步措辞 |
| 4 | AGENTS.md 第 8 条（冻结面授权变更，仅措辞） | 「秘密只经部署 .env」→「秘密读取遵循框架 ctx.secret() 语义（进程环境变量优先于部署 .env），key 仍不得进 config.json、日志、回执或测试快照」 | 同 C1；用户授权含 AGENTS.md 措辞 |

- **写入面**：恰 README.md（4 处）与 AGENTS.md（1 处）；代码/测试/门禁/其他文档零改动（git diff 亲核）。
- **四命令（收口后复跑）**：typecheck 0｜test 106 passed + 5 skipped｜coverage 不变（All 98.84/99.65；index.ts 100%）｜门禁 13 files 0 findings（UV_CACHE_DIR 临时缓存沿用先例）。
- **闭环**：ACCEPT-REVIEWER 原会话定点复核（见 §9.1）。

### 9.1 定点复核结论（待填）
