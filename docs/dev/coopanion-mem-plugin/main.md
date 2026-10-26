# 需求主文档：Coopanion × Nowledge Mem 插件（coopanion-mem-plugin）

- 需求标识：`coopanion-mem-plugin`
- 主文档版本：v0.7（实施中：T1/T2 组级验收通过；**全局纠正额度已归零**；T3 待启动/继续）
- 项目仓库：`/Users/tomahawkd/Documents/projects/coopanion-nmem`（本仓库，尚无 git）
- 需求开发目录：`docs/dev/coopanion-mem-plugin/`（用户 2026-10-26 裁定）
- 最后更新：2026-10-26 16:20 CST，由 orchestrator 维护

## 1. 用户原始意图

> 想做一个 https://github.com/Pal-AI-Lab/Coopanion 这个项目的插件，连接 https://mem.nowledge.co/docs 这个记忆管理软件。在此之前，还需要配置 ../codeharness 以支撑 architecture 管理和审查代码架构。

## 2. 用户已确认决定（2026-10-26 问卷裁定）

| # | 决定 | 内容 |
| --- | --- | --- |
| D1 | 需求文档落位 | `docs/dev/<需求名>/`，本需求为 `docs/dev/coopanion-mem-plugin/` |
| D2 | 业务范围 | **双向：读 + 写**。Coo 对话时可搜索/召回 Nowledge Mem 中的记忆；对话中的新记忆也写入 Mem |
| D3 | 交付形态 | **Cortico 扩展（World 包）**，TypeScript，可从 Coopanion Extensions 页安装 |
| D4 | Mem 接入 | **本地与远程都支持**（默认本机 Mem 的 HTTP API，可配置远程 url+key；统一抽象由架构阶段决定） |
| D5 | codeharness 配置范围 | ① 确认 `../codeharness` 可运行（uv 环境）；② 在本仓库创建 `.codeharness/code-harness.json` 架构策略（owner/import 边界）与 `AGENTS.md` 规约；③ architecture 在设计阶段定义边界，审查流程用门禁核查。不改 codeharness 本身 |
| D6 | 验收环境 | 本机（macOS）已安装 Coopanion 发行版，可本机安装扩展实测 |
| D7 | 发布形态（2026-10-26 二次裁定） | 本期不发布官方市场，本地 sideload 交付；后续可独立立项 |
| D8 | WebUI 面板（同上） | v1 不做；配置走 ConfigGroup 旋钮，API key 手动编辑部署 .env |
| D9 | 远程验收深度（同上） | 仅本地验收；远程以配置面+文档交付，README 注明「未实测」 |
| D10 | A5 写路径策略（同上） | PARTNER.md 并行写：Coo 照常维护 PARTNER.md，同时另存 Mem（ENV_PROMPT 提示词策略） |
| D11 | 许可证（同上） | MIT（与 Cortico 模板一致；发布市场时可复议） |

## 3. 明确约束

- Coopanion：AGPL-3.0，Electron + Cortico 内核，扩展即 Cortico World；扩展对使用者呈现只允许「经 Bot 工具/事件」或「托管自己的环境」两条路（Coopanion DEVELOPMENT.md「应用界面与 World 的边界」）。
- Nowledge Mem：本地优先记忆层，提供 HTTP API、MCP server 与 `nmem` CLI；远程模式经 `nmem config client set --url ... --api-key ...`。
- codeharness（`../codeharness`）：只读工程策略门禁 CLI（`code-harness --root <repo> --all` 等），支持 TS/TSX；无 MCP server 模式；目标仓库自带并提交 `.codeharness/code-harness.json` 策略；策略变更需全量审计与 architecture 审查（其 AGENTS.md 规约）。
- 派发规约：业务子任务由用户独立启动 planner 主会话实施；orchestrator 只交付任务入口与启动说明。

## 4. 需求解释（当前口径）

让 Coopanion 桌宠 Coo 的记忆与用户的 Nowledge Mem 知识库双向打通：

1. **读（召回）**：Coo 在对话中能够搜索/读取 Mem 中的记忆，用于回答与上下文；
2. **写（沉淀）**：Coo 对话中产生的新记忆（以及/或其现有 PARTNER.md 记忆流）保存到 Mem；
3. 不替换 Coopanion 内置记忆系统（D2 选「双向」而非「替换内置记忆」）；与 PARTNER.md 的关系由架构阶段澄清并存疑记录。

## 5. 假设验证结果与待确认事项

探索后假设状态（证据见 `explorations/` 两份报告）：

| 假设 | 状态 | 结论摘要 |
| --- | --- | --- |
| A1 发行版可本地 sideload | **成立（有限定）** | Extensions 页 local 分段 → `POST /api/extensions/install {path}`，pnpm link 安装；装后需 Restart process + World 总览手动启用；无需进官方市场 |
| A2 Mem HTTP API 可用 | **成立** | 本机已验证：写 `POST /memories`（`id` 可作幂等 upsert）、搜 `POST /memories/search`（混合检索）、读 `GET /memories/{id}`；本机免 key，远程须 `Bearer nmem_…`/`X-NMEM-API-Key`，**有 key 才发头，错 key 会 401** |
| A3 扩展可访问 localhost/远程 | **成立** | 扩展与 Core 同进程（完整 Node 能力），无沙箱；回环强制进 NO_PROXY；renderer 白名单不影响扩展后端代码 |
| A4 本机已装 Mem | **已验证** | Nowledge Mem 0.10.108 运行中，API 基址 `http://127.0.0.1:14242`，embedding local-gguf 未降级；MCP 同端口 `/mcp`（Streamable HTTP，75 工具） |
| A5 与 PARTNER.md 的写路径关系 | **已关闭（D10）** | 并行写：ENV_PROMPT 提示词策略（非代码 hook）；不加模式旋钮（architecture.md §2d） |
| A6 远程模式真机链路 | **已关闭（D9）** | 本期仅本地验收；远程能力以配置+文档交付并标注未实测，作为已知限制保留 |

关键新事实（设计约束）：World 不能读 PARTNER.md；`outputTap` 可与桌宠扇入并存但拿不到用户输入；工具名全局唯一须用前缀（建议 `nmem_`）；`POST /threads` 有自动提炼副作用（重复写风险）；`storeSecret` 拒绝含空白值；无第三方 World 产品级兼容承诺（world 契约现为 6，严格相等才加载）。

## 6. 业务子任务与状态

整体方案：`docs/dev/coopanion-mem-plugin/architecture.md`（ARCH-DESIGN-1 交付；单一 World 包 `cortico-world-nmem`，四层：Mem REST 客户端 / World 工具与事件 / 配置与秘密 / ENV_PROMPT 策略；REST 直连、纯工具召回、`nmem_save` 唯一写路径幂等 upsert、错误矩阵、codeharness 策略草案）。

| 子任务 | 责任组 | 简报 | 目标（行为） | 依赖 | 状态 | 验收依据 |
| --- | --- | --- | --- | --- | --- | --- |
| T1 仓库脚手架与工程门禁 | planner「T1」 | `tasks/T1.md` | 可安装可挂载的最小 World 包 + 工程门禁就位 | 无 | **组级验收通过（第 0 轮 + 纠正第 1 轮；基线提交 `496fd20`）**；非阻塞分流：L5→T2、F4/F5→T3、index.ts 覆盖/F2/缺口 5 GUI 目视→T4 | 三命令+coverage 全绿 + sideload 三步 + nmem.started 事件（orchestrator 亲验）；R1 无阻塞接受、R2 无保留接受 |
| T2 Mem REST 客户端层 | planner「T2」 | `tasks/T2.md` | 类型化、框架无关、可独立单测的 Mem 客户端 | T1 ✅ | **组级验收通过（第 0 轮 + 纠正第 2 轮；提交 `caf7b2a`→`8322e45`）**；契约快照 §8.4 冻结；X4→T3、X5→T4、真实联测→T4 已分流 | 43→51 用例 + 覆盖不劣化 + 门禁 0 findings（X2 收口，三方四次复跑）；R1 撤回全部阻塞、R2 无保留接受（orchestrator 亲验） |
| T3 World 工具与提示词策略 | planner「T3」 | `tasks/T3.md` | Coo 能经 nmem_* 工具读写 Mem（含 client↔world 集成） | T1 ✅ T2 ✅（seam 冻结，集成段已解锁） | 未启动（可启动） | dry-mount + 工具单测（fake client）+ describe 一致性；含 X4（excerpt 不透传）与 F4/F5 |
| T4 契约测试与真机验收支撑 | planner「T4」 | `tasks/T4.md` | 端到端链路验证 + 可重复验收材料 | T3（编码可先行于 T2 后） | 未启动 | 契约套件全绿 + 场景 A–D 留证；附 index.ts 入口覆盖、F2（README/files 核对）、缺口 5 GUI 目视（可选） |

依赖顺序：T1 → {T2 ∥ T3（至集成点）} → 集成（T3 内）→ T4。每组由用户独立启动 planner 主会话；组内实施细化由 planner 负责。

## 7. 阶段状态与全局纠正预算

- 当前阶段：**实施中**（T1/T2 已关闭；**T3 待启动**（若尚未开）或继续；T4 待 T3 完成后启动）。
- 纠正预算登记：第 0 轮（初始）、纠正第 1 轮（T1）、纠正第 2 轮（T2）均已关闭；**全局纠正额度已归零（2/2 已用）**。⚠ T3/T4 及最终验收阶段若再需任何修正，须用户明确增加授权，否则 orchestrator 停止纠正派发（问题仍会登记与汇报，但不派发修正）。
- X2 落地登记（义务③）：声明已于 `5a2c940` 落地（与批准件逐字一致，纯增量）；收口证据 = 真仓库全量审计 0 findings（即时/C1 后/C1b 后/终态四次，三方复跑）；移除条件 = `send` body 语义或 transport 契约出现非出口消费者时复审；fail-closed = `send` 签名/路径变化即惰性失效、finding 回归。详见 T2-worklog §9.1。
- 冻结约束更新：`package.json` 与 `AGENTS.md` 仍冻结；`.codeharness/code-harness.json` 自本轮起含已批准声明，后续变更同样走全量审计 + architecture 审查。
- 纠正预算登记：第 0 轮（初始）与纠正第 1 轮（T1）已关闭；**纠正第 2 轮（进行中）= T2 修正包**，范围：①C1（R1-F1）：`retryAfterDelayMs` 双形式解析（delay-seconds / HTTP-date）+ 空/无效回退 1000ms + >10s fail-fast 不重试 + 固定时钟边界用例（范围与测试义务按 T2-worklog §6.7 收敛清单，不扩大）；②X2：落地已批准的 `type.broad.encoding.instance_outputs` 声明（architecture.md §4.1 定稿机制），落地后真仓库 `--all` 全量审计须 **0 findings** 作收口证据，并履行登记/fail-closed 义务。验收口径：R1 定点复核 F1 后撤回阻塞；R2 条件 A/B 均闭环后无保留接受。**⚠ 本轮关闭后全局纠正额度为 0：T3/T4 及最终验收若再需修正，须用户明确增加授权，否则停止纠正派发。**
- orchestrator 裁定记录（2026-10-26）：X2 批准（依据：设计期 AGENTS 第 2 条/§4.1 预授权路径 + 双探针有效性/最小性 + R2 首评采纳 + R1 三前提代码侧复核；附四条配套义务见 architecture.md §4.1）；O1 登记为**已接受风险**：无 id 的 save 在 429/5xx 重试窗口可能重复写——v1 维持均匀重试矩阵（措辞约束：不得宣称本地无风险或重复落库已实测；远程化（A6/场景 E）成真时升级，若改重放政策须带「首次提交后失败」有状态测试）；X4（错误 excerpt 未脱敏，回执不得原样透传）→ T3 简报；X5（/health 不鉴权，鉴权验证走数据端点）→ T4 简报。
- 纠正预算登记：初始实施与审查为第 0 轮；**纠正第 1 轮（进行中）= T1 修正包**，范围：C3（删 definition.ts 两行实现注释）、C4/C4′（补覆盖证据 + AGENTS 第 4 条修订）、C1（F1 处置，裁定 B：移除 ConfigGroup 的 enabled 旋钮，interface/defaults 保留）、L1（git init + 基线提交，T2/T3 启动前完成）。验收口径：R1 原会话定点确认后撤回阻塞；R2 条件 C1/C2 落地后无保留接受。**本轮关闭后剩余额度 1**。
- orchestrator 裁定记录（2026-10-26，依据 T1-R1/R2 双方收敛结论，无需升级用户）：C1 取 B（模板仅声明自有旋钮，enabled 归 World 总览开关，避免双重开关；R2 建议、R1 无异议）；L1 授权 git init（门禁 diff 审计、「不自动回滚」纪律、并行界定均依赖版本控制；仅新增，不触及既有内容）；C2 修订包已由 orchestrator 汇入 architecture.md §2e/§4.1/§7 与 T2/T3 简报。

## 8. 探索任务登记

| 任务标识 | 角色 | 目标 | 交付物 | 状态 |
| --- | --- | --- | --- | --- |
| EXPLORE-COOPANION-EXT | explorer | Coopanion/Cortico 扩展开发机制与安装路径 | `explorations/coopanion-extension.md` | **已完成**（结论含 1 处自我更正：outputTap 扇入可并存，非独占） |
| EXPLORE-NMEM-API | explorer | Nowledge Mem 接入面与本机状态 | `explorations/nmem-api.md` | **已完成**（本机已验证 + OpenAPI 实拉） |
| ARCH-DESIGN-1 | architecture | 整体技术方案、模块边界、拆分建议、codeharness 策略设计 | `architecture.md` | **已完成**（11 项定夺 + 4 项用户决策已裁定 + 9 项实现期验证缺口登记；缺口 1/2/3/5 已随 T1 关闭，4/6/7/8/9 分别归 T2/T4） |
| T1-IMPL（第 0 轮） | planner「T1」组内（coder/tester/reviewer/architecture 六会话） | 脚手架、门禁、uv sync、缺口 2/3/5、真机 sideload、联合准入 | `tasks/T1-worklog.md` §6 | **已完成，组级未验收**（联合准入收敛「需修改后接受」） |
| T1-FIX1（纠正第 1 轮） | planner「T1」组内 | C3/C4/C4′/C1-B/L1 + R1/R2 闭环 | `tasks/T1-worklog.md` §9 | **已完成，组级验收通过**（基线 `496fd20`） |
| T2-IMPL（第 0 轮） | planner「T2」组内（coder×3/tester/R1/R2 六会话） | mem 客户端、43 用例矩阵、L5+守护、缺口 4 实测、缺口 7 关闭、联合准入+交叉核对 | `tasks/T2-worklog.md` §6–§8 | **已完成，组级未验收**（收敛「需修改后接受」；提交 `caf7b2a`→`5d30e8d`） |
| T2-FIX2（纠正第 2 轮） | planner「T2」组内 | C1/F1/F1b 双形式解析与 fail-fast + X2 声明落地与审计收口 + R1/R2 闭环 | `tasks/T2-worklog.md` §9 | **已完成，组级验收通过**（提交 `e79cb19`/`5a2c940`/`160cd51`/`8322e45`） |

## 9. 角色会话登记

| 角色 | 会话/操作 | 任务 | 状态 |
| --- | --- | --- | --- |
| explorer | 会话 12163038-0fe8-44fd-93c8-3be108334b6d | EXPLORE-COOPANION-EXT | 已完成 |
| explorer | 会话 44e379e3-37e0-4c20-a7b8-1336f17770bb | EXPLORE-NMEM-API | 已完成 |
| architecture | 会话 70000772-8a28-4b47-beb7-82f5a1e28360 | ARCH-DESIGN-1 | 已完成 |

附注：ARCH-DESIGN-1 期间在 `../codeharness` 做只读验证时意外产生空 `.venv/`（gitignored）并使 uv 下载 CPython 至缓存；按不自动回滚纪律保留，T1 将在同一环境完成 `uv sync`（D5①授权）。

## 10. 版本历史

- v0.1（2026-10-26）：建立主文档；记录用户 6 项裁定、约束、需求解释与未决假设；派发两项有界探索。
- v0.2（2026-10-26）：两项探索完成并核实交付物；A1–A4 验证成立、新增 A6；登记关键设计约束与遗留决策点（A5、发布形态、召回触发、面板、outputTap、MCP vs REST、config.json 复用）；派发 ARCH-DESIGN-1。
- v0.3（2026-10-26）：ARCH-DESIGN-1 完成并核实（`architecture.md`）；用户二次裁定 D7–D11，A5/A6 关闭；填入 T1–T4 子任务表与四份任务简报（`tasks/T*.md`）；整体设计完成，待用户启动实施。
- v0.4（2026-10-26）：T1 第 0 轮交付完成并经 orchestrator 亲验（三命令全绿、sideload 证据在位）；登记纠正第 1 轮（C3/C4/C4′/C1-B/L1）；C2 修订包汇入 architecture.md 与 T2/T3 简报；缺口 1/2/3/5 关闭、L2/L3 关闭、L4 归纠正轮；C1/L1 由 orchestrator 裁定（依据双方收敛结论）。
- v0.5（2026-10-26）：T1 纠正第 1 轮闭环，组级验收通过（R1 无阻塞接受、R2 无保留接受；四命令含 coverage 三方复跑全绿；基线提交 `496fd20`，orchestrator 亲验）；纠正第 1 轮关闭，剩余额度 1；非阻塞分流登记（L5→T2，F4/F5→T3，index.ts/F2/缺口 5 GUI→T4）；T2/T3 开放启动。
- v0.6（2026-10-26）：T2 第 0 轮完成并亲验（43/43、覆盖、恰 2 条登记 finding、证据在位）；登记纠正第 2 轮（C1 按 §6.7 收敛范围 + X2 落地）；X2 批准（附四条义务，architecture.md §4.1 定稿）；§2f Retry-After 双形式澄清登记；O1 已接受风险登记；X4→T3、X5→T4 分流；**本轮后纠正额度归零，后续修正需用户增授权**；T3 允许与 T2 纠正轮并行（seam 冻结）。
- v0.7（2026-10-26）：T2 纠正第 2 轮闭环并亲验（声明与批准件一致、51/51、门禁 9 files 0 findings、工作树干净）；T2 组级验收通过（R1 撤回全部阻塞含 F1b、R2 无保留接受延伸至终态）；缺口 4/7 关闭；X2 落地登记（义务③）完成；**全局纠正额度 2/2 已用尽**；T3 集成段解锁。
