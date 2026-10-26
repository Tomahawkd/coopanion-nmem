# ACCEPT-REVIEWER：代码与交付终态独立审查

**需要修改。独立 reviewer 准入意见：当前不接受。** 四项必需验证全部通过；发现一项已复现的交付安全说明缺陷 B1，以及一项需要负责人裁定的秘密来源契约冲突 C1。其余已知缺口按非阻塞或观察登记，不据此否定已验证的本地读写功能。全局纠正预算已尽，本轮仅登记，未实施修正；本意见不替代 architecture 意见或整体最终验收。

任务范围：用户指派的七项整体验收清单。审查日期：2026-10-26。依据：AGENTS.md、共享 engineering-standards.md、main.md v0.10 的 D1–D12、architecture.md、README、T1–T4 worklog，尤其 T2 §8.4 和 T4 §7。

## 1. 被审状态与证据边界

- 冻结代码基准：`511f879af18db8e14d3c05f613109e32285f9a97`。
- 初次读取 HEAD 为上述提交，工作区曾显示 main.md 修改。审查期间 HEAD 前移为 `86d180b87b1530ebb5b1e7af6f1c3008a28244b1`；独立 diff 确认只有 main.md §7 的“整体验收开始”登记变化，D1–D12 未改。生产代码、测试、README、describe、包文件和门禁策略均与冻结基准相同，四命令结果适用于该冻结代码。
- 亲自核查：全部生产 TS、全部测试及 fake host、提示词、manifest/配置、自描述一致性、指定提交链、四命令、覆盖 JSON、两项有界合成探针，以及所引历史证据的内容与当前文件关系。
- 复用证据：T1 sideload、T3 D12、T4 live 契约与 A–D 历史执行记录。读取历史 journal 的指定验收时间窗核对 A 和恢复路径，不把他人执行写成亲自重做。未重启应用、未安装扩展、未调用真实 Mem 写接口、未运行 live 契约套件或远程场景 E。
- 唯一手工仓库交付为本报告；测试产生正常覆盖产物。未修改源码、测试、配置、主文档或门禁，未 commit/merge/push/deploy，未委派或联系其他角色。

## 2. 阻塞发现与依据冲突

### B1 · P2 · README 的目的地址安全保证不成立

**责任范围：T4 交付说明；若决定限制传输行为，涉及 T2 客户端并需 architecture 核对。**

- 位置：`README.md:80` 声称“只向配置的 baseUrl 发起请求，不向其他地址外联”；`src/mem/client.ts:84` 的真实 fetch 适配器没有设置重定向策略或检查跳转目的地。
- 触发：配置端点返回指向另一 origin 的 HTTP 307。此条件由响应直接触发，无需模型绕过工具参数校验。
- 预期：安全说明所承诺的地址范围能约束实际请求，或交付说明明确披露实际边界。实际：Node fetch 跟随跳转，对第二个 origin 发送 POST 和完整保存正文，客户端正常返回 created。
- **亲自复现**：Node v26.12.1，直接导入冻结代码 `MemClient`，未注入 transport；两个 `127.0.0.1` 临时随机端口 HTTP 服务，A 返回 `307 Location: http://127.0.0.1:<B>/redirected`，B 返回合法 save 响应。调用 `saveMemory({content:'review-only synthetic data'})`。只使用合成正文和假 key，两个服务在 finally 中关闭，未生成文件或访问真实 Mem。

```text
resultAction: created
redirectedToDifferentOrigin: true
received.method: POST
received.body: {"content":"review-only synthetic data"}
received.hasAuthorization: false
```

- 影响与边界：保存正文能被自动发往配置地址之外，现有文字不能作为外联范围保证。**本探针没有跨 origin 转发 Authorization，也没有证明真实 Mem 发生过重定向或真实数据泄露。** 这是已证实的安全说明错误，不是推定密钥外泄。
- 最小处置：负责人明确是否保留地址限制承诺。若维持当前传输契约，修正 README，披露首个请求取自 baseUrl、后续可能跟随服务端重定向及转发正文；若要兑现现有保证，则约束跳转并验证跨 origin/保存请求行为。后者属于传输政策决策，reviewer 不擅自选择或实施。当前阻塞的是未兑现的交付安全承诺。

### C1 · 阻塞该项准入 · “仅部署 .env”与指定框架接缝冲突

**责任范围：orchestrator 协调 architecture 裁定；涉及 T1/T3 配置接入、T4 秘密说明。此项是依据冲突，不直接归责实现方擅自新增来源。**

- 依据：AGENTS.md 第 8 条、README 秘密节要求秘密只经部署 `.env`；architecture.md §2e 明确否决把 `NMEM_API_KEY` 环境变量作为隐式默认，同时 §1.2/§2e 指定组合根调用 `ctx.secret()`。
- 事实链：`src/definition.ts:15` → Cortico `world.ts:497` 的 `loaded.secret(name)` → `deploy.ts:161` 的 `secretReader(resolve(dir,'.env'))` → **Cortico 0.2.7 `src/core/secrets.ts:10`**。`secretReader` 先返回非空 `process.env[name]`，只有无值时才读部署文件。
- **亲自复现**：独立进程设置合成 `NMEM_API_KEY=nmem_review_dummy`，调用已安装框架的 `secretReader('/dev/null')('NMEM_API_KEY')`；输出 `inheritedEnvironmentWinsWithEmptyEnvFile: true`。没有读取、打印或修改用户真实密钥。
- 影响：若宿主继承同名环境变量，实际 key 来源并非只有部署文件，而且文件中的轮换值会被优先环境值遮蔽。README“写 .env 后重启即读到新 key”不能无条件成立。
- 最小处置：由负责人裁定是否接受框架的环境优先语义并同步规约/说明，或要求真正限定部署文件来源并安排接入方案审查。不能同时无条件宣称“只经 .env”和现有框架语义成立。本轮停止对此单一来源要求作通过判断，不自行改框架、设计或验收依据。
- 限定：没有发现真实 key 入库、日志或回执泄漏；此项不推翻 X4 固定错误回执的有效性，也不把未执行远程验收本身当作缺陷。

## 3. 七项清单结论

| 检查项 | 结论 | 独立事实与证据 |
| --- | --- | --- |
| 全树类型保真、编码边界 | 通过 | `src/mem/types.ts:75/91/121/140` 在 JSON ingress 检查消费字段后构造具体类型；没有把已知业务对象宽化后还原。JSON.parse/Reflect 的库返回值留在入口内，不传入工具层。`NmemToolArgs` 引用框架实际 handler 入参并在 validators 收窄，不是用宽泛别名保存已知业务模型。 |
| JSON.stringify 批准范围 | 通过 | 全树仅生产 client.ts:122、135 两处；均为 send 第三实参，经 attempt 原样到 fetch.body，无解码回流或内部业务消费者。instance_outputs 精确为 `src/mem/client.ts / MemClient / send / arguments:[2]`。契约测试模板串只为固定 HTTP 探针构造出口体，没有序列化往返；此结论不允许以后把任意内部对象用模板串搬运。 |
| 注释、尺寸与秘密卫生 | 有边界通过 | 无 TS 实现注释、压制注释、cast/非空断言；保留的 JSDoc 是公开契约/字段说明，tsconfig 的注释是配置范围说明。13 文件全量尺寸门禁 0 findings；vitest.config.ts 另行人工检查。跟踪文件扫描无真实 key、`.env` 或 `.snap`；仅名称、占位符、测试假 key。生产路径不记录错误正文，tools.ts:372 统一转固定文案。秘密“仅文件来源”单独受 C1 阻塞。 |
| D1–D12 覆盖 | 见第 4 节 | 本地读写、热改、安装与提示词策略有实现和相应证据；不把远程、GUI 或所有未来版本写成已测。 |
| README 准确性 | **不通过 B1；C1 待裁** | 三步安装、四旋钮、agentId 声明不被框架校验、.env 路径、远程未实测、`*:14242` 披露、A–D runbook 基本一致。清理保证还有 N1；deep 时延仅信息性信号。 |
| describe / seam / 守护一致性 | 通过 | definition.ts 用 `describeTools(NMEM_TOOL_DECLS)`，nmemTools 用同一声明；world 自描述测试比较三个工具、事件、完整 ENV_PROMPT 与固定 key。T2 §8.4 四方法、响应类型、错误子类、transport 接缝与现状一致。四旋钮集合、cfg.persist 热改 agentId/search 参数、入口同引用测试均在本轮运行通过。 |
| 冻结面完整性 | 通过 | 对指定区间逐提交日志和终态 diff 核查：package.json、AGENTS.md 无区间内修改；仅 `5a2c940` 给门禁增加 12 行 X2。C4′ 已存在于 496fd20 起点；不能误称在本区间又发生 AGENTS 修订。无检查器禁用、排除、阈值放宽或 baseline 更新。 |
| 残余清单与四命令 | 有限定通过 | 第 5、6 节记录 S1–S6/O1/S4 与全部亲跑结果。默认 skip 是明确离线门控，不是假 live 通过。残余清单尚需加入本轮 B1/C1 和文档遗漏 N3。 |

类型审查补充：`Validated<T>` 与 `readBody<T>` 保持输入/输出关系；没有用泛型擦除具体 payload 后再断言。`NmemConfigGroup` 的扩展用于携带框架尚未声明的 pattern，结构兼容且无断言；其字符串键配置表是实际框架声明面，不是业务数据兜底容器。工具错误统一收口，不透传 client 的 excerpt/message；client 内部错误仍可能保留上游原文，不能把这一点描述为 client 自身已脱敏。

## 4. D1–D12 → 实现与证据

| 决定 | 实现/交付位置与行为 | 证据及边界 |
| --- | --- | --- |
| D1 文档位置 | `docs/dev/coopanion-mem-plugin/` 主文档、方案、任务、验收目录 | 当前树直接核查；本报告位于指定位置。 |
| D2 双向读写 | definition.ts → world.ts → tools.ts 三 handler → MemClient search/get/save；写回 id 供后续 get/upsert 消费 | 本轮 tools 51、client 44、world 10 用例；T4 A/B 历史 journal 与 Mem 端结果，B 同 id 更新后真实 nmem_get 读回。 |
| D3 Cortico World/TS | package.json `kind:world/api:6/type:module/main:./src/index.ts`，入口导出 NMEM，ConfigGroup/ENV_PROMPT 对外注册 | 本轮 dryMountWorld 与入口同引用断言；T1 安装记录及 T4 三工具实调。 |
| D4 本地与远程 | 默认 `127.0.0.1:14242`，可配置 baseUrl，apiKey 非空才加 Bearer，共用客户端 | 客户端 URL/请求头/无 key/错 key 单测；本地历史联测。远程实际连接未测；外联承诺受 B1 影响，秘密来源受 C1 影响。 |
| D5 工程门禁 | `.codeharness/code-harness.json` 四条 import 边界、owner、尺寸和 X2；AGENTS 及 tsc strict | 本轮 uv 门禁 13 files/0 findings；typecheck exit 0。未改 codeharness；S4 外部缺陷仍登记。 |
| D6 macOS 本机验收 | 已装发行版 sideload，真实 Coo 调用三工具并消费结果 | 复用 T1 三步记录与 T4 A–D；不是本轮再次安装或 GUI 目视。 |
| D7 本地 sideload | README 三步、既有 link 安装，无市场发布动作 | `/tmp/t1-p3-evidence/03-install.json`、`03c-link-spec.txt`；manifest/files 在冻结区间未变。 |
| D8 无面板、旋钮与秘密 | world.webUi 仅 config/promptDocs；config.ts 恰四旋钮，definition.ts 读 ctx.secret | 四键与无 enabled 旋钮守护通过；部署文件路径机制成立；“仅 .env 来源”因 C1 不作通过判断。 |
| D9 远程只交配置文档 | README 远程节和场景 E 均明确未实测 | 与本轮不运行 E 一致；远程鉴权、TLS、CLI 对照实调仍未验证。 |
| D10 PARTNER.md 并行写 | ENV_PROMPT 明示维护 PARTNER.md，同时另存 Mem；无 outputTap/threads 写路径 | 提示词全文与 describe 一致性通过；这是模型提示策略，不是两存储原子事务或必达写入保证。 |
| D11 MIT | package.json license 和 README License 均为 MIT | 元数据符合用户决定；未进行第三方许可证法律审计或发布市场审查。 |
| D12 agentId | config.ts 缺省 coopanion、pattern、x-hot；tools.ts:241 每次现读 cfg.agentId；无 ctx.botName 溯源 | 本轮 default/override/非法值到 client 后 422/热改用例通过；T3 D12 合成全链真机证据与 T4 B 溯源核验。pattern 当前不由表单/Core执行，README 如实披露。 |

真实链路证据抽查：

- 安装/挂载：T1 `03-install.json`、`03c-link-spec.txt`、`06e-nmem.started.json`、`06h-delivery-consumption.txt` 证明 link→激活→事件投递与消费，属早期骨架状态；当前三工具能力另由 T4 实调证明，未拿早期零工具事件冒充终态。
- A：历史 journal `2026-10-26T18:11:19.525+08:00` search 与 `18:11:19.588` 同 call_id output，含预置 id 与 Pixel；`/tmp/t4-accept-evidence/10-a-journal.txt` 的后续 pet_say 引用 Pixel。
- B：`20-b1-journal.txt`、`20-b2-journal.txt`，id `c8b18918-6d23-49c4-b92d-e2ebb1131abb` created→同 id updated→nmem_get 全文回读；`20-b1-memside.json` 核验 source/agent_id/source_app，`20-b2-labelids.txt` 与 `20-b2-labels.txt` 核验 coopanion 标签。`20-b2-memside-final.json` 是含其他无关命中的搜索结果，只能说明目标更新条命中，不能据此证明全库不存在任何重复；O1 风险未因此关闭。
- C：`30-c1-journal.txt` 有两次固定不可达文案及用户告知；恢复历史 call 与 `30-c2-journal.txt`、后续 D 恢复记录互证。journal 不存 ToolOutcome.failed 布尔，该位由当前单测直接断言，不冒充现场布尔取证。
- D：`40-d2-journal.txt` 无显式 limit 时恰两条；`40-d3-journal.txt` 时延 2.027s 与分数变化是 deep 间接信号，具体 cfg→mode 传递由本轮单测验证；`40-d5-badurl-journal.txt`、`40-d7-recovered-journal.txt` 核验错址重启失败及恢复。

## 5. 非阻塞问题、残余与未验证边界

### N1 · 非阻塞 · 自动清理说明过满（T4 S1 已登记）

`tests/contract.nmem.test.ts:273` 写入后，只有断言都通过才执行 :282 删除；没有 finally。README:131 “运行结束即删除”对断言中断不成立。固定 id 限制累计数量，但不能保证本次或下一次失败运行已清理。最小修正是限定文案为成功路径清理；如要求失败也清理，再由负责人安排有验证的清理生命周期。当前仅影响显式 opt-in 的固定测试探针，不阻塞本地生产读写准入。

### N2 · 非阻塞验证缺口 · 契约成功形态可空转、与生产解析不完全一致（T4 S1）

`tests/contract.nmem.test.ts:245` 检索前未预置必命中的记录，:249 循环可零次执行；:129 把缺失 memory 当 null，生产 `types.ts:98` 仅允许显式 null，缺失会失败。契约测试也不校验生产消费的 title。最小补强为受控非空命中、明确 null/缺失差别及消费字段契约。当前 T4-P2 live 原始日志显示 **1 条 fast 命中**，A/B 另有真实非空消费，生产离线负例会拒绝缺字段/错误 title，因此这不是整个产品“只靠空成功”的阻塞缺口；仍不能宣称该契约套件单独充分证明生产 ingress。

### N3 · 非阻塞文档收口 · 残余表没有穷尽已知差异

- T4 S5 登记的 architecture §3.2/§7-6/§7-9 陈旧措辞尚在；§4.2 门禁草案仍未列 coverage，但实际 AGENTS 和脚本已列齐。
- 另有 architecture §2f“其他 4xx 回执含响应摘要”与最新 main.md X4/T3 固定回执要求冲突。实际 tools.ts 选择固定状态码文案，符合较新的明确 X4 要求；不应为了旧表格重新泄露原文。由负责人收口文档，reviewer 不改验收依据。
- S4 的主文档短期约束只提“导入 const 取成员调用”。T3 §10.2 还登记 `Omit<ConfigGroup,…>` 加索引访问的崩溃形态，原始 `07b-omit-variant-gate-crash.txt` 确有 Semantic preparation failed。现约束不能表述为涵盖所有触发形态；T4 两个新增测试遵守当前约束，现树门禁成功不等于外部工具已修复。

| 残余 | 当前独立判断 |
| --- | --- |
| T4 S1 | N1/N2 成立；默认五 skip 与本机无 key→200 的范围如实。不能把默认测试成功写为联网通过。 |
| T4 S2 | 远程 E、手工 .env 实际部署读回、CLI 对照没有本轮 live 证据；依 D9 保留。另增 C1：机制检查已发现来源优先级冲突，不能继续仅称“未验证”。 |
| T4 S3 | GUI 四旋钮/pattern 未目视，API 级历史证据与当前声明/单测成立，维持可选边界。 |
| T4 S4 | 外部 UnicodeDecodeError 登记有效：读取 `05-gate-crash-minimal.txt` 与 ASCII 对照 `05b-gate-control-ascii.txt`；本轮未重建该合成工程。13 文件门禁亲跑成功，未改工具或规避审查范围。N3 补充遗漏形态。 |
| T4 S5 | 文档收口仍未全部完成，N3 逐项指出；不把陈旧“待验证”文字当作已完成测试不存在。 |
| T4 S6 | shell seed 400、pet_say 通道、Coo 自写工作区记录、Core 重启为历史过程事实；阅读已交付记录支持相应范围，不重新操作环境或删除历史数据。 |
| T2 O1 | 继续按已接受风险登记：无 id save 在 429 或 502/503/504 重放窗口可能重复落库，500 本身不重试；client.ts:145 对方法不区分。既有一致性测试只证明重放请求相同，不证明服务端首次已提交后的幂等。没有本轮重复落库实测，不宣称本地无风险。 |

其他观察：T4 “不可达端口 :9”原始日志的 cause 是 fetch 的 `bad port`，可证明开启门控后传输失败会 fail、不静默 skip，不能作为 TCP 连接拒绝的专门证据。真正断连由 C 的历史事件和 client 传输/超时单测另行支撑。历史源码/文件版本对照中，契约测试与入口测试 SHA-256 与 T4-P2 记录相同；README 哈希不同，对照其后在同轮完成的文案修正及冻结 README 进行本次直接审查，没有盲用旧 README 结论。

## 6. 四命令亲跑与覆盖检视

运行环境：Node `v26.12.1`，pnpm `11.28.6`，TypeScript `5.9.3`，Vitest/coverage-v8 `2.1.9`，Cortico `0.2.7`，uv `0.13.5`。没有安装或升级项目依赖。

| 命令 | 本轮结果 |
| --- | --- |
| `npx -y pnpm@11.28.6 typecheck` | exit 0，实际执行 `tsc --noEmit`。 |
| `npx -y pnpm@11.28.6 test` | exit 0；106 passed、5 skipped，共 111；tools 51、client 44、world 10、entry 1。 |
| `npx -y pnpm@11.28.6 test:coverage` | exit 0；同 106+5skip；语句 683/691 = 98.84%，分支 290/291 = 99.65%，函数 61/62 = 98.38%。 |
| 在 `../codeharness` 运行 `UV_CACHE_DIR=/tmp/accept-reviewer-uv-cache uv run --no-sync code-harness --root /Users/tomahawkd/Documents/projects/coopanion-nmem --all` | exit 0；Diagnostic scope full_files；13 files；0 findings。 |

环境异常保留：最初两条 sandbox npx 命令因 npm registry DNS `ENOTFOUND` 未进入项目脚本，offline 尝试为 `ENOTCACHED`；获自动批准后用同版本原命令重跑成功。uv 原命令因默认缓存目录临时锁文件权限失败（exit 2），仅更换临时缓存目录后成功。没有降低规则、换依赖、删测试或刷新基线。NO_COLOR/FORCE_COLOR 告警不影响退出状态。

覆盖缺口从本轮 `coverage/coverage-final.json` 逐项读取：

- config/definition/index/tools/world/types 均无未覆盖语句或零命中分支。
- client.ts:85–92 的默认 fetchTransport 没有被离线套件执行，1 个函数未覆盖；契约套件 plain fetch 不 import 产品源码，不能填补这一测量缺口。T3/T4 历史真机接线和本轮 B1 默认 transport 探针提供行为佐证，均未计入上述覆盖数字。
- 另有 branch id 25，位置 client.ts:171、column 4–6，count `[0]`。这是 V8 在 finally 邻接闭括号的映射，不能漏报，也不能仅凭此定位断言存在未执行的业务条件。成功、传输异常、Abort 超时与退避超限都在当前测试中执行；未另行证明该映射的成因，保留为测量边界。
- 未重做变异测试。本轮复用的工作日志已登记历史变异，本报告以亲跑覆盖测量和实际行为断言作为主要验证证据，未用历史变异替代覆盖。

默认契约 skip 的口径可接受：五个用例只在变量未设置时 skip，网络/协议/断言失败不会转成 skip。本轮输出显式五 skipped，未冒充五 passed；live 5/5 仅复用 `/tmp/t4-p2-evidence/06-contract-live.txt`，包含数据端点 401/200、非空 fast 命中、created/readback/cleanup 与中文 agent_id 422。D9 未要求本轮追加 live。

## 7. 交接结论

B1 是亲自复现的安全说明缺陷；C1 是指定接入方式与单一秘密来源要求之间的实证冲突。这两项未关闭前，本 reviewer 不给当前交付准入。N1–N3 和其余观察不单独阻塞，既有本地功能与四命令通过证据仍有效。

请当前负责人接收问题并按现有预算约束登记/提请裁定；本轮未分配修正预算、未发起纠正会话，也未宣布组内或整体业务需求完成。
