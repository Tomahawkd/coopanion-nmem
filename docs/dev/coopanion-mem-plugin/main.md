# 需求主文档：Coopanion × Nowledge Mem 插件（coopanion-mem-plugin）

- 需求标识：`coopanion-mem-plugin`
- 主文档版本：v1.1（后续需求 F1：文档英文化与远端发布，用户直接指令，orchestrator 执行）
- 项目仓库：`/Users/tomahawkd/Documents/projects/coopanion-nmem`（本仓库，尚无 git）
- 需求开发目录：`docs/dev/coopanion-mem-plugin/`（用户 2026-10-26 裁定）
- 最后更新：2026-10-26 21:40 CST，由 orchestrator 维护

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
| D12 | agent_id 可配置（2026-10-26，针对 S5 的新增授权） | 新增旋钮 `worlds.nmem.agentId`（缺省 `'coopanion'`，热改；须满足 Mem 约束：小写字母/数字起始，仅字母数字与 `_.:-`），工具层不再使用 `ctx.botName`；属**新增范围授权，非纠正轮**，全局纠正额度维持 2/2 已用尽 |

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
| T3 World 工具与提示词策略 | planner「T3」 | `tasks/T3.md` | Coo 能经 nmem_* 工具读写 Mem（含 client↔world 集成） | T1 ✅ T2 ✅ | **全部闭环：第 0 轮 + D12 轮均组级验收通过**（提交 `0bdbb1b`→`66988cc`）；**S5 写路径已真机解锁**（agent_id='coopanion' Mem 端核验）；遗留仅 S4 外部缺陷（短期约束在案） | 105/105、四文件 100%、门禁 11 files 0 findings（四方复跑）；R1 接受无阻塞、R2 无保留+终态确认（orchestrator 亲验） |
| T4 契约测试与真机验收支撑 | planner「T4」 | `tasks/T4.md` | 端到端链路验证 + 可重复验收材料 | T1–T3 ✅ | **组级验收通过（第 0 轮；提交 `192e9cb`/`9965b75`）**；场景 A–D 真机全过（E 未执行，D9）；缺口 6/9、index.ts 覆盖、F2 闭环；契约套件 live 5/5 | 四命令亲验（106+5skip、覆盖 98.84/99.65、门禁 13 files 0 findings）；R1 接受无阻塞、R2 无保留接受；残余项见 T4-worklog §7 |

依赖顺序：T1 → {T2 ∥ T3（至集成点）} → 集成（T3 内）→ T4。每组由用户独立启动 planner 主会话；组内实施细化由 planner 负责。

## 7. 阶段状态与全局纠正预算

- 当前阶段：**完成**。整体验收三方意见：tester 通过、architecture 接受无阻塞、reviewer 于验收收口轮后接受（B1/C1 撤阻、N1 确认）。**最终验收结论：通过**（业务目标达成、证据充分、已知限制与未验证项如实登记）。
- 验收收口轮（用户方案 A 授权）：提交 `c954695`（恰 README 4 处 + AGENTS 1 处）→ `71229a9`；reviewer 原会话定点复核接受；预算登记：原 2 轮 + 本轮新增授权，均未超范围。
- **残余清单（结项归档）**：①未验证项（如实保留）：远程链路 A6/场景 E（D9，README 已标注）、GUI 目视 S3（可选，API 级已证）、`ctx.secret()` 手工 `.env` 实读回路 V3；②已接受风险/已知行为：O1 无 id 重试重复写（远程化时升级）、B1 重定向行为已披露（代码级限制为可选加固）、C1 框架 env 优先语义已披露、D10 提示词策略下 PARTNER.md 更新频次依赖模型行为（观察项）、S4 codeharness 外部缺陷（按 D5 不修，短期约束在案，修复另立任务）；③后续可选加固/立项（均需另立需求与授权）：N2 契约测试空转补强、重定向限制（redirect:'error'/仅同源）、官方市场发布（D7 本期不做）、远程验收补测（需用户提供 url+key）、codeharness CJK 崩溃修复（建议以最小复现为回归夹具）。
- 交付形态：本仓库（git main，19 次提交，工作树干净）即完整交付；插件已在本机 Coopanion 侧安装并启用，可日常使用。
- **三方独立结论**（评审基准 `511f879`，交付于 acceptance/）：①ACCEPT-TESTER：业务闭环成立——八项清单 6 通过/1 观察（D10）/1 未验证（远程、GUI）；自采真机证据（含 toolcalls.jsonl 现场失败布尔、真实 .env→401 回路、探针零残留）。②ACCEPT-REVIEWER：**不予准入（需修改）**——B1（README 安全承诺不实：Node fetch 默认跟随 307 重定向，save 正文可被转发至其他 origin；两方独立探针互证，鉴权头未跨 origin 转发；属交付文档缺陷非功能缺陷）；C1（`ctx.secret()` 实现优先读进程环境变量，与「秘密仅经部署 .env」规约/README 冲突，需负责人裁定）；非阻塞 N1（README 清理文案过满）/N2（契约测试可空转）/N3（文档收口，已由 orchestrator 汇入 architecture.md）。③ACCEPT-ARCH：**接受（无阻塞）**——方案符合性/门禁一致/D1–D12 全落实/seam 冻结有效/限制登记如实；F1（S4 约束措辞精度）、V1–V3（既定未验边界）；措辞收口清单 W1–W10 **已由 orchestrator 汇入**。
- **orchestrator 处置意见**（B1/C1 裁定，依冲突处理序）：B1 事实无争议，处置二选一——(a) 修 README 披露重定向行为并登记已知行为（推荐：风险边际低——仅当 Mem 服务端自身返回 307 时才触发，且鉴权头不跨 origin 转发；探针未证明真实泄露）；(b) 改 client 限制重定向（代码级加固，涉 T2 seam，工作量中等）。C1 建议接受框架语义（与 nmem CLI 自身优先级一致：env > config）并同步规约/README 措辞；两项均为**文档/规约层小修**，但预算已尽，**须用户明确增加授权**方可派发（修正归 T4 planner；AGENTS.md 属冻结面需授权变更）。
- 预算状态：全局纠正额度 2/2 已用尽；验收收口修正轮为用户 2026-10-26 方案 A 新增授权（见上），范围四点不扩大；后续任何修正仍需另增授权。
- S4 约束措辞已按 N3/F1 收窄登记（实证触发形态：特定跨文件绑定场景与 `Omit<…>`+索引访问形态；现行树含 `NMEM.create()` 形态且门禁不崩）。
- 纠正预算登记：全局纠正额度维持 **2/2 已用尽**。⚠ 整体验收若发现需修正的问题：只登记与汇报，修正须用户明确增加授权。
- 整体验收准备（待用户启动后执行）：组织新 tester/reviewer/architecture（+必要 explorer）核查真实业务入口→结果使用方全链路、关键失败表现、需求覆盖（D1–D12）；核对各组准入意见、验收证据与集成条件；复用/区分本轮证据与未验证项（远程 A6、O1 风险、S4 外部缺陷、S1–S6 残余）；可选用户参与项：GUI 目视四旋钮（S3）。
- 外部缺陷登记（S4，转用户知恶）：`../codeharness` 存在跨文件绑定崩溃缺陷（测试对导入 const 直接取成员调用时，CJK 内容必现 `UnicodeDecodeError`，exit 2；合成工程已复现，证据 `/tmp/t3-p1-evidence/05-gate-crash-minimal.txt`）。本仓库现状 0 findings 未受影响；短期约束（T4 起）：测试勿对导入 const 直接取成员调用。按 D5「不改 codeharness 本身」不修；是否另立修复任务由用户另行决定（R2 建议：修复宜以最小复现为回归夹具）。
- S5 终局登记：根因为 Mem 服务端 agent profile id 校验（T3-D14 探针实证）；D12 裁定后写路径经旋钮解锁（缺省 ASCII `'coopanion'`），原「改 displayName」事实陈述保留但不再是必要条件；S6①→T4 契约测试（对配置路径）、S6②→DELETE 已实证存在（缺口 6 关闭依据）、S6③→architecture.md §1.4/§2e 措辞已由 orchestrator 按实现口径修正（本轮）。
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
| T3-IMPL（第 0 轮） | planner「T3」组内（coder×3/tester/R1/R2 七会话+smoke） | 三工具+接线+ENV_PROMPT+describe、F4/F5/X4、F1 补齐、真机 smoke、S5 根因定位 | `tasks/T3-worklog.md` §5–§8 | **已完成，组级验收通过**（提交 `0bdbb1b`/`36e622c`/`46bc3c4`；S5 登记→D12 新增范围待执行） |
| T3-D12（新增范围轮） | planner「T3」组内 | agentId 旋钮（pattern/热改/缺省 coopanion）、botName 移除、四旋钮守护、四类用例、增量准入、真机写路径复验 | `tasks/T3-worklog.md` §10 | **已完成，组级验收通过**（提交 `4bee14f`/`f9e55d6`/`66988cc`；S5 解锁，Mem 端核验在档） |
| T4-IMPL（第 0 轮） | planner「T4」组内（coder/tester/R1/R2 会话） | 契约套件、入口覆盖、README、场景 A–D 真机执行、缺口 6/9/F2 闭环、联合准入 | `tasks/T4-worklog.md` | **已完成，组级验收通过**（提交 `192e9cb`/`9965b75`，orchestrator 代提交并亲验） |
| T4-CLOSE（验收收口轮，方案 A 授权） | planner「T4」组内 | B1/C1/N1 文档修正（恰两文件）+ reviewer 定点复核撤阻 | `tasks/T4-worklog.md` §9 | **已完成，闭环**（提交 `c954695`→`71229a9`；reviewer 准入终态接受） |
| ACCEPT ×3（整体验收） | 新 tester `398bcdd5` / 新 reviewer `759d6f4d` / 新 architecture `d3f6590b`（均独立于组内准入） | 端到端复验/终态审查/方案符合性 | `acceptance/{tester,reviewer,architecture}.md` | **已完成**：tester 通过+新证据；reviewer 需修改（B1/C1）；architecture 接受无阻塞 |

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
- v0.8（2026-10-26）：T3 第 0 轮闭环并核实（101/101、四文件 100%、门禁 11 files 0 findings；R1/R2 接受延伸终态；smoke：挂载/search 通、save 因 S5 422 已根因定位）；用户裁定 **D12**（agent_id 可配置旋钮，缺省 `'coopanion'`）——登记为新增范围授权非纠正轮；architecture.md §1.4/§2e 按实现口径修正并新增 agentId 行；S4 外部缺陷登记（短期约束生效）；S6 分流 T4；T4 场景 B 经 D12 解锁。
- v0.9（2026-10-26）：T3 D12 轮闭环并亲验（105/105、旋钮逐字落地、botName 零残留、门禁 0 findings；真机全链路：重启→挂载→nmem_save→Mem 端核验 source/agent_id→无残留清理）；R1 接受无阻塞、R2 无保留+终态确认；**S5 写路径解锁**；T1–T3 全部闭环，T4 开放启动。
- v0.10（2026-10-26）：T4 第 0 轮闭环并亲验（四命令含 live 契约 5/5、门禁 13 files 0 findings；场景 A–D 真机全过、E 未执行按 D9）；缺口 6/9、index.ts 覆盖、F2 闭环；R1/R2 接受；按 T4-D6 建议代为两笔提交（`192e9cb`/`9965b75`）；**实施阶段全部完成**，待用户启动整体验收。
- v0.11（2026-10-26）：整体验收三方意见收齐并逐份核实（tester 业务闭环成立+自采真机证据；reviewer 需修改 B1/C1+N1–N3；architecture 接受无阻塞+W1–W10）；W1–W10 与 N3 两处冲突已汇入 architecture.md；S4 约束措辞收窄；B1/C1 处置意见登记（推荐文档层小修，须用户增授权）；**待用户裁定收尾方式**。
- v0.12（2026-10-26）：用户选方案 A——授权验收收口修正轮（B1/C1/N1 文档层四点范围，归 T4，reviewer 定点复核撤阻后出最终结论）。
- v1.0（2026-10-26）：验收收口轮闭环（`c954695` 恰两文件 5 处、reviewer 撤阻 B1/C1、N1 确认，准入终态接受；四命令全绿亲验）；三方验收意见全部通过；**最终验收结论：通过**；残余清单与后续可选项归档；需求流程结束。
- v1.1（2026-10-26）：后续需求 F1（见 §11）——AGENTS/README 英文化、README.cn.md 互链、rebase 到远端 LICENSE 提交并推送。

## 11. 后续需求 F1：文档英文化与远端发布（2026-10-26，用户直接指令，orchestrator 执行）

范围：①AGENTS.md 与 README.md 改为英文（语义不变，含验收收口后的全部修正措辞）；②原中文 README 移至 README.cn.md，两侧互链；③本地 rebase 到远端 `https://github.com/Tomahawkd/coopanion-nmem` 的 LICENSE（MIT）初始提交 `f717d5c` 之上；④推送 origin main。提交：`c15f50a`（AGENTS 英文）、`44bae7d`（README 重构）。开发过程档案（docs/dev/coopanion-mem-plugin/，中文）作为工程记录保留入库。
