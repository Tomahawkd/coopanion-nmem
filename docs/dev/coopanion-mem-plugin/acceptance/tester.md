# 整体验收·tester 结论：真实业务链路与失败表现独立复验

- 任务标识：`ACCEPT-TESTER`（整体验收；tester 角色，独立会话；不复用组内身份）
- 评审基准：git main `511f879`（冻结）。本会话 HEAD 为 `86d180b`（orchestrator 验收启动登记），`git status` 仅本目录交付文件未跟踪，`src/ tests/ README.md describe.json .codeharness/ AGENTS.md package.json vitest.config.ts tsconfig.json` 零改动；本会话未修改任何生产代码、测试、门禁或文档（本文件除外），未 commit/merge/push/deploy。
- 全局纠正预算 2/2 已尽：本文所有发现**只登记不修**。
- 环境：macOS 本机；Coopanion 0.2.10（`/Applications/Coopanion.app`，运行中，核心 PID 初值 77767 → 终值 87694）；Nowledge Mem 0.10.108（`http://127.0.0.1:14242`，运行中）；Node v26.12.1；`npx -y pnpm@11.28.6`。
- 自采证据目录：`/tmp/accept-tester-evidence/`（`INDEX.md` 索引；下文每项给文件名）。**所有结论均为本会话自采**，未拷贝组级证据。

---

## 0. 复验方法与通道

| 项 | 事实 |
| --- | --- |
| 驱动 Coo 的通道 | 内置 console World 的 WebUI 帧流 `ws://127.0.0.1:17789/ws/providers/world%3Aconsole/panels/chat?language=zh`（协议 `{type:'hello'}` → `{type:'msg'}`；本机未设口令）。驱动脚本 `console-driver.mjs`，帧流原文逐场景落盘。 |
| Coo 行为证据源 | 权威源为本机 journal `home/companion/data/session-main.jsonl`（function_call + function_call_output 全文）与 `data/runs/<run>/toolcalls.jsonl`（含 `failed` 布尔、`durMs`、`receipt`）；`events.jsonl` 辅助。Coo 的回复走 `pet_say`，console 帧只回显操作员消息（与 T4 登记一致）。 |
| Mem 端核对 | `python3 urllib` 直发 REST（`mem.py`）：`POST /memories`、`GET /memories/{id}`、`POST /memories/search`、`DELETE /memories/{id}`。 |
| 配置/进程面 | `GET/POST /api/config`（group `world:nmem`）、`GET /api/extensions`、`GET /api/worlds`、`POST /api/run/restart`、`pgrep -f core/boot.ts`。 |
| 环境变更范围 | Mem 应用 1 次退出 + 1 次复启；Core 3 次重启（错 baseUrl、错 key `.env`、移除 `.env` 复原）；对话 13 轮；Mem 写入仅带 `acceptance`/`accept-tester` 标识的样本与固定探针 id（共 6 条），全部于结束前删除。 |
| 端口事实（环境观察） | `config.json` `web.port=17788`，但 17788 被 Lody 进程占用，Coopanion 实际监听 **17789**（`lsof` 亲验）。所有 Core API 调用均用 17789；与 T4 口径一致。非本插件缺陷。 |

---

## 1. 逐项结果总表

| # | 清单项 | 结论 | 主要证据 |
| --- | --- | --- | --- |
| 1 | 安装态：link 安装、enabled、恰四旋钮、缺省 `agentId='coopanion'` | **通过** | `01a`、`01b`、`01c`、`17a`、`17b` |
| 2 | 场景 A 读召回（预置独特事实 → nmem_search → 引用作答） | **通过** | `03`、`04a`–`04c` |
| 3 | 场景 B 写沉淀（Mem 端 labels/source/agent_id + 同 id upsert） | **通过** | `05a`–`05l` |
| 4 | 场景 C 断连（failed 固定文案、进程不崩、复启恢复） | **通过** | `06a`–`06f`、`07a`–`07d` |
| 5 | 场景 D 热改（searchLimit/searchMode 免重启；baseUrl 需重启；复原） | **通过** | `08a`–`12h`、`13a`–`14f` |
| 6 | 失败表现（错 key 401、content 超长、nmem_get 不存在 id） | **通过** | `02`、`02b`–`02d`、`13i`、`14f` |
| 7 | D10 观察：写 Mem 后 Coo 是否照常维护 PARTNER.md | **观察到未维护（如实记录，非硬门槛）** | `05a*`、`05k*`、`05l`、`05e` |
| 8 | 未验证项标注（远程 A6/D9、GUI 目视 S3） | **未验证**（如实标注） | 见 §9 |
| 附 | 交付门禁四命令（typecheck/test/coverage/harness） | **通过** | `18a`–`18d` |

---

## 2. 清单 1：安装态与配置面 —— 通过

`GET /api/extensions`（`01a`）：

```json
{"name":"cortico-world-nmem","spec":"link:/Users/tomahawkd/Documents/projects/coopanion-nmem",
 "installedVersion":"0.1.0","state":"loaded","enabled":true,"worldId":"nmem","kind":"world","api":6,"webUi":"none"}
```

- link 指向本仓库，`state: loaded`、`enabled: true`；`/api/worlds` 中 `nmem` 为 `active`，三工具 `nmem_search / nmem_get / nmem_save` 在位（`17d`）；当前 Core 的挂载事件 `nmem.started` 在事件流中可查（`01c`，19:03:15）。
- `GET /api/config` 的 `world:nmem` 组**恰四旋钮**：`baseUrl`(x-hot false)、`searchLimit`(1..10, x-hot)、`searchMode`(fast|deep, x-hot)、`agentId`(pattern `^[a-z0-9][a-z0-9_.:-]*$`, x-hot)；无 `enabled` 旋钮（`17a`）。
- `config.json` 的 `worlds.nmem` 无 `agentId` 键，`/api/config` 运行值回落为 `'coopanion'`（`01b`、`17b`）——缺省值语义成立。

## 3. 清单 2：场景 A 读召回 —— 通过

1. 预置独特事实（`03-scenarioA-seed.json`）：`id=coopanion-nmem-accept-tester-a`，title「验收 tester 场景A 潜水电脑」，content 含 `Oceanic Veo 4.0 / 2023 / 蓝色表带`，labels `["coopanion","acceptance","accept-tester"]`，`source=coopanion`、`source_app=cortico-world-nmem`、`agent_id=coopanion`；`POST /memories` 200（`03`），`GET /memories/{id}` 200 读回一致。
2. 提问：「我的潜水电脑是什么型号？如果不确定，请先查一下 Nowledge Mem 再回答。」
3. journal（`04c`）：`18:41:58.980 CALL nmem_search {"query":"潜水电脑 型号 dive computer"}` → `18:41:59.022 OUT` 首条 `[0.99] 验收 tester 场景A 潜水电脑 … (id: coopanion-nmem-accept-tester-a)`；`toolcalls.jsonl` `durMs=77`、`failed` 未置位。
4. Coo 作答（`pet_say`）：`查到了：Oceanic Veo 4.0，2023 年买的，蓝色表带。` —— 引用的是检索命中的预置事实，非仅凭上下文。

真实入口（Coo）→ 工具 → 真实 Mem → 回执 → 作答，四环贯通；命中非空且指向目标记录。

## 4. 清单 3：场景 B 写沉淀 —— 通过（含 live upsert）

前置：``PARTNER.md` sha256 `ac994ac3…`、mtime 10:15（`05a*`）。

1. 用户告知持久事实（Keychron Q1 Pro / 奶白 / 茶轴）。
2. journal（`05d`）：`nmem_save`（args 含 content/title/unit_type，未指定 labels）→ 回执 `已新建记忆 21ea42c9-b37c-4f23-8ea0-8166cf9f4f4d。`（`durMs=103`）。
3. Mem 端核对（`05f`，`GET /memories/21ea42c9…` 200）：
   - `source: "coopanion"` ✅
   - `metadata.agent_id: "coopanion"`、`metadata.source_app: "cortico-world-nmem"` ✅
   - `label_ids: ["label_coopanion"]`（Coo 未传 labels，默认并入 `coopanion`）✅
   - `unit_type: "fact"`、`importance 0.6`、`created_at 2026-10-26T10:43:38Z`
4. 二次更新（补充「茶轴→红轴」）：journal（`05h`）`nmem_save` **带同一 id** `21ea42c9-b37c-4f23-8ea0-8166cf9f4f4d` → 回执 `已更新既有记忆 21ea42c9-…。`（`durMs=119`，**action=updated 经 Coo 真实路径实证**），随后 Coo 自行 `nmem_get` 复读全文确认。
5. 无重复落库核对（`05i`、`05j`）：`GET` 读回新 content（含「最初配 Gateron 茶轴，后来换成了 Gateron 红轴」）；`POST /memories/search` 该主题仅命中**同一 id 一条**（0.99），未出现第二条同义记忆。

## 5. 清单 4：场景 C 断连 —— 通过（含真实断连与恢复）

1. `osascript -e 'quit app "Nowledge Mem"'` → 8s 后 `/health` 连接失败（`000`）、`nmem-server` 进程消失（`06a`）。
2. 提问记忆问题。journal（`06d`）：
   - `18:47:07.773 CALL nmem_search` → `OUT` **`Nowledge Mem 不可达:请确认 Mem 正在运行,且 baseUrl 配置正确。`**
   - `18:47:08.737` Coo 自行重试一次 → 同一固定文案（两次均 `toolcalls.jsonl` `"failed":true`，`06f`）。
   - Coo 回复：`这次查不到，Mem 又不可达了，试了两回。` + `凭刚才查到的记忆：… 这是先前的结果，不是这次现场查的。`（如实区分了「现场查得」与「凭记忆」）
   - 轮次正常收束（`end_turn` → `[turn ended]`）。
3. 进程稳定性：Core PID 前后均为 **77767**（`06e`），`/api/worlds` 200，无崩溃/挂起。
4. `open -a "Nowledge Mem"` → 2s 内 `/health` 200（新 `nmem-server` PID 85711，`07a`）；再提问后 `nmem_search` `durMs=228`、命中 0.99 的同一探针并作答（`07d`）——恢复成立。

## 6. 清单 5：场景 D 旋钮热改 —— 通过

探针：4 条同主题行星记忆 `coopanion-nmem-accept-tester-d-1..4`（`08a` 均 200）。

| 步 | 操作 | Coo 侧观测 | 结论 |
| --- | --- | --- | --- |
| 基线 | 缺省（5/fast），免重启 | `nmem_search` 返回 **5 条**，`durMs=68`（`08e`） | 基线 |
| 热改 | `POST /api/config` → `searchLimit=2`、`searchMode=deep`，**未重启** | Core PID 仍 77767（`09c`），config.json 已落盘（`09d`） | 热改写入 |
| 热改生效 | 同查询、不显式给 limit/mode | 返回 **2 条**，`durMs=2041`，分数 0.99→0.73（`09g`） | ✅ 条数与模式免重启生效（时延为信息性信号，无阈值断言） |
| 热改复原 | `searchLimit=5`、`searchMode=fast`，未重启 | Core PID 仍 77767（`10c`）；返回 **5 条**，`durMs=77`（`10f`） | ✅ 双向热改 |
| baseUrl 改错未重启 | `baseUrl=http://127.0.0.1:14243`（该端口无监听，`11c` 探测 `000`） | 仍返回 5 条、`durMs=79`（`11f`）—— 说明旧地址仍在用 | ✅ baseUrl 非热改（与 README 一致） |
| baseUrl 错值 + 重启 | `POST /api/run/restart`（`12a`），Core PID 77767→**87022**，nmem 重新 active（`12d`） | `nmem_search` → `failed:true` + 不可达固定文案（`12g`）；Coo 告知不可达；进程稳定 | ✅ 按场景 C 表现 |
| 复原 + 重启 | baseUrl 回 `http://127.0.0.1:14242`，重启 → PID 87365（`13e`） | 见清单 6 的错 key 段 | — |
| 终态复原 | 移除错 key 后重启 → PID 87694（`14b`） | 返回 5 条、`durMs=76`（`14f`） | ✅ 全链路恢复 |

附带观察（非插件行为）：两次 Core 重启后，Coo 在收到 `[system] The app restarted; the session carries on.` 时**自行重跑了同一查询**并报告（18:58:39/40 不可达、19:00:58 认证失败）。这提供了两类失败表现的额外独立样本，也说明 Coo 会自主复检 Mem 状态。

## 7. 清单 6：失败表现 —— 通过

| 子项 | 触发方式 | 观测回执 | 证据 |
| --- | --- | --- | --- |
| 错 key（数据端点 401） | ① 组合根 + 真实 Mem，注入假 key；② **真实部署链**：写 `home/companion/.env` 的 `NMEM_API_KEY=nmem_accept_invalid_probe_key` + 重启 Core（PID 87365） | `Nowledge Mem 认证失败:API key 无效或已轮转,请检查 NMEM_API_KEY 配置。`（两路一致，`toolcalls` `failed:true`） | `02`、`13i` |
| 401 的真实性 | 直接 `curl -H 'Authorization: Bearer nmem_accept_invalid_probe_key' GET /memories` | `HTTP 401` + `{"detail":"Credential is no longer valid"}`；同端点不带鉴权头 → `HTTP 200` | `02b`、`02c` |
| content 超长拒绝 | 组合根 + 真实 Mem，`content` 30001 字符 | `内容过长(30001 字符,上限 30000),请提炼后重试。`（`failed:true`，**未发起 I/O**：随后按标题检索返回 `[]`） | `02`、`02d` |
| `nmem_get` 不存在 id | ① 组合根探针；② **Coo 真实调用**「用 nmem_get 读 id=coopanion-nmem-accept-tester-missing」 | `未找到 id 为 coopanion-nmem-accept-tester-missing 的记忆。`（`failed` 未置位，非错误）；Coo 复述「找不到…不是报错，就是没有」 | `02`、`14f` |

秘密卫生：错 key 期间与之后，`config.json`、`session-main.jsonl`、全部 `runs/*/log.jsonl` 中该 key 字面量命中数均为 **0**（`13j`）；工具回执只给固定文案。
另：`home/companion/.env` 在本机原本不存在，本会话写入前先确认（无先例文件被覆盖），测试后**删除恢复为不存在**（`13k`），未被日志/回执回显。Core 进程环境与 `launchctl` 中均无 `NMEM_API_KEY`（`20a`），因此该次错 key 确实经部署 `.env` 被 `ctx.secret()` 读入——这条链路此前仅机制核查、无 live 证据，本次补上实测。

## 8. 清单 7：D10 观察（PARTNER.md 并行写）—— 如实记录，不作硬门槛

| 观测点 | 事实 |
| --- | --- |
| 写入前 | `workspace/PARTNER.md` sha256 `ac994ac3d0e73f016069a6722981f88f3a27eda5c05982a17027b1777d8f3160`，mtime 10:15（`05a*`、`05a-PARTNER.before.md`） |
| 场景 B 两轮写 Mem 后 | sha256 **完全一致**，mtime 仍 10:15（`05k*`），内容仍是 4 条旧记录（`05l`）；`find workspace -newermt '-10 minutes'` 无任何文件被改（`05e`） |
| Coo 实际做的事 | 把本轮联调记录写进了**自己的日志** `workspace/log/2026-10.md`（`append_file`，见 `10f`、`14f` 的 journal 帧），而不是 PARTNER.md |

结论：在本次全部 13 个对话轮次（其中 2 轮是明确的写记忆请求）里，Coo **写入了 Mem，但没有更新 PARTNER.md**。这正是 D10 的提示词策略行为面（`ENV_PROMPT` 明示「Keep maintaining PARTNER.md exactly as you do today … Save the same fact to Nowledge Mem as well」），其实际执行取决于模型；本项按要求只记录、不作准入门槛，也不构成插件代码缺陷（World 无 outputTap/不能读 PARTNER.md，架构上无法强制）。

## 9. 未验证项（如实标注）

| 项 | 状态 | 原因 |
| --- | --- | --- |
| 远程模式（A6 / 场景 E，含 TLS、远程鉴权、`nmem config client set` 对照） | **未验证** | D9 决策：本期只做本地验收；README 已标注「未实测」 |
| GUI 目视（S3：设置页四旋钮呈现、agentId pattern 的 GUI 表现） | **未验证（用户可选）** | 本会话只用 API 级证据；GUI 目视需用户参与 |
| deep 模式「更完整」的召回质量差异 | **仅信息性信号** | 只观测到时延 68ms→2041ms 与分数分布变化（0.99→0.73），无质量阈值断言 |
| 重定向外联（reviewer B1 提出的安全声明问题） | **已独立复现，见 §10 R1** | 属安全声明边界，非本清单项 |
| `process.env` 对 `.env` 的优先级遮蔽（reviewer C1） | **本会话未复现该分支** | 本机 `NMEM_API_KEY` 既不在 Core 进程环境也不在 `launchctl`，故只验证了「无环境变量时 .env 生效」这一半；环境优先语义按框架源码与 reviewer 复现采信，见 §10 R2 |
| codeharness S4 外部缺陷 | 沿用登记 | 本仓库 `--all` 13 files / 0 findings，未触发；未重建合成工程 |

## 10. 失败项与残余问题清单（只登记，不修正）

**本会话未发现插件功能缺陷。** 以下两项属交付/依据层面的既有发现，本会话独立复核状况如下：

| # | 项 | 本会话证据 | 结论/归属 |
| --- | --- | --- | --- |
| R1 | **README 目的地址安全保证不成立**（reviewer B1 同类）：`README.md` 称「只向配置的 baseUrl 发起请求，不向其他地址外联」，但 `src/mem/client.ts` 的 fetch 适配器未限制重定向 | **独立复现**（`21-redirect-probe.txt`）：两个 127.0.0.1 临时服务，A 回 `307 Location: B/redirected`，B 记录到 `POST /redirected` 且 **body 完整为 save 正文**（合成样本），客户端仍返回 `action: created`。跨 origin 时 `Authorization` 未随行（`<none>`，Node fetch 语义） | 阻塞级（README 承诺 vs 真实语义）；**只登记**。真实 Mem 未观测到重定向，无真实数据外泄证据 |
| R2 | **秘密来源「仅部署 .env」与框架接缝**（reviewer C1）：Cortico `secretReader` 先读 `process.env`，再读部署 `.env` | 本会话实测确认「无环境变量 → `.env` 生效」（清单 6）；未构造环境优先分支 | 需负责人/architecture 裁定口径；**只登记** |
| R3 | 写路径的 D10 行为（PARTNER.md 未随之更新） | §8 | 提示词策略行为，非代码缺陷；按用户裁定不作硬门槛 |
| R4 | 端口事实：`config.json` `web.port=17788` 实际监听 17789（Lody 占用 17788） | §0 | 环境事实，与本插件无关；验收脚本须用 17789 |
| R5 | Coo 在 Core 重启后自行复检并重复查询（产生额外 Mem 调用） | §6 附带观察 | 宿主/模型行为观察，无副作用（只读调用） |
| R6 | 历史验收残留条目（非本会话）：`coopanion-nmem-accept-d-1..3`、`c8b18918-…`（T4 场景 B 活证据） | `16c` | 属 T4 已登记活证据，未由本会话清理 |
| R7 | 契约套件 N1/N2（清理只在断言全绿路径、零命中时断言空转）等 reviewer 非阻塞项 | 未复验（未跑 live 契约套件） | 沿用 reviewer/T4 登记 |

## 11. 交付门禁（本会话亲跑，冻结代码 `511f879`）

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npx -y pnpm@11.28.6 typecheck` | exit 0，无输出 | `18a` |
| `npx -y pnpm@11.28.6 test` | **106 passed + 5 skipped (111)**，5 文件全绿（skipped 为契约套件门控，未设 `NMEM_CONTRACT_BASE_URL`） | `18b` |
| `npx -y pnpm@11.28.6 test:coverage` | All **98.84 / 99.65 / 98.38 / 98.84**；`src` 五文件 100%（含 `index.ts`）；唯一缺口 `src/mem/client.ts:85-92`（缺省 fetchTransport，T2 既定） | `18c` |
| `uv run --no-sync code-harness --root <repo> --all`（于 `../codeharness`） | **`Architecture all: 13 files; 0 findings`**，exit 0 | `18d` |

未配置阈值、未改 baseline、未排除文件；`coverage/` 为既有产物。

## 12. 终态与环境恢复

| 项 | 终态 |
| --- | --- |
| 四旋钮 | `baseUrl=http://127.0.0.1:14242`、`searchLimit=5`、`searchMode=fast`、`agentId=coopanion`（`17a`、`17b`；config.json 无 agentId 键，走缺省） |
| World | `nmem` active，三工具在位（`17d`）；`nmem.started` 事件在档（`01c`） |
| 进程 | Core PID 87694 存活，`/api/worlds` 200；Write Mem 应用已复启运行，`/health` `{"status":"ok"}`（`17c`） |
| 部署 `.env` | 已删除，恢复为「不存在」（`13k`） |
| Mem 数据 | 本会话写入 6 条（`coopanion-nmem-accept-tester-a`、`-d-1..4`、`21ea42c9-…`）全部 `DELETE` 200 并 `GET` 复核 **404**（`16a`、`16b`）；按 `ACCEPT-TESTER / accept-tester` 检索仅余 T4 的 `c8b18918-…`（非本会话，`16c`） |
| 仓库 | `git status` 仅本目录交付文件未跟踪（`19a`）；HEAD `86d180b`（`19b`） |

---

## 13. 结论

- **业务闭环成立**：真实 Coo（console 通道）→ `nmem_*` 工具 → 真实 Mem（0.10.108）→ 回执 → 用户可见作答，读（场景 A）、写与 upsert（场景 B）、断连与恢复（场景 C）、旋钮热改与 baseUrl 重启语义（场景 D）均按 README 期望表现，且副作用在 Mem 端逐项核对通过。
- **失败语义正确**：不可达 / 认证失败 / 内容超长 / 不存在 id 四类回执文案与 `failed` 布尔、以及「不重试到底、不谎称已读写、继续对话」的 Coo 行为均符合契约；错 key 走的是真实部署 `.env` + 真实 401，且 key 未泄漏到配置、日志或回执。
- **已独立确认一项阻塞级交付问题**（R1：README 外联保证不成立），与 reviewer B1 结论一致；另有 R2（秘密来源口径）需负责人裁定。二者均只登记，未修正（纠正预算 2/2 已尽）。
- 未做整体最终验收判定；验收准入与否由 orchestrator 结合 reviewer/architecture 意见裁定。
