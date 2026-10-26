# 整体验收·architecture 结论：整体方案符合性与架构终态审查

- 任务标识：`ACCEPT-ARCH`（整体验收；architecture 角色，独立会话）
- 评审基准：git main `511f879`（冻结）。冻结核验：`511f879` 与当前工作树在 `src/ tests/ package.json .codeharness/ AGENTS.md describe.json vitest.config.ts tsconfig.json README.md pnpm-lock.yaml pnpm-workspace.yaml` 上 **零 diff**；基准后仅两处 docs 变动：orchestrator 的验收启动登记（`86d180b`，main.md 一行）与本目录交付文件。本会话未改动评审对象任何文件。
- 输入：architecture.md（方案本体）、main.md v0.10（D1–D12）、T1–T4 四份 worklog、`.codeharness/code-harness.json`、src/ 全树、README.md、describe.json、AGENTS.md；组内 R2 结论仅作输入，本文结论独立得出。
- 全局纠正预算 2/2 已尽：本文所有发现**只登记不修**。

---

## 0. 审查方式与亲自复跑证据

| 命令 | 结果（本会话亲跑，2026-10-26 18:4x） |
| --- | --- |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 106 passed + 5 skipped（契约门控），5 文件全绿 |
| `pnpm test:coverage` | All 98.84 / 99.65 / 98.38 / 98.84；src 五文件 100%，唯一缺口 `src/mem/client.ts:85-92`（缺省 fetchTransport，live 契约覆盖，T2 既定口径）——与 T4 登记（98.84/99.65）一致 |
| `uv run --no-sync code-harness --root <本仓库> --all`（于 `../codeharness`） | **`Architecture all: 13 files; 0 findings`，exit 0** |

其余证据分类：标注「亲验」为本会话直接观察（读码/grep/git/复跑）；标注「复用」为采信 T1–T4 worklog 登记的多方复跑证据（真机场景、sideload、live 契约 5/5 等，均为 tester/R1/R2/planner 多方独立复跑后登记）；标注「未验证」为本会话未复核项。

---

## 1. 分层与边界终态符合（清单 1）——**符合**

| 方案要求（§1.2/§1.4/§2e） | 实现核验（亲验） | 结论 |
| --- | --- | --- |
| 四层：mem 客户端 / world 工具与事件 / 配置与秘密 / ENV_PROMPT 策略 | `src/mem/{client,types}.ts`；`src/{world,tools,definition,index}.ts`；`src/config.ts`；`src/ENV_PROMPT.md`（经 `webUi().promptDocs` 暴露） | ✅ |
| 依赖方向：index→definition→{config, world→tools→mem/client→mem/types}，world→ENV_PROMPT 数据文件 | import 图逐一核对（grep 全量）：`mem/client.ts` 仅 import `./types.ts`；`config.ts` 仅 import `cortico/core/types.ts`（类型）；`tools.ts` import mem 层错误类+类型与 config 类型；`world.ts` import tools/config/框架；组合根 `definition.ts` 是唯一出现具体 `MemClient` 类名的装配点（工具层经 `NmemToolClient` 窄接口，优于方案下限） | ✅ |
| mem 层禁 `cortico/*`（框架无关） | `grep cortico src/mem/` 零命中；门禁 import 边界 1 实测兜底（T1-R2 探针在案，复用） | ✅ |
| 工具层禁网络传输（仅 client 拥有传输） | 门禁边界 2（禁 node:http(s)/undici/axios import）0 finding；`grep fetch src/` 除 `src/mem/client.ts` 外零命中（全局 fetch 仅存在于 client 的 `fetchTransport`）；`JSON.stringify` 在 src 内仅 client 两处出口（均在已批准 `instance_outputs` 声明覆盖位） | ✅ |
| 热改键（searchLimit/searchMode）现读 `ctx.cfg` 活引用，禁构造期快照、禁读磁盘 config.json | `tools.ts` searchHandler/saveHandler 每次调用读 `cfg.searchLimit/cfg.searchMode/cfg.agentId`；`MemClient` 构造仅收 baseUrl/apiKey（非热改项）；world/tools 无任何文件读配置路径 | ✅ |
| D12 agentId 旋钮（缺省 `'coopanion'`、pattern、x-hot、botName 全移除） | `config.ts`：interface+`NMEM_DEFAULTS.agentId='coopanion'`+ConfigGroup 第四旋钮（pattern `^[a-z0-9][a-z0-9_.:-]*$`、`x-hot:true`）；`tools.ts` `agent_id: cfg.agentId` 现读；全 src `grep botName` 零残留；pattern 经 T3-D15 结构化子类型进声明面、无 cast | ✅ |
| envPromptVars() 返回空表、禁 I/O（§2b） | `world.ts` envPromptVars 返回 `{}`；守护用例在案（T3-P2F M7/O1，复用） | ✅ |
| start() 仅投递 `nmem.started`、不探活 | `world.ts` start 实现与方案一致 | ✅ |
| 秘密只经部署 `.env`、key 不进 config.json/日志/回执 | `ctx.secret(NMEM_API_KEY)` 仅在 create()；回执文案常量不含 key；README 安全节在案 | ✅ |
| 零运行时依赖 | package.json 仅 devDependencies；运行用全局 fetch + node:url（builtin） | ✅ |

## 2. 门禁策略与架构一致（清单 2）——**一致**

- **owner 五分区**：`code-harness.json` owners 与 architecture.md §4.1 定稿逐字一致（world composition and entry / mem rest client / world tools and events / config and secrets / verification）；五分区覆盖全部 src+tests 文件（13 files 无 owner 缺失 finding 佐证）。✅（亲验）
- **import 四边界**：mem client framework-agnostic / only the mem client owns network transport / config section owns the configuration surface / runtime does not depend on tests——与 §4.1 一致，0 finding。`third_party_modules: ["cortico"]` 与 T1 定稿补记（不列 vitest）一致。✅（亲验）
- **instance_outputs 声明**：`{path:"src/mem/client.ts", class_name:"MemClient", member:"send", arguments:[2]}` 与批准件逐字一致；当前 `send(method, path, body?)` 第三位即 body、`JSON.stringify` 两处调用形态仍在声明覆盖位（亲验）；**移除条件仍在案**（architecture.md §4.1 定稿补记 + main.md §7 X2 落地登记：「`send` body 语义或 transport 契约出现非出口消费者时复审」+ fail-closed 义务）。✅
- **全量审计**：`--all` 复跑 `13 files; 0 findings, exit 0`（本会话亲跑，与 T4 四方复跑口径一致）。✅
- `../codeharness` 仓库干净、HEAD `bd9ca28` 未动（亲验）——D5「不改 codeharness 本身」成立。

## 3. 用户裁定覆盖 D1–D12（清单 3）——**全部落实，无越界**

| # | 裁定 | 架构视角核验 | 结论 |
| --- | --- | --- | --- |
| D1 | 文档落位 `docs/dev/coopanion-mem-plugin/` | 目录结构如裁定 | ✅ |
| D2 | 双向（读+写），不替换内置记忆 | 三工具读写齐备；ENV_PROMPT 明示并行不替换；无删除/取代工具（非目标未越） | ✅ |
| D3 | Cortico World 包（TS、api 6） | manifest 逐字段与方案 §1.3 一致（亲验） | ✅ |
| D4 | 本地+远程统一抽象 | 单 baseUrl+单 apiKey；有 key 才发头（R2）；远程仅 host/key 差异，无分支代码 | ✅ |
| D5 | codeharness 配置 + 不改 codeharness | §2 见上；codeharness 仓库未动 | ✅ |
| D6 | 本机 sideload 验收 | T1 三步 sideload + T4 场景 A–D 真机全过（复用，多方登记） | ✅ |
| D7 | 本期不发布市场 | 无市场材料（无 CHANGELOG/screenshots/locales）；`cortico.tags: []` 为模板 manifest 字段非发布动作 | ✅ 未越界 |
| D8 | v1 不做面板 | `webUi()` 仅 config+promptDocs（声明面，非 renderer 代码）；无 `storeSecret` 调用；key 走手动 `.env` | ✅ 未越界 |
| D9 | 仅本地验收；远程以配置+文档交付并标注未实测 | README「远程模式（未实测）」整节明示「非实测结论」；场景 E 未执行如实登记 | ✅ 口径如实 |
| D10 | PARTNER.md 并行写（提示词策略） | ENV_PROMPT「PARTNER.md and Nowledge Mem work side by side」+「另存」措辞；无模式旋钮 | ✅ |
| D11 | MIT | package.json license MIT | ✅ |
| D12 | agentId 旋钮（新增范围授权） | 见 §1 末行；缺省/pattern/热改/botName 移除四要点齐 | ✅ |

## 4. 组间契约：T2 §8.4 seam 冻结（清单 4）——**冻结有效，零越改**

- git 证据（亲验）：`src/mem/*` 历史上仅两笔提交——`caf7b2a`（T2 第 0 轮）与 `e79cb19`（T2 纠正轮 C1/C1b）；`git diff 8322e45 HEAD -- src/mem` **为空**。T3 第 0 轮（`0bdbb1b`）、T3-D12（`4bee14f`，改 config/tools/world/definition+两测试，不含 src/mem）、T4（仅 tests/README）均未触碰 seam。
- 签名核对（亲验）：`MemClient` 四方法、构造面、`types.ts` 导出清单、错误子类族、`MEM_TIMEOUT_MS`、transport 缝与 §8.4 快照逐项一致；`tools.ts` 的 `NmemToolClient` 三方法签名取自快照原样。
- **D12 轮对 seam 零影响的声明成立**（上述 git 证据直接支持）。

## 5. 已知限制与风险登记完整性（清单 5）——**如实、无夸大**

| 项 | 登记位置 | 核验结论 |
| --- | --- | --- |
| A6 远程未实测 | main.md §5（D9 关闭）、README 远程节、architecture §6.2-3 | ✅ 三处一致标注「未实测」；T4-S2 进一步登记 `ctx.secret()` 手工 `.env` 实读回路与 CLI 对照命令未 live 验证——诚实保留 |
| O1 无 id 重试重复写 | main.md §7（已接受风险+措辞约束） | ✅ 措辞约束经 grep 核验：全库无「无风险」类宣称；「幂等」表述均限定在**带 id 的服务端 upsert 通道**（R9 实证），与 O1（无 id 路径）边界清晰；「重复落库已实测」无此宣称。README「重复运行不会累积数据」仅指固定 id 契约探针+DELETE 清理，属实 |
| S4 codeharness 外部缺陷 | main.md §7、T3-worklog §7 | ✅ 登记、短期约束、合成工程证据、按 D5 不修、修复建议均在案；本仓库门禁 0 findings 不受影响（本会话复跑佐证）。**登记精度备注（非阻塞）见 §6-F1** |
| R1 安全说明（Mem 绑 `*:14242`） | README 安全说明 | ✅ 实测事实+不夸大建议（防火墙/回环/远程必配 key）；「插件仅向配置 baseUrl 发请求」与实现一致（仅 client 发请求，URL=baseUrl+path） |

## 6. 发现分级（全局预算已尽：只登记）

**阻塞项：无。**

**验证缺口（非缺陷，均为既定登记项，本会话确认仍未闭合且如实登记）**：
- V1 远程链路（场景 E / D9 范围）：未实测，README 已标注（复用确认）。
- V2 GUI 目视四旋钮与 pattern 呈现（S3 可选项）：API 级证据在案，目视未做。
- V3 `ctx.secret()` 手工 `.env` 实读回路未 live 验证（D9 范围，T4-S2 登记）。

**非阻塞登记**：
- **F1（登记，措辞精度）**：S4 短期约束「测试勿对导入 const 直接取成员调用」字面宽于实证触发形态——现存 `tests/world.test.ts` 即含 `NMEM.create(...)`/`NMEM.defaults()`（对导入 const 直接取成员调用）且门禁 13 files 0 findings 不崩溃（本会话亲验）；说明实际触发需更窄条件（T3-D16 的 `Omit<ConfigGroup,…>`+索引访问形态、T3-P1 的特定跨文件绑定场景）。登记的三个操作性事实（缺陷存在、本仓未受影响、新增测试规避新形态）均成立；建议将来 codeharness 修复任务立项时把约束收窄到实证触发形态，避免过度约束测试写法。**不影响验收结论**。
- **F2（登记）**：architecture.md 措辞收口清单（见 §7，即 T4-S5 要求的最终清单）——属文档义务，无代码动作。

## 7. T4 §7 S5：architecture.md 措辞收口最终清单（供 orchestrator 汇入）

逐条「现文 → 应改文」。W1–W7 为必改（T4-S5 三项 + 已登记未补的关闭标记）；W8 为 T3-D12 R2 登记项；W9/W10 可选。

| # | 位置 | 现文 | 应改文 |
| --- | --- | --- | --- |
| W1 | §3.2 末段 | 契约测试不进默认 `pnpm test`（保持离线可跑），由 T4 验收与 CI 可选任务显式开启。 | 契约用例文件随默认 `pnpm test` 一并被发现并执行为显式 skip（不进入默认断言面，保持离线可跑）；设置 `NMEM_CONTRACT_BASE_URL` 即对真实 Mem 执行（T4 落地口径；本仓库无 CI 任务）。 |
| W2 | §3.2 第 3 条 | 固定 id 使重复运行自我覆写、不累积数据（DELETE 端点存在性未验证，不依赖它清理；探针记录永久留存一条并在测试注释外于 README 说明） | 固定 id 使重复运行自我覆写；断言完成后 `DELETE /memories/{id}` 自动清理并复核 404（DELETE 已实证存在，见 §7-6 关闭记录），重复运行不累积数据。live upsert（`action:'updated'`）分支由场景 B 真机证据承载——契约探针每轮用后删除，套件内只会出现 created。 |
| W3 | §7-4 | `JSON.stringify` 在 fetch 请求体出口是否触发 `type.broad` → T2 实测；触发则加 reviewed encoding outputs 声明（策略变更流程）。 | （原句保留，追加）**——已关闭（T2）**：触发形态实测为经 `this.send` 的 body 位；最终机制为已批准的 `instance_outputs` 声明（§4.1 定稿补记，含移除条件与 fail-closed 义务）。 |
| W4 | §7-6 | Mem `DELETE /memories/{id}` 端点存在性未验证 → 契约测试不依赖删除（固定 id 覆写），如后续验证存在可加可选清理。 | （原句保留，追加）**——已关闭（T3/T4）**：T3 smoke 实证 DELETE 200；T4 契约测试已落地断言后 DELETE 清理 + 404 复核。 |
| W5 | §7-7 | deep 模式本机延迟基线未测 → T4 契约测试顺带观测；10s 超时常数如不足在 T2 内调整（保持常数、不加旋钮）。 | （原句保留，追加）**——已关闭（T2 观测 / T4 复测）**：deep 实测 ≈2.14–2.19s（T2）、契约复测 846–1082ms（T4）；10s 超时常数维持不调。 |
| W6 | §7-8 | 远程链路（A6）未验证 → 见 §6.2-3。 | （原句保留，追加）**——已按 D9 关闭**：远程以配置面+文档交付并标注未实测；`ctx.secret()` 手工 `.env` 实读回路与场景 E 留待远程化时补验（T4-S2 登记）。 |
| W7 | §7-9 | 部署 `.env` 的确切路径（…由 C2/C19 推断）→ T1/T4 验收时确认并写入 README。 | （原句保留，追加）**——已关闭（T4）**：rootDir 证据链确认 `~/Library/Application Support/Coopanion/home/companion/.env`，已写入 README。 |
| W8 | §2e agentId 行、§1.4 溯源列 | 仅字母数字与 `_.:-` | 仅含**小写**字母、数字与 `_.:-`（对齐 pattern `^[a-z0-9][a-z0-9_.:-]*$` 及 README / config.ts JSDoc 现行措辞；两处同步） |
| W9（可选） | §1.3 目录树 | tests/ 分支无 entry.test.ts | 补 `entry.test.ts`（T4 新增：入口同引断言，index.ts 覆盖消 0%） |
| W10（可选） | §4.1 代码块 | 标题为「草案」的 json 块（含 `"vitest"`、无 instance_outputs） | 块前补一句：「以下为设计期草案；现行生效文本以仓库 `.codeharness/code-harness.json` 为准（差异：`third_party_modules` 仅 `["cortico"]`、已含 instance_outputs 声明，见定稿补记）」 |

## 8. 独立准入意见（清单 7）

**接受（无阻塞）。**

- 方案→实现逐项符合：四层结构与依赖方向、传输所有权、热改键现读、D12 旋钮、门禁 owner/import/instance_outputs 与批准件一致且全量审计 0 findings（本会话亲跑）。
- D1–D12 全部落实，D7/D8 非目标未越界，D9 未实测口径如实。
- T2 §8.4 seam 冻结全程有效，D12 零影响声明经 git 证据成立。
- 已知限制（A6/O1/S4/R1）登记如实、无夸大；O1 措辞约束经 grep 核验未被违反。
- 遗留仅登记项：V1–V3（既定未验边界）、F1（S4 约束措辞精度，供未来 codeharness 修复任务收窄）、F2（本清单 W1–W10 文档收口，待 orchestrator 汇入）。

本文只作本角色判断；整体交付与后续动作由 orchestrator 汇总裁定。

---

*ACCEPT-ARCH 会话交付，2026-10-26。证据基线：git `511f879`（冻结核验通过）；四命令与门禁为本会话亲跑；真机/sideload/live 契约证据复用 T1–T4 worklog 多方登记。*
