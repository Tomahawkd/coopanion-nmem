# T1 组内任务文档 / Worklog：仓库脚手架与工程门禁

- 任务标识：`T1-scaffold`｜主文档：`docs/dev/coopanion-mem-plugin/main.md` **v0.3**（D1–D11）
- 简报：`tasks/T1.md`｜方案：`architecture.md` §1.2–§1.3、§2e、§4、§7（缺口 2/3/5）
- 全局轮次：**第 0 轮（初始实施）**；全局纠正剩余额度 2（共享，本组无独立额度）
- 本文档：T1 planner 维护；不构成新的需求或架构权威。实施结束后标记「实施已结束、待主文档汇入」。

## 1. 目标与边界（引用）

- 目标：可安装、可挂载的最小 Cortico World 包 `cortico-world-nmem`（`kind: world`、`api: 6`、`type: module`、零运行时依赖、MIT）+ 工程门禁可运行；`../codeharness` 完成 `uv sync`（D5① 授权）；关闭缺口 2/3/5。
- 非目标：Mem 网络调用与工具实现（T2/T3）、ENV_PROMPT 全文（T3）、契约测试与 README（T4）、市场材料、WebUI 面板。
- 限制：不自动回滚/删除既有改动；`../codeharness` 只环境同步与只读运行；`/tmp/coopanion-ref` 只读；秘密不入库。

## 2. 初始核查事实（planner，2026-10-26）

| 项 | 事实 |
| --- | --- |
| 仓库现状 | 仅 `docs/`（T1–T4 简报、architecture.md、main.md、两份探索报告）；无 git、无 package.json、无 src |
| 本会话 | 机器 `e943be61`（Tomahawkds-MacBook-Pro.local）；项目 `coopanion-nmem`（非 git、shared）；planner 独立主会话 |
| `../codeharness` | git 干净，HEAD `bd9ca28`；存在空 `.venv/`（设计期副作用，保留）；`pyproject.toml` 默认 index=清华镜像；README 指引 `uv sync --locked --group dev` |
| 本机工具链 | node v26.12.1（homebrew）、npm 11.20.0、uv 0.13.5（homebrew，README 钉 uv==0.8.22，兼容性待实测）；**无 pnpm、无 corepack**（Coopanion 自带 pnpm shim 仅在应用注入环境可用）→ 本组用 `npx -y pnpm@11.28.6`（对齐模板 `packageManager`），不改全局环境 |
| 模板参照 | `/tmp/coopanion-ref/vendor/cortico/templates/extension/world/`（只读）：package.json（devDeps：@types/node ^22.10.0 / cortico ^0.2.7 / tsx ^4.19.2 / typescript ^5.7.2 / vitest ^2.1.8；`packageManager pnpm@11.28.6`；files 白名单）、tsconfig、vitest.config（`pool:'forks'`、`CORTICO_LANGUAGE=zh`）、`pnpm-workspace.yaml`（`allowBuilds: esbuild: true`）、tests（FakeHost + `dryMountWorld`/`fakeWorldContext` 自 `cortico/extensions/dry-mount.ts` 导入）、describe.json（含 `prompts` 段） |
| 缺口 2 前置事实 | `check:extension`/`describe:extension` 是 **cortico 仓库内** pnpm scripts（`tsx scripts/extension-check.ts`，仓库 package.json:27-28）；npm 发布包是否附带待安装后实测 |
| sideload 前置事实 | 三步 = Extensions 页 local 安装（`POST /api/extensions/install {path}`，pnpm link）→ Restart process（`POST /api/run/restart`）→ World 总览启用；需 Coopanion 运行中；GUI/API 可达性待实测 |

| 65865 等 | Coopanion 运行中：主进程 65850，Core 子进程 65865，监听 `127.0.0.1:17789`、`127.0.0.1:7797`（Extensions/`/api/run/restart` 等经其 Web server；鉴权方式未知，P3 时探测） |

## 3. 组内计划与任务映射

| # | 任务 | 角色/会话 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| P1 | 初始实现：脚手架 + World 骨架 + 门禁文件 + pnpm 安装 + uv sync + 三命令 + 缺口 2/3 实测 | coder | **完成** | 单会话承载；回执见 §6；planner 已复跑三命令确认可复现 |
| T1-P2 | 独立验证：重跑门禁、核对测试骨架覆盖简报验收项、sideload 可达性探测 | tester | **执行中** | 只读+运行测试；不改产品代码；含 Coopanion API 只读探测（端口/鉴权） |
| P3 | sideload 三步 + 缺口 5 实测（nmem.started 事件、旋钮呈现）——**用户已授权 agent 经 API 驱动**（T1-D4），会重启 Coopanion Core | tester（新会话） | 待 P2 探测结果 | API install → restart → enable；事件证据取自日志/事件流 API |
| P4 | 联合准入：reviewer + architecture 同一代码状态审查 | reviewer、architecture | 待 P2/P3 | 两方独立结论 |
| P5 | 组级验收 + worklog 交付 | planner | — | 停止边界 |

会话映射（operation → session）：见 §6 登记表。

角色 ID 备忘（本机 e943be61，机器过滤后实测）：coder `82d753f3-1179-4d8b-bd7c-7c74039241e3`；tester `c847b69d-3897-4c2f-a5b2-eb26bf685bb4`；reviewer `107c334d-8b3f-461f-a85b-042f3d1df08f`；architecture `3440ee5c-5603-4238-96cb-147a0310fc0a`；explorer `fdeb6627-f126-4b84-87c8-67c7c99f296d`。（注意：未过滤列表显示的 coder id 与机器过滤后不同，以过滤后为准。）

## 4. 对执行角色的关键输入（摘录，非全量转发）

- 模板路径（只读参照）：`/tmp/coopanion-ref/vendor/cortico/templates/extension/world/`；契约文档：同目录 `../../docs/worlds.md`、`docs/extensions.md`。
- 配置段（§2e）：`worlds.nmem.{enabled:false, baseUrl:'http://127.0.0.1:14242', searchLimit:5, searchMode:'fast'}`；`x-hot`：baseUrl=false、searchLimit=true、searchMode=true（enabled 由 World 总览开关，不作旋钮）。
- 门禁：`.codeharness/code-harness.json` 按 §4.1 草案；注意 owner 含尚不存在的 `src/mem/*`、`src/tools.ts`（T2/T3 合入前不得再改门禁文件）——若 codeharness 对无文件 owner 报错，实测记录并回报，不擅自改策略语义。
- 三命令：`pnpm typecheck`、`pnpm test`、`cd ../codeharness && uv run --no-sync code-harness --root <本仓库绝对路径> --all`。
- 缺口 2：装完依赖后检查 `node_modules/cortico/package.json` 是否带 `check:extension`/`describe:extension` scripts 并实测运行；不可用→以 describe 一致性单测替代并在 worklog 记录结论。
- 缺口 3：实测 `third_party_modules:["cortico"]` 是否覆盖 `cortico/world.ts` 形导入；不覆盖则精确列举（如加 `"cortico/*"`），记录实测依据。

## 5. 决定记录

| # | 决定 | 依据 |
| --- | --- | --- |
| T1-D1 | pnpm 一律经 `npx -y pnpm@11.28.6` 调用，不做全局安装 | 本机无 pnpm/corepack；对齐模板 `packageManager`；最小环境侵入 |
| T1-D2 | uv 先用本机 0.13.5 尝试 `sync --locked`；lock 不兼容再按 codeharness README 清华镜像装 uv==0.8.22 | D5① 授权动作按其 README 指引；先试已有环境避免重复安装 |
| T1-D3 | 仓库尚无 git：本组不擅自 `git init`（项目布局决定），登记为遗留问题交 orchestrator | 流程规约「不擅自改造项目布局」 |
| T1-D4 | sideload 三步由 agent 经本机 API 驱动执行（用户 2026-10-26 授权；会重启运行中的 Coopanion Core，用户知悉）；缺口 5 旋钮呈现优先 API 证据，目视确认如需仍由用户补充 | 用户问卷裁定；简报 P3 |

## 6. 会话登记与验收记录

| 任务 | 角色 | operation | session | 状态 |
| --- | --- | --- | --- | --- |
| T1-P1 初始实现 | coder | `T1-P1-CODER-IMPL` | `ee4923bf-6b3d-484d-afc9-79e796474d80` | **完成**（13:50 回执；三命令绿；缺口 2/3 结论见 §6.1；planner 13:52 复跑复现） |

### 6.1 P1 结果摘要（证据：coder 回执 + planner 复跑）

- **三命令**：`pnpm typecheck` exit 0；`pnpm test` 6/6 通过；`code-harness --root <本仓库> --all` → `Architecture all: 6 files; 0 findings` exit 0（planner 逐条复跑一致）。
- **uv sync（D5①）**：本机 uv 0.13.5 直接 `uv sync --locked --group dev` 成功，未需改装 0.8.22；`../codeharness` git 保持干净；`.venv/` 已填充；code-harness 版本 `1.0.1.dev6+gbd9ca28e6`。
- **缺口 2 结论**：npm 发布包 cortico **不含** `check:extension`/`describe:extension` scripts（`scripts: undefined`，exports 仅 `./package.json` 与 `./* → ./src/*`），两个命令对第三方不可用。替代：经 `cortico/extensions/describe-export.ts` 的 `exportDescribe`/`checkDescribe` 实测 —— `describe matches generated: true`，check 结果 `ok` 三项、无 failures/warnings；describe 一致性已由单测长期守护。`cortico/extensions/dry-mount.ts` 测试导入可用（exports 映射有效）。
- **缺口 3 结论**：`third_party_modules` 按**精确 specifier** 匹配：`["cortico"]` 与 `["cortico/*"]` 均不匹配路径形导入（0 findings，条目惰性）；精确列举可匹配但产生 6 条 `type.boundary` 误报（门禁不做类型推断，把已类型化的框架函数结果判为未收窄）；`vitest` 列入则产生 22 条 `expect()` 链误报。**最终策略**：保留 `["cortico"]`（惰性条目）、移除 `vitest`——偏离 §4.1 草案，属简报授权的缺口 3 实测校正；待 architecture 联合准入复核。
- **偏离清单（coder 声明）**：① `third_party_modules` 去掉 `vitest`（上还）；② `tests/helpers/fake-host.ts` 未逐字拷贝模板（模板 `as unknown as` 断言触发 12 条 findings，改为具体类型 `EventStoreReader`/`ModelFacts`/`Logger` 实现 + 最小可用行为）——满足 AGENTS 第 6 条禁断言；③ FakeHost 因此多了行为测试（不影响生产代码）。
- **npm pack**：识别 7 文件（describe.json/package.json/src/*），README 缺失被静默略过（无告警）。

| T1-P3 独立验证 | tester | `T1-P2-TESTER-VERIFY` | `6f7681d2-c9a5-4ce9-827d-318da554174c` | **完成**（13:56 回执；证据 `/tmp/t1-p2-evidence/`） |
| T1-P3 sideload 执行 | tester | `T1-P3-TESTER-SIDELOAD` | `869815f8-0980-4ad7-8718-ebe2f97cff22` | **完成**（14:06 回执；三步全链路通过；证据 `/tmp/t1-p3-evidence/`） |
| T1-R1 联合准入（实现审查） | reviewer | `T1-R1-REVIEWER-ADMIT` | `4d9f54ed-c0bf-4cc2-b7d3-c09b98b300c8` | **完成**（14:12 回执：**拒绝，需修改**；两项阻塞，见 §6.4） |
| T1-R2 联合准入（架构审查） | architecture | `T1-R2-ARCH-ADMIT` | `a1dc6474-4a51-4516-b353-7f5d55b62208` | **完成**（14:15 回执：**有条件接受**；条件 C1/C2，见 §6.5；探针证据 `/tmp/t1-r2-probe*`） |

| T1-R1×交叉核对（修复范围） | reviewer | `T1-R1-XCHECK-SCOPE`（chat→4d9f54ed） | `4d9f54ed-c0bf-4cc2-b7d3-c09b98b300c8` | **完成**（14:17：阻塞 1 范围仅 definition.ts:9/11；阻塞 2 关闭需其定点确认，两路径=补测/豁免裁定） |
| T1-R2×交叉核对（覆盖门适用性） | architecture | `T1-R2-XCHECK-COVERAGE`（chat→a1dc6474） | `a1dc6474-4a51-4516-b353-7f5d55b62208` | **完成**（14:20：覆盖门约束 T1；结论更新为「需修改后接受」，新增 C3/C4） |

### 6.5 T1-R2 结论（architecture，有条件接受）

- **总评**：无阻塞缺陷；三命令亲测全绿；两项策略偏离均追认且依据成立（两类误报独立复现：精确列举→`type.boundary` 误报、vitest→恰 22 条 expect 链误报）。**L2 兜底亲验**：探针实测 `src/mem/*` 导入 cortico 会被 `architecture.import` 边界命中；附带利好：未声明 owner 的新 src 文件会被 `architecture.owner` 捕获。
- **条件 C1（F1 处置，建议 B）**：从 ConfigGroup schema 移除 `worlds.nmem.enabled`（interface/defaults 保留）；冲突根源认定为 §2e 表意含混（architecture 自认方案瑕疵），T1 实现无违规；B 需 orchestrator 认可后由 T1 在组内窗口落地（仅改 `config.ts` + 复跑门禁）；若选 A 则登记已知呈现重叠 + T4 补 checkbox↔activation 语义验证。不阻塞 T1 验收。
- **条件 C2**：④ 节修订要点（§4.1 补记 third_party_modules 定稿、§7 缺口 1/2/3/5 关闭措辞、§2e enabled 行补注、遗留表 L1/L2/L3 处置、T2/T3 简报约束「热改键现读 ctx.cfg，禁读磁盘 config.json、禁构造期快照」）随主文档汇入。
- **缺口 1/2/3/5 均同意关闭**（缺口 5 注明 API 级已证、GUI 目视未做按 T1-D4 口径）；config.json 只落盘 enabled 键无架构隐患；L1 建议尽快 `git init`（最好 T2/T3 前，归用户裁定）。
- 亲验：三命令、探针 A–D、`exportDescribe` vs 在库 `describe.json` byte-equal `true`；模板 ConfigGroup 只声明 greeting 键（F1 依据冲突事实确认）。

### 6.6 交叉核对结果

- **R1（修复范围，已完成）**：阻塞 1 必须移除集合仅 `src/definition.ts:9/:11` 两处行内实现注释，不扩大为全部 `//` 或 `/** */`（world/config/fake-host 的文档注释按公开契约/字段语义/行为约束说明处理，不违规）；阻塞 2 关闭条件 = 补交语句/分支覆盖报告+未覆盖行/部分分支解释（不新增阈值）**或**用户/orchestrator 豁免裁定+登记，且需 R1 原会话定点确认一次后撤回；R2 复现证据作为补充证据接收；F1 不扩大本轮修复范围。
- **R2（覆盖门适用性，已完成 14:20）**：**约束 T1**（证据义务：测量+缺口检视+记录，无阈值）；分歧根源认定为 §4.2 第 4 条漏列覆盖测量（architecture 认账的门禁设计内部缺口，非用户裁定事项）；最小合规做法落在 **T1 现补**（`@vitest/coverage-v8` + `test:coverage` script + coverage 配置无阈值 + 运行并把语句/分支数字与未覆盖行检视写入 worklog，范围限 `src/**`）；AGENTS 第 4 条/§4.2 同步修订；变异实证是补充证据不替代覆盖测量。对 R1 阻塞 1 无异议（同意删除；两行内容 §1.2/§1.4 已有等价记载，直接删除不需迁移；勿扩大删除声明位 JSDoc）。**R2 结论更新为「需修改后接受」，新增 C3（删注释）与 C4（补覆盖）。**

### 6.4 T1-R1 结论（reviewer，拒绝：需修改）

- **阻塞 1（规约违规）**：`src/definition.ts:9/:11` 行内实现注释违反 AGENTS.md 第 6 条「不写实现注释」（模板自带同款注释不构成本仓库例外授权）；建议迁入架构文档后消除。
- **阻塞 2（验证缺口）**：共享工程标准（`../codeharness/docs/engineering-standards.md`「Semantic review and delivery evidence」节）要求测量语句/分支覆盖、检查未覆盖行与部分分支，且「Coverage is a separate delivery gate」；当前交付未提供覆盖证据（planner 已核实原文，引属实）。处置二选一：补覆盖测量+缺口说明，或提请裁定豁免。
- **追认（非阻塞）**：移除 `vitest`（reviewer 追认，但 `cortico` 惰性限制须汇入主文档且策略仍需 architecture 独立接受）；FakeHost 具体类型实现（追认）。
- **非阻塞分流**：F1 非实现违规→主文档裁定；F2→T4；F4/F5→T3；无 git/任务状态滞后→主文档维护。
- 审查基线：15 文件摘要 `c0daa5c8…`（无 git，两次计算一致）；真机证据抽验与摘要一致；三命令/变异/describe 生成属复用证据。

### 6.3 P3 结果摘要（sideload 三步 + 缺口 5）

- **三步**（均 HTTP 200）：`POST /api/extensions/check`（manifest 解析通过）→ `POST /api/extensions/install`（状态 `pending-restart`，`extensions/package.json` 记录 `link:/Users/tomahawkd/Documents/projects/coopanion-nmem`）→ `POST /api/run/restart`（Core PID 65865→97396）→ `POST /api/worlds/activation`（**立即生效，无需二次重启**）。扩展现为已安装+已启用（planner 已复核 extensions/package.json 与 config.json）。
- **nmem.started 事件**：出现在 **activation**（14:05:29.852），非 restart（restart 时 enabled:false 未挂载无事件——符合设计）。事件落库 `data/runs/r-20261026-140520-bcf2/events.jsonl`（cursor 35，origin internal，source nmem）；**下游消费已证**：同拍 notice（cursor 36）、`lastDeliveredCursor=39≥35`、agent 14:05:33 实际回应。
- **缺口 5 结论**：`GET /api/config` group `world:nmem` 四旋钮完整呈现（enabled=checkbox 无标签 / baseUrl=文本框+需重启 / searchLimit=数字框热改 / searchMode=下拉热改），values 运行时默认已解析。**F1 成立**：schema 含 `worlds.nmem.enabled`，设置页将出现第二个「启用」开关（与总览写同一路径，无双真相源，但呈现口径重叠）。
- **config.json 事实**：仅落盘 `worlds.nmem.enabled=true`，baseUrl/searchLimit/searchMode 未写磁盘（默认值由 schema 在 /api/config values 解析）——Cortico 常规行为，非缺陷，如实记录。
- **日志卫生**：无 nmem 相关 warn/error（仅预期操作日志：`World 已启动: nmem` 等；4 条旧 `投递水位停滞` ERROR 均早于安装，与 nmem 无关）。
- **P3 补充事实**：`/api/auth_status` 实为 `/api/auth/status`；`declared:false` 与 `tools:[]` 符合本阶段 0 工具设计。

### 6.2 P2 结果摘要

- **三命令独立复跑绿**；门禁 json：`{files:6, findings:[], disabled_checkers:[]}`——无检查器被静默禁用、无空审计（6=4 src + 2 tests；ENV_PROMPT.md 不被分析，符合 §4.1 预期）。
- **manifest 硬校验**逐字段 PASS（参照与发行版 manifest.ts 逐字 SAME）。变异实证：`type:commonjs`/`api:7` 拒载；缺 keyword 仅 warning；**口径校正**：`api=5` 是上一版契约 warning 级经过渡层加载，非拒载。`exportDescribe` 生成物与在库 describe.json 逐字节相等；`checkDescribe` `{ok:3, failures:[]}`。
- **测试非空转（副本变异实证）**：M1 describe.json 改字→FAIL；M2 schema 路径越界→dry-mount FAIL；M3 ENV_PROMPT 追加行→FAIL；复原后 6/6 绿。
- **发现（无阻塞缺陷）**：**F1** `worlds.nmem.enabled` 旋钮与 World 总览开关重叠（模板不声明该键；设置页无过滤渲染；真挂载走 `POST /api/worlds/activation` 写同一路径）——依据冲突（简报/§2e vs 模板约定），待 P3 实测 + 联合准入裁；F2 files 含 README.md 但缺失被 npm pack 静默略过（T4 补）；F3 third_party_modules 惰性（L2 关联）；F4 `pushOpts` 未断言（T3 补）；F5 describe 一致性测试不能发现「key 两处同错」（当前 key 正确）。
- **API 探测（只读）**：`127.0.0.1:17789` = Web console server，免鉴权；`GET /api/worlds` 仅 builtin（console/desktop-pet）；安装根 `~/Library/Application Support/Coopanion/extensions`（空 deps）；Core `--import tsx` 启动且装配前注册 `cortico/*` 解析钩子 → TS 入口真机可持续解析。

## 7. 遗留问题 / 超范围记录

| # | 项 | 状态 | 去向 |
| --- | --- | --- | --- |
| L1 | 仓库尚无 git（未 `git init`） | 登记待裁；R2 建议升级为「T2/T3 启动前尽快 init」（门禁 diff 审计、「不自动回滚」纪律、并行界定均依赖版本控制） | 用户带回 orchestrator（T1-D3） |
| L2 | `third_party_modules` 惰性条目：type.boundary 对框架导入无检查力 | **已裁决（T1-R2）**：可接受，类型安全由 `pnpm typecheck`（strict）承担；`src/mem/*` 禁令由 import 边界实测兜底；待 §4.1 补记随主文档汇入后关闭 | 主文档汇入 |
| L3 | 官方 `check:extension` 对第三方不可用（npm 包无 scripts）——长期以 `exportDescribe`/`checkDescribe` + 单测替代 | **已裁决（T1-R2 同意关闭）** | 主文档汇入（architecture.md §7 缺口 2 关闭依据） |
| L4 | AGENTS.md/§4.2 第 4 条「完成前跑」清单漏列覆盖测量（architecture 认账的门禁设计内部缺口） | **已关闭（纠正第 1 轮 C4′）**：第 4 条已加 `pnpm test:coverage` 与变异实证措辞 | — |
| L5 | `vitest.config.ts` 的 `coverage` 块位于顶层，Vitest 实际读取 `test.coverage`——自定义 include/reporter 未生效（本次报告由 `--coverage`+默认配置产生，数字有效且恰好覆盖四个生产源码文件；R1 确认不阻塞） | 登记待修（一行移动至 `test.coverage`）；归 T2 首次使用 test:coverage 时或下轮 | T2 简报已可引用（R1 建议登记） |

## 8. 第 0 轮交接材料（组级未验收，待 orchestrator 分配纠正轮次）

**状态**：初始实施（P1–P3）全部完成且离线/真机验证全绿；联合准入双方收敛为**「需修改后接受」**（R1 由拒绝与 R2 更新后实质一致）。阻塞未关闭，本组未标记组级验收。

**待修事项（建议纳入同一纠正轮，均小且路径已列明）**：

| # | 事项 | 修复路径（双方收敛） | 规模 |
| --- | --- | --- | --- |
| C3 | 删除 `src/definition.ts:9/:11` 两处行内实现注释（违反 AGENTS 第 6 条；内容 §1.2/§1.4 已有等价记载，直接删不需迁移；**勿扩大**到声明位 JSDoc） | 单文件两行删除 + 复跑三命令 | 极小 |
| C4 | 补覆盖证据：devDeps 加 `@vitest/coverage-v8`（同 2.1.x 线）、加 `test:coverage` script（`test` 不动）、`vitest.config.ts` 加 `coverage:{provider:'v8', reporter:['text','json','html'], include:['src/**']}`（**无阈值**），运行并把语句/分支数字+未覆盖行/部分分支逐项检视（如 `stop()` 空实现标 intentional）写入 worklog+证据目录；顺带补「需求/风险→测试映射」一句（M1–M3 可作佐证） | 一个依赖+一段配置+一次运行 | 小 |
| C4′（随 C4） | AGENTS.md 第 4 条同步修订（加 `pnpm test:coverage`；变异实证为补充证据不替代覆盖测量）——R2 裁定即 architecture 审查，属策略修订路径 | 单文件一行级改动 | 极小 |
| C1（决策，非代码） | F1 处置：R2 建议 **B**（从 ConfigGroup schema 移除 `worlds.nmem.enabled`，interface/defaults 保留；仅改 `config.ts`+复跑门禁）；或 A（维持，登记已知呈现重叠+T4 补 checkbox↔activation 语义验证） | 待 orchestrator 裁定后可并入同一纠正轮落地 | 小 |

**随主文档汇入（无需本组动作）**：C2 修订包（R2 ④ 节：§4.1 补记、§7 缺口 1/2/3/5 关闭措辞、§2e enabled 行补注、遗留表 L1–L4 处置、T2/T3 简报约束「热改键现读 ctx.cfg，禁读磁盘 config.json、禁构造期快照」）。

**纠正轮验收口径（双方已定）**：C3/C4 完成后由 R1 原会话定点确认一次后撤回阻塞；R2 条件 C1/C2 落地后视为无保留接受。三命令基线（typecheck 0 / vitest 6/6 / harness 0 findings）须保持绿。

**证据索引**：离线验证 `/tmp/t1-p2-evidence/`（含 manifest 变异探针、门禁 json）；真机 sideload `/tmp/t1-p3-evidence/`（00-INDEX.md 索引，含 nmem.started 事件、缺口 5 旋钮、三步全链路）；R2 探针 `/tmp/t1-r2-probe*`（import 边界命中、两类误报复现）；worklog §6.1–§6.6 全部结论与回执。

**交接边界提醒**：T1 未验收不影响离线/真机可用性事实，但 T2/T3 应在本组纠正轮关闭后启动（依赖门禁文件与 package.json 终态；R2 已确认 T1 在未关闭窗口内修订自身交付不违反冻结约束）。

**本组状态标记：纠正第 1 轮已执行并闭环（2026-10-26 14:41）——联合准入双方通过（R1 无阻塞接受、R2 无保留接受），T1 组级验收完成；实施已结束，待主文档汇入。遗留 L5（vitest coverage 配置位置）与 T3/T4 建议项见 §7。**

## 9. 纠正第 1 轮记录（2026-10-26）

前置核验：主文档 v0.4 §7 纠正预算登记在案（范围与本轮指派一致）；C2 已汇入 architecture.md（§2e enabled 行补注 C1-B 裁定、§4.1 third_party_modules 定稿补记、§7 缺口 3 关闭）。派发前提满足。

| 任务 | 角色 | operation | session | 状态 |
| --- | --- | --- | --- | --- |
| R1FIX 修正包（C3/C4/C4′/C1） | coder | `T1-R1FIX-CODER` | `43803e16-c8eb-47d6-a838-a6f91ddee0c3` | **完成**（14:34 回执；四命令全绿；证据 `/tmp/t1-fix1-evidence/`） |

### 9.1 R1FIX 结果摘要

- **C3**：`definition.ts` 两处行内注释已删（create 现居 :9、describe :10）；**C1**：`config.ts` schema 移除 `worlds.nmem.enabled`（5 行），properties 现以 baseUrl 起始，interface/NMEM_DEFAULTS 未动；**C4**：`@vitest/coverage-v8 ^2.1.8` + `test:coverage` script + coverage 配置（v8、text/json/html、include src/**、无阈值）；**C4′**：AGENTS 第 4 条已加命令与「变异实证不替代覆盖测量」句。planner 14:36 逐项核验 diff 无误。
- **四命令绿**：typecheck 0 / test 6/6 / test:coverage 跑通 / harness 6 files 0 findings。
- **覆盖证据**：语句 89/91=97.8%、分支 9/10=90%、函数 9/10=90%；config/definition/world 全 100%无零命中；唯一未覆盖 `src/index.ts`（0%，纯 re-export 无逻辑）——**判定 intentional（入口再导出面，真机加载已由第 0 轮 sideload 覆盖）**，建议 T4 契约测试补一次入口导入消除 0%；`world.stop()` 已被测试调用无需豁免。需求/风险→测试映射：六用例分别钉干装载（M2 佐证）/默认禁用/挂载事件/无工具空变量/describe 一致性（M1/M3 佐证）/FakeHost 行为。
- **新生成物**：仓库根 `coverage/`（116K 报告产物）——已登记，待 L1 .gitignore 一并处理（node_modules/、coverage/）。无指派外改动；未触 git 与 Coopanion 状态。
| R1VER 独立验证（四命令+API 重启验 C1） | tester | `T1-R1VER-TESTER` | `cf9ce6b6-3ed6-4d81-bd23-78278bfbdfc5` | **完成**（14:37 回执：4/4 通过；证据 `/tmp/t1-r1ver-evidence/`） |

### 9.3 闭环结论

- **R2（architecture，14:40）：无保留接受。** C1（恰三旋钮、interface/defaults 保留、真机链完整、总览唯一启用入口）、C3（两行已删、边界闭合）、C4/C4′（无阈值、测量+缺口检视+记录满足标准、AGENTS 措辞到位）、C2（三处汇入+简报约束）逐项亲核；四命令亲跑全绿。非阻塞遗留已归属：L1（本确认后执行）、index.ts 入口覆盖（T4）、F2（T4）、缺口 5 GUI 目视（用户可选）。交接口径：T2/T3/T4 可启动；package.json 与门禁文件自本轮对后续组冻结（变更走全量审计+architecture 审查）。
- **R1（reviewer，14:40）：无阻塞接受，撒回阻塞 1（C3）与阻塞 2（C4）。** C3 亲自比对确认恰删两行；C4 亲自重算两份覆盖 JSON 均为 89/91、9/10、9/10，接受 index.ts 未覆盖解释与 T4 补测建议；四命令复用 tester 独立验证记录。**保留一项非阻塞配置问题（登记 L5）**：`vitest.config.ts` 的 `coverage` 块位于顶层，安装版 Vitest 实际读取 `test.coverage`——本次有效报告由 `--coverage`+默认配置产生（数字仍有效，报告恰好覆盖四个生产源码文件），但自定义 include/reporter 未生效；修复=一行移动至 `test.coverage`，归后续（T2 或下轮），不恢复阻塞。

### 9.2 R1VER 结果摘要

- **四命令独立复跑绿**（typecheck 0 / test 6/6 0 / test:coverage 0 / harness 6 files 0 findings）。
- **diff 边界闭合**：patch 回放 6/6 逐字节一致；与 14:10 全树基线对比无第 7 个文件被改（tests/、describe.json、.codeharness/ 未变）；C3 恰删 2 行、C1 恰删 schema 5 行且 interface `enabled:boolean`/`NMEM_DEFAULTS.enabled:false` 保留。
- **覆盖数字三方自洽**（text 报告、08-totals.json、本次 json 重算均为 89/91、9/10、9/10）；全仓无 thresholds；`index.ts` 0% 判定与 json 一致。
- **C1 真机闭环**：重启前 4 旋钮（旧代码）→ 重启（PID 97396→5035）→ 重启后 `world:nmem` **恰三旋钮**（baseUrl/searchLimit/searchMode），全 `/api/config` 中 `worlds.nmem.enabled` 零命中；`config.json` 仍 `enabled:true` 且 `/api/worlds` nmem active、`/api/extensions` loaded+enabled → **总览开关仍是唯一启用入口**；新 `nmem.started`（14:36:43.149，cursor 40）落库并被投递消费（lastDeliveredCursor=42）；日志无 nmem 相关 warn/error。
- **非缺陷登记**：① ConfigGroup 旋钮集合无单测守护（建议随 T3 补，非阻塞）；② docs 变更归属：architecture.md/main.md/T2/T3.md 为 orchestrator C2 汇入、T1-worklog.md 为 planner 写入，非 coder 越界；③ Core 日志唯一 nmem WARN 为第 0 轮激活记录（预期）。
| 闭环：R1 撒回阻塞 / R2 无保留接受 | reviewer / architecture | `T1-R1-CLOSE` / `T1-R2-CLOSE`（chat 原会话） | `4d9f54ed…` / `a1dc6474…` | **双方完成**（R1 14:40 无阻塞接受撒回两项阻塞；R2 14:40 无保留接受） |
| L1 git init + 基线提交 | planner 执行（用户授权） | — | — | **完成**（14:41：`git init -b main` + `.gitignore`（node_modules/、coverage/、.DS_Store）+ 基线提交 `1dece2e`，25 文件，提交后工作树干净） |

### 9.4 轮次终态

- **联合准入结论**：reviewer（T1-R1，14:40）**无阻塞接受**，阻塞 1/2 均撒回（保留非阻塞 L5）；architecture（T1-R2，14:40）**无保留接受**。必要验证（四命令，含新增 test:coverage）经 coder/tester/R2 三方独立复跑全绿；阻塞问题全部关闭。**T1 组级验收完成**（组内口径；不替代整体最终验收）。
- **L1 落地**：仓库现以 git 管理（main 分支，基线 `1dece2e` 含全部现有文件与 worklog）；「不刷 baseline/不排除文件/diff 审计」纪律自此有版本控制依托。
- **交接**：T2/T3/T4 可启动（依赖已就绪）；`package.json` 与门禁文件（`.codeharness/code-harness.json`、`AGENTS.md`）对后续组冻结；给 T2 的额外输入：L5 一行修复建议、ConfigGroup 旋钮集合单测守护建议（R1VER 提出，非阻塞）；给 T3：F4（pushOpts 断言）、F5（describe key 固定契约断言）；给 T4：index.ts 入口导入覆盖、F2（README）、缺口 5 GUI 目视（用户可选）。
- **会话总数**：第 0 轮 6 会话（coder/tester×2/reviewer/architecture）+ 纠正第 1 轮 4 会话（coder/tester/R1 闭环/R2 闭环），全部完成，无在执行 operation。
