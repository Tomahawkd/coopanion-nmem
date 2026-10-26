# 探索：Coopanion / Cortico 扩展机制（EXPLORE-COOPANION-EXT）

- 任务标识：EXPLORE-COOPANION-EXT
- 角色：explorer（只读探索）
- 交付时间：2026-10-26
- 主文档引用：`docs/dev/coopanion-mem-plugin/main.md` v0.1
- 覆盖问题：① 包结构/manifest/工具事件配置 API ② Memory 契约 ③ 第三方安装与 macOS sideload ④ 运行环境与网络 ⑤ 最小参照扩展 ⑥ 版本与兼容承诺
- 范围外：未写实现代码；除本文档外未修改项目目录；未修改 `/tmp/coopanion-ref`

## 探索依据（只读参照）

| 对象 | 版本/提交 | 位置 |
| --- | --- | --- |
| Coopanion 仓库 | `ed8bdf179d55c69c081a5488035ac86bd71d63e5`（2026-10-25），`package.json` version `0.2.10` | `/tmp/coopanion-ref`（`git clone --depth 1 --recurse-submodules`） |
| Cortico 子模块 `vendor/cortico` | `cb9ddbd685bcccba1f29905098648f46a79b3862`，version `0.2.7`，MIT | `/tmp/coopanion-ref/vendor/cortico` |
| 本机已装发行版 | `CFBundleShortVersionString 0.2.10`，应用目录 `/Applications/Coopanion.app/Contents/Resources/app` | 运行态实测（只读 ls / grep） |

> 行号说明：仓库侧行号对应上面两个提交；发行版侧行号对应 `/Applications/Coopanion.app/Contents/Resources/app` 内文件（由 `scripts/stage.ts` 从 `vendor/cortico` 生成，内容与子模块一致）。

---

## ① 结论摘要（对 6 问逐条）

### 问 1：World 扩展的包结构、manifest 字段、给 Bot 声明工具/事件/配置的 API

**结论：机制完备且文档化，World 包 = 一个 ESM npm 包，`package.json` 的 `cortico` 块是 manifest，入口默认导出 `WorldDefinition`；工具走 `tools()`，事件走 `host.pushEvent()`，配置走 `defaults()` + `WorldContext.cfg` + `WebUI ConfigGroup`。**

包结构（以模板 `vendor/cortico/templates/extension/world/` 为准）：

| 文件 | 职责 |
| --- | --- |
| `package.json` | 名字、`type: "module"`、`keywords: ["cortico-world"]`、`cortico` manifest 块 |
| `src/index.ts` | `export default DEFINITION`（入口） |
| `src/definition.ts` | `WorldDefinition`：`id`/`label`/`defaults()`/`create(ctx)`/`describe` |
| `src/world.ts` | 实现 `World` 接口 + `<PREFIX>_TOOL_DECLS` 工具声明表 |
| `src/config.ts` | 配置段类型、`*_DEFAULTS`、`ConfigGroup`（JSON Schema 旋钮） |
| `src/ENV_PROMPT.md` | 环境提示词模板（进 system 前缀） |
| `describe.json` | `pnpm describe:extension` 导出自描述（工具、事件），市场只读它不执行代码 |
| `tests/` | `dryMountWorld` + `FakeHost` 干装载测试 |

manifest 字段（`vendor/cortico/src/extensions/manifest.ts:42-55`，解析逻辑 `:100-188`）：

```ts
interface ExtensionManifest {
  displayName?: string;   // WebUI 卡片标题
  icon?: string;          // png/webp/svg，包内相对路径
  kind: ExtensionKind;    // 'world' | 'provider' | 'bot'   ← 必填
  api: number;            // 契约版本，world 必须 = 6            ← 必填
  webUiClient?: string;   // 面板产物 .js/.mjs
  webUiStyle?: string;    // 面板样式 .css（须同时有 client）
  describe?: string;      // 自描述 .json
}
```

硬性校验（不满足即**拒绝加载**）：`pkg.type === 'module'`（`manifest.ts:105-107`）、`cortico` 块存在（`:109-113`）、`kind` 合法（`:122-126`）、`api` 为整数且**等于**该类契约版本（`:128-140`）。
`keywords` 缺类关键字只给 warning（`:167-172`）；`tags`/`locales`/`screenshots` 框架不读、只校验形状（`:163-165`）。

工具/事件/配置三件套：

- **工具**：`World.tools(): ToolDef[]`（`src/core/types.ts:903-952` 的 `World` 接口；`ToolDef` 定义 `:262-280`）。`ToolDef` 含 `name`/`description`/`parameters`(JSON Schema)/`tags`/`handler`，另有 `barrierAfter`、`endsTurn`、`interruptible`。`tags` 取值 `'read'|'write'|'speak'|'act'|'flow'|'snapshot'`（`:195-200`），`write` 的语义明确写着「修改 Memory 或 World 的内部记录」（`:209`）。
- **工具命名规则（硬约束）**：工具名在一个 bot 内全局唯一，冲突时**拒绝挂载**（`src/world.ts:451-462`）；官方要求用自家短名前缀（`docs/worlds.md:67-68`）。
- **事件**：`WorldHost.pushEvent(e, opts)` / `pushDeferred` / `pushCandidate`（`src/core/types.ts:679-780` 的 `WorldHost`；`worlds.md:26-56`）。`trigger` 决定投递时机：`preempt`/`interrupt`/`flush`/`debounce`/`piggyback`（`types.ts:600-620`）。
- **配置**：`WorldDefinition.defaults()` 定 `worlds.<id>` 段默认形状（且 `enabled` 应为 `false`，`world.ts:50-70`）；运行时用 `WorldContext.cfg`（**活引用，现读即热生效**）与 `ctx.persist(patch)`（`world.ts:29-48, 485-505`）；WebUI 旋钮用 `ConfigGroup` JSON Schema，`x-hot: false` 表示需重启生效（`worlds.md:85-86`，模板 `src/config.ts:16-31`）。
- **自描述**：`WorldDefinition.describe`（`WorldDescribe`，`world.ts:72-76`），由 `describeTools(TOOL_DECLS, summaries)` 从同一份声明拼出（`world.ts:82-89`）。运行时工具名/事件 type 不在 `describe` 里**照常生效但记 warn**（`extensions.md:266-268`）；`pnpm check:extension` 把这种不一致判为**失败**（`extensions.md:297-299`）。

事件契约要点（`docs/worlds.md:58-71`）：`EventEnvelope` 含 `cursor`/`run`/`type`/`ts`/`source`(World id)/`origin`/`tags`/`text`/`senderKey`/`meta`/`blobs`/`ephemeral`；`text` 由生产方提供，**Core 不改写不补语义**；`origin: 'internal'` 只用于来源可验证的内部通知，外部内容必须 `external`。工具回执 `ToolOutcome { text, blobs?, failed? }`，handler 抛错即转失败回执（`:63`）。

### 问 2：Cortico 的 Memory 契约；Coo 现有 PARTNER.md 记忆系统；扩展能否提供记忆工具或接入记忆流

**结论（关键限制）：World 扩展【不能】访问 Persona 的 Memory 内容。`World` 契约明确写着「World 不直接访问 Memory 或调用 Persona 的工具」（`docs/worlds.md:6`），`WorldContext` 也没有 `memoryDir`（`src/world.ts:29-48` 只有 `botDir`/`packageDir`/`dataDir`/`repoRoot`/`secret`/`persist`/`restart`）。扩展【能】提供自己的记忆工具（把工具给 Bot，由 Bot 决定何时读写），这才是官方指定的接入方式。**

Coo 现有记忆系统（Coopanion 侧，非 Cortico 内置）：

- Coo 的 Persona = Cortico 的 Cormini 子类，`core/persona.ts:127-153`（`coopanionPersona(Base)`）。四个改动见文件头注释 `core/persona.ts:1-19`。
- **记忆物 = 部署目录下的一个文件式工作区**，运行时路径实测为 `~/Library/Application Support/Coopanion/home/companion/workspace/`（含 `.git/`、`CONSTITUTION.md`、`PARTNER.md`、`partner/`）。目录由 `vendor/cortico/src/deploy.ts:166`（`memoryDir: abs(config.paths.memory)`）与 Coopanion 的 `core/seed.ts:46-47`（`join(deploy, 'workspace')`）决定；`config.json` 未写 `paths`，走 `CORE_DEFAULTS.paths.memory = 'memory'`→ 实际为 `workspace`（由 Coopanion 种子决定）。
- **PARTNER.md**：`core/persona.ts:28` 定义常量；`:32-34` 的 `PARTNER_NOTE` 说明「每次请求整份进 system 前缀，要保持精简，细节写进 `partner/`」；`:141-149` 覆盖 `partnerDoc()` 把它拼进前缀；`:85-124` 的 `arrangePartner()` 处理大小写变体合并。行为文档见 `README_zh.md:46`。
- **MEMORY_NOTE**（工作区维护规约，进前缀）：`core/persona.ts:38-47`。
- **版本历史**：每次写入都提交到工作区 Git 仓库，一工具调用一 commit，`blobs/` 排除（`core/persona.ts:10-12, 155-172`）；启动时打 `start-<version>` tag（`:55, 174+`）。
- **声明 Memory 形式**：Coo 的 `BotDefinition.describe.memory.form`（`core/companion.ts:486-492`）。
- **工具面**：Coo 复用 Cormini 的文件工具（`write_file`/`edit_file`/`append_file`/`delete_file`/`move_file`/`save_blob` 等，`core/persona.ts:58-65` 列出写工具与其回执），实现在 `vendor/cortico/bots/cormini/persona/workspaceTools.ts` 与 `memory.ts`（后者头注释：`文件式工作区记忆：路径检查、文件读写、遍历、检索、二进制附件和 Git 历史`，`memory.ts:1-4`）。Cormini 的 `tools()` 是「她对记忆的全部动作面」，注释明说「**换记忆实现就是换掉这一份的内容**」（`bots/cormini/persona/persona.ts:735-755`）——但那是 Persona 层，World 无法改。
- **`outputTap` 可扇入（重要）**：Cormini 把**所有已挂载 World** 的 `outputTap()` 扇成一个 tap，「每批投递时现取，World 运行中挂载/卸载即生效」，多路时逐项转发、`externalizes` 取 `some`（`bots/cormini/persona/persona.ts:715-728`；测试 `tests/cormini/output-tap.test.ts:30-40`）。因此**桌宠占用 `outputTap` 不排斥扩展再加一个**，扩展能拿到主 session 的模型输出增量。

扩展侧的可行接入点（事实 + 边界）：

| 接入方式 | 是否可行 | 证据 |
| --- | --- | --- |
| World 提供自己的「记忆工具」给 Bot 调用（读写外部记忆库） | **可行**，官方指定路线 | `tools()` 契约 `types.ts:262-280`；模板 `src/world.ts:16-30, 42-44` |
| World 直接读 `PARTNER.md` / `memoryDir` | **契约上无接口** | `WorldContext` 无 `memoryDir`（`world.ts:29-48`）；`worlds.md:6` 明文禁止 |
| 通过 `ctx.dataDir` 读写（与 Memory 同部署但不同目录） | **可行但语义不同**：`dataDir` 与 `memoryDir` 是两个路径 | `deploy.ts:166-167`；实测 `home/companion/data` vs `home/companion/workspace`；`worlds.md:88-90` 说明 `dataDir` 由 Core 与全部 World 共用、需以 World id 前缀命名 |
| 订阅「对话/Memory 写入流」 | **无专用 Memory 流接口**，但**可经 `outputTap()` 收到模型输出流**（可与桌宠并存，见下） | `outputTap()` 见 `types.ts:922`、`types.ts:447-456`；**扇入实现 `bots/cormini/persona/persona.ts:715-728`**；测试 `tests/cormini/output-tap.test.ts:30-40`；Core 侧 `src/core/loop.ts:1109-1135`（异常只记日志、不中断）；`worlds.md:20` |
| Bot 层扩展（`kind: 'bot'`）接管整个 Persona 记忆 | **可行但会替换 Coo 的 Persona** | `extensions.md:222-237`；一个进程只跑一个 bot（`:229`）；Coo 的 `declares` 硬编码在 `core/companion.ts:482`,被 `stage.ts:41` 限制只带 3 个 World |

补充事实：市场里已有第三方以「bot 包」形式做长期记忆的先例 `cortico-bot-memory`（`长期记忆…记忆归 bot 私有,经系统前缀注入、对话实时沉淀,无需 world`，本机索引 `~/Library/Application Support/Coopanion/extensions/market-catalog.json`，`kind: bot`，v0.2.0，150 次下载）。这是**并存疑记录**：它走的是替换 Persona 的路，与「不替换内置记忆」（主文档 D2）冲突。

### 问 3：第三方扩展如何在发行版上安装（Extensions 页 / 市场索引 / 本地 sideload / 包格式 / macOS 手动安装路径）

**结论：A1 部分成立 —— 发行版无需进官方市场即可装本地扩展，但「本地」以「本机目录 link 安装」实现，且安装动作统一走 pnpm（内置 pnpm + 应用自带 runtime），仍然需要一次 `pnpm add` 落盘，之后必须重启 Core 进程并在 World 总览里启用。**

- **Extensions 页存在且是官方入口**：设置窗口「高级模式」的 Extensions 页复制自 Cortico WebUI（`docs/DEVELOPMENT.md:53, 67`；`README_zh.md`/`README.md:170`）。页面代码 `console/advanced/features/extensions/index.ts`，左栏路由 `console/index.ts:76`。
- **本地安装 UI**：`console/advanced/features/extensions/index.ts:1487` 提供 `npm` / `local` 分段；选 `local` 时 `:1490` 调 `POST /api/path-picker`（macOS 下用 `osascript` 弹目录选择框，`build/cortico/src/web/path-picker.ts:245, 307`）；`:1226` 先 `check` 再 `POST /api/extensions/install`，body 为 `{ path }`。
- **服务端接口**：`POST /api/extensions/check`（`build/cortico/src/web/server.ts:2062-2079`）只读 `package.json` 解析 manifest、**不导入包代码**；`POST /api/extensions/install`（`:2081+`）接受 `{ path }` 或 `{ name, version }`。
- **本地目录如何落地**：`ExtensionManager.installSpec()`（`build/cortico/src/extensions.ts:1083-1091`）把 path 规范化成绝对路径（相对路径以 `repoRoot` 为基准）、校验目录存在且有 `package.json`，然后 `pnpm add <绝对路径>`（`:1057-1074`）。文档说明「本机目录以 link 方式装入，改源码后重启生效」（`vendor/cortico/docs/extensions.md:15-17`）。因此本地目录在 `extensions/package.json` 里记录为 `link:` spec，`updates()` 会跳过 `link:` / `file:` / `workspace:` 进度检查（`:822-823`）。
- **扩展安装目录（macOS，实测）**：`~/Library/Application Support/Coopanion/extensions/`，由 Electron 主进程显式注入环境变量：`app/main.cjs:260` `CORTICO_EXTENSIONS_DIR: join(userData, 'extensions')`（同处 `:259` `CORTICO_HOME: join(userData, 'home')`）。`userData` 在 macOS 即 `~/Library/Application Support/Coopanion`（`app/main.cjs:24-26` 头注释）。当前实测内容：`package.json`（`{"name":"cortico-extensions","private":true,"dependencies":{}}`）、`pnpm-workspace.yaml`（空）、`market-catalog.json`、`market-index.json`，**尚无 `node_modules/`**（未装任何扩展）。目录可写。
- **包格式**：就是标准 npm 包（可选 `files` 白名单），**没有自定义 `.zip`/`.cortico` 安装包格式**。证据：`extensions.md:8-44` 只列出三种来源（registry 关键字搜索 / 手填包名 / 本机目录）。
- **pnpm 如何被提供**：应用不附带 Node/corepack，用 `app/shims/corepack`（shell 脚本）替身，`ELECTRON_RUN_AS_NODE=1` 调应用自带 pnpm（`app/shims/corepack`；`CORTICO_NODE_EXE`/`CORTICO_PNPM_CJS` 注入见 `app/main.cjs:274-275`）。`PATH` 首位插入 shim 目录（`:273`）。
- **安装后生效路径（硬性）**：装卸只改磁盘；`/api/extensions` 会把版本/状态不同的包标 `pending-restart`（`extensions.ts:769-790`）；需要点「Restart process」（`POST /api/run/restart`，`build/cortico/src/web/server.ts:1884-1894`），再在「World 总览」启用（`extensions.md:40-44`；`README.md:170`）。
- **市场官方索引机制**：默认源 `https://raw.githubusercontent.com/Pal-AI-Lab/cortico-extensions/main`，文件 `index.json` / `catalog.json` / `packages/<包名>.json` / 评论快照；第二回退 `api.github.com` contents API；两者都失败才报错（`extensions.md:69-105`；实现 `vendor/cortico/src/extensions/market.ts`）。索引源可改（`POST /api/extensions/index-base`）。**市场只是元数据增强层，不是安装的必要条件**（关键词搜索走 npm registry，本地目录走 path）。
- **发布者/平台限制**：`os` 字段由市场按平台标出，本机不在其中时**禁用安装并写明原因**（`extensions.md:43`）。这只影响市场 UI 卡片，不阻止本地 path 安装（`check()` 不校验 `os`，`extensions.ts:1033-1051`）。
- **「托管自己的环境」这条路的限制**：Coopanion 明确不为扩展 World 提供应用壳 UI 入口；扩展要让使用者看见内容，只能「经 Bot」或「自己拉起小应用」，且**不得借用 `CORTICO_NODE_EXE` 开窗口**（`docs/DEVELOPMENT.md:62-71`）。v0.2.2 曾加「扩展页面」菜单，v0.2.3 已撤回（`:71`）。

### 问 4：扩展运行环境（进程、可用 API、HTTP(S) 能力、限制）

**结论：A3 成立。扩展 World 与 Core 同进程（Core = Electron 主进程 fork 的子进程，以 Node 模式跑 TS），拥有完整 Node 能力，可自由发起 localhost 与外部 HTTPS 请求，仅在 i18n 语言链和「不是独立进程」两点上有实际约束；不经过设置窗口的 renderer，因此不受 renderer 侧网络白名单限制。**

- **进程模型**：Electron 主进程用 `child_process.fork` 启动 `core/boot.ts`（`--import tsx`，`ELECTRON_RUN_AS_NODE=1`），见 `app/core-host.cjs:1-27`（头注释）、`:23`（`const { fork } = require('node:child_process')`）。扩展在 `core/boot.ts` 里经 `loadExtensions(repoRoot(), …)` 被 `import()` 进**同一个 Core 进程**（`core/companion.ts:531-546`；`vendor/cortico/src/extensions.ts:252-282`）。**没有沙箱、没有独立 worker、没有权限清单**。
- **可用 API**：World 侧只有契约（`World` + `WorldHost` + `WorldContext`）；但因同进程，**没有机制阻止**扩展 `import 'node:fs'` / `node:http` / `fetch` / 任意 npm 依赖。Cortico 自带 World 就这么做：`websearch` 直接用 `fetch`（`vendor/cortico/src/worlds/websearch/brave-client.ts:225-233`）。模板把 `@types/node` 列为 devDependency（`templates/extension/world/package.json`）。
- **模块解析**：框架把 `cortico/*` 前缀映射到已 staged 的框架源码，用一个 `registerHooks` 解析钩子，**早于 node_modules**（`vendor/cortico/src/extensions/runtime.ts:1-45`；`extensions.md:185-195`）。扩展必须 `"type": "module"`，且 `cortico` 版本要与写入时的框架版本对齐（`extensions.md:188-195`）。开发期 `pnpm add -D cortico`（npm 上 `cortico@0.2.7` 可装，实测 registry dist-tags latest = 0.2.7）。
- **网络**：Core 进程有完整出网能力。
  - Proxy：`NODE_USE_ENV_PROXY=1`；有 `HTTP(S)_PROXY` 变量时走变量，否则设 `COOPANION_SYSTEM_PROXY=1` 由 `core/system-proxy.ts` 按主机向主进程查系统代理（PAC 生效），`fetch` 走全局 dispatcher（`app/core-env.cjs:1-19`；`core/system-proxy.ts:1-22`）。
  - **localhost 免代理**：`core-env.cjs:3-6` 把 `127.0.0.1`/`localhost`/`::1` 无条件补进 `NO_PROXY`/`no_proxy`；`system-proxy.ts:46` 对 LOOPBACK 直接返回直连。这正面支持「扩展访问本机 Nowledge Mem HTTP API」。
  - 代理类型限制：Node 只说 HTTP/HTTPS 代理，SOCKS 条目退回直连（`core-env.cjs:41-45`）。
- **限制（renderer 侧，不适用于扩展后端逻辑）**：设置窗口的 Chromium session 有严格白名单——只允许本机地址、GitHub release 检查、市场图片，其余 `cancel`（`app/main.cjs:396-407`），CSP `script-src 'self'`（`:334`）。**这些约束落在设置窗口页面与扩展 WebUI 面板的浏览器代码上，不落在 Core 里的扩展 JS 上**。因此：扩展的**面板前端**不能任意外联；扩展的**World 服务端代码**不受此限。
- **本地 HTTP 服务器**：可行且有先例。桌宠 World 自带 HTTP + WebSocket 服务端并对 Origin 做校验（`vendor/cortico/src/worlds/webui-fixture` 被 `stage.ts` 剔除，但桌宠包 `packages/cortico-world-desktop-pet/src/server.ts` 就是现成样本）；主进程对发往桌宠服务器的请求做 Origin/无 referrer 帧文件白名单转发（`app/main.cjs:346-358`）。
- **秘密存储**：`ctx.secret(name)` 读部署 `.env`，`ctx.storeSecret(name, value)` 写 `.env`（仅本人可读）并即时进 `process.env`；**值不能为空或含空白**，否则抛错（`world.ts:41-43, 186-196`）。这对「远程 Mem 的 url+api-key」配置是直接可用的机制，但**带空白的 key 会被拒**。

### 问 5：最小参照扩展（manifest 与工具声明长什么样）

**结论：官方模板 `vendor/cortico/templates/extension/world/` 就是最小参照（1 事件 + 1 工具 + 1 env prompt + 1 配置旋钮）；形态最接近「记忆插件」的现成样本是发行版里的桌宠 World（`packages/cortico-world-desktop-pet`）与 Cortico 自带的 `websearch`（唯一「只提供请求/响应工具」的 World）。**

模板 manifest（`templates/extension/world/package.json`）：

```jsonc
{
  "name": "cortico-world-example",
  "version": "0.1.0",
  "type": "module",
  "keywords": ["cortico-world", "cortico"],
  "main": "./src/index.ts",
  "cortico": { "kind": "world", "api": 6, "tags": [], "describe": "describe.json" },
  "devDependencies": { "cortico": "^0.2.7", "tsx": "...", "typescript": "...", "vitest": "..." }
}
```

模板工具声明（`templates/extension/world/src/world.ts:16-30`）——声明表与 handler 分离是官方约定：

```ts
export const EXAMPLE_TOOL_DECLS: ReadonlyArray<Omit<ToolDef, 'handler'>> = [{
  name: 'example_echo',
  description: 'Echo the given text back, prefixed with the configured greeting.',
  tags: ['read'],
  parameters: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', description: 'Text to echo.' } }, required: ['text'] },
}];
```

模板 definition（`src/definition.ts:5-20`）：`id`/`label`/`defaults()`/`create(ctx)`，`describe.tools` 由 `describeTools(EXAMPLE_TOOL_DECLS, {example_echo: {zh, en}})` 生成，`describe.events` 列 `example.started`。
模板事件推送（`src/world.ts:63-72`）：`host.pushEvent({ type, ts: nowIso(tz), source: id, origin: 'internal', senderKey: id, text })`。

桌宠 World（真实发行版参照）：
- manifest：`packages/cortico-world-desktop-pet/package.json` — `"cortico": { "kind": "world", "api": 6, "webUiClient": "dist/webui.js", "webUiStyle": "dist/webui.css", "describe": "describe.json" }`，`main: ./src/index.ts`。
- 入口：`src/index.ts:1-14`（`export default DESKTOP_PET`）。
- 定义与自描述：`src/definition.ts:19-68` — `describeTools([...petToolDecls(), ...CUA_OFF_TOOL_DECLS, ...CUA_TOOL_DECLS], { ...17 条 zh/en summary })` + 6 个事件（`desktop-pet.message` 带 `trigger: 'preempt'` 等），`describe.json` 是它的落地文件。
- 工具规模：`describe.json` 含 `pet_say`、`pet_ask`、`pet_move_to`、`pet_set`、`pet_cua_*`（截图/点击/输入/窗口）等；`pet_ask` 展示「同步返回、答案稍后作为事件送回」的模式。

`websearch`（最贴合「只做外部 API 请求」的参照，`vendor/cortico/src/worlds/websearch/`）：`definition.ts:6-28` 只有 `web_search` 一个工具、`events: []`；`world.ts:1-4` 头注释「仅提供请求/响应工具的 World…搜索结果不落事件库」；`brave-client.ts:225-233` 是完整的 `fetch` + 鉴权头 + 超时 + 重试样本。
**注意**：`websearch` 被 `scripts/stage.ts:39` 从发行版中剔除（`DROP` 集合含 `src/worlds/websearch`），所以在已装 Coopanion 的 `build/cortico/src/worlds/` 里**只剩 `console`**（实测 `ls` 结果）。它只能作为源码参照，不是发行版里可用的现成 World。

### 问 6：版本约束与 API 稳定性声明

**结论：最新 release = `v0.2.10`（2026-10-25T06:35:03Z）。当前契约版本 world **6** / provider **6** / bot **7**，`cortico.api` 必须严格等于对应类别的数，否则拒绝加载；上一版（world 5 / provider 5 / bot 6）经过渡层加载并给 warning，下一个大版本删除该过渡层。仓库**没有**针对「扩展 API 兼容性」的产品级承诺段落；唯一的正式兼容承诺段落是桌宠**形象包**（figure pack）的，不适用于 World 扩展。**

- 版本号：`/tmp/coopanion-ref/package.json` `"version": "0.2.10"`；本机安装 `CFBundleShortVersionString 0.2.10`；GitHub API `releases/latest` → `0.2.10`, `2026-10-25T06:35:03Z`, name `Coopanion v0.2.10`；release notes `docs/releases/v0.2.10.md`。
- Cortico 子模块版本：`vendor/cortico/package.json` `"version": "0.2.7"`；提交注释 `build(package.json): 版本 0.2.7`。
- 契约版本与判据（`vendor/cortico/src/extensions/manifest.ts:17-27`，`docs/extensions.md:303-317`）：

| 类别 | 当前 `api` | 上一版 | 加一判据 |
| --- | --- | --- | --- |
| world | **6** | 5 | `WorldDefinition` 不兼容变更 |
| provider | 6 | 5 | `ProviderModule` |
| bot | 7 | 6 | `BotDefinition`、`BotParts`、`Persona`、`LoadedConfig` |

- `api` 比较是**严格相等**：`api < expected` → `apiTooOld`，`api > expected` → `apiTooNew`，都是拒绝（`manifest.ts:136-140`）。`isPreviousContract` 命中则 warning + 名字映射（`:133-135`），过渡层 `src/extensions/previous-contract.ts`，**Cortico 下个大版本删除**（`extensions.md:308-311`），且 `pnpm check:extension` 对上一版契约**判失败**（`:311`）。
- 演进规则（`extensions.md:313-315`）：某类不兼容变更只加该类版本；`WebUiPanelContext` 与共享接口变更时三类一起加；同一次发布多处变更合计加一。「扩展 API 与 WebUI 协议分别版本化」。
- **兼容承诺段落的实际内容**：`packages/cortico-world-desktop-pet/README.md:323-340`「形象包兼容承诺」六条（manifest 只升不拒 / 同一 api 只做加法 / kit 跟着 api 冻结 / 旧应用跳过不认识的东西 / 用户打扮不失效 / CI 守契约）。这**只覆盖 figure pack 的 `figure.json`、沙箱契约、kit、`skin.scheme`**，与 `WorldDefinition` 契约无关。**Coopanion 侧没有对第三方 World 扩展的兼容承诺**——只有 Cortico 侧的「契约版本 + 过渡层一版」实践惯例。
- 版本联动：`cortico` npm 包版本跟框架走（`extensions.md:194-195`），当前 npm latest = `0.2.7`，与发行版内子模块一致 → 扩展可以 `"cortico": "^0.2.7"` 开发并对当前发行版成立。但**发行版升级带来的 world 契约 6→7 会直接让扩展「需要升级」并拒载**。

---

## ② 证据清单

### A. Coopanion 仓库（`/tmp/coopanion-ref`，commit `ed8bdf17`）

| # | 路径:行号 | 关键引用 |
| --- | --- | --- |
| A1 | `package.json:1-10` | `"version": "0.2.10"`、`main: app/main.cjs`、`engines.node >= 22` |
| A2 | `vendor/cortico`（子模块）`cb9ddbd6` | Cortico 0.2.7，MIT |
| A3 | `docs/DEVELOPMENT.md:3-5` | 「Coopanion 是用 Cortico 组装的 Electron 桌面应用：Core + Cormini Persona + 桌宠 World + Coo Pet Provider」 |
| A4 | `docs/DEVELOPMENT.md:62-71` | 「应用界面与 World 的边界」：只渲染自己绑定的 3 个 World；扩展两条路（经 Bot / 托管自己的环境）；「不借 `CORTICO_NODE_EXE` 开窗口」；v0.2.2→0.2.3 撤回「扩展页面」菜单 |
| A5 | `core/persona.ts:1-19` | Coo Persona 头注释：PARTNER.md 整份进前缀、MEMORY_NOTE、每次写入一 commit、`blobs/` 排除 |
| A6 | `core/persona.ts:28-47` | `PARTNER_FILE`/`PARTNER_DIR`/`PARTNER_NOTE`/`ARCHIVE_DIR`/`MEMORY_NOTE` |
| A7 | `core/persona.ts:58-65` | `WRITES` 表：`write_file`/`edit_file`/`append_file`/`delete_file`/`move_file`/`save_blob` |
| A8 | `core/persona.ts:85-124, 141-153` | `arrangePartner()`；`partnerDocFile()` = `join(memoryDir, 'PARTNER.md')`；`partnerDoc()` 拼接 |
| A9 | `core/companion.ts:482` | `declares: [CONSOLE.id, DESKTOP_PET.id, NOTICE.id]` —— Coo 只声明 3 个 World |
| A10 | `core/companion.ts:486-492` | `describe.memory.form`（中英）描述工作区记忆形式 |
| A11 | `core/companion.ts:531-546` | `loadExtensions(repoRoot(), { reserved: bundled.map(w=>w.id), reservedProviders: [...] })` → `withWorlds(definitionBase, [...bundled, ...extensions.worlds])` |
| A12 | `core/boot.ts:1-31` | Core 子进程入口；`CORTICO_EXTENSIONS_DIR ??= join(APP,'build','data','extensions')`（源码态默认，发行版被主进程覆盖）；`COOPANION_SYSTEM_PROXY`；先 `import runtime.ts` 注册解析钩子 |
| A13 | `core/seed.ts:29, 46-47` | 工作区 = `join(deploy, 'workspace')`；`CONSTITUTION.md` 种子 |
| A14 | `core/system-proxy.ts:1-22, 42-63, 24` | 系统代理按 origin 查询、TTL 10s、失败直连；`LOOPBACK` 直接返回 null |
| A15 | `scripts/stage.ts:33-42` | `DROP` 集合含 `src/worlds/minecraft`、`qq`、`bilibili`、`websearch`、`webui-fixture`、`src/providers/llamacpp`、`bots/corti-soulmate`、`bots/cortiv` |
| A16 | `scripts/stage.ts:54-55` | staged Cortico 写成 `{ name:'cortico', private:true, type:'module' }` |
| A17 | `packages/cortico-world-desktop-pet/package.json` | `cortico: {kind:'world', api:6, webUiClient, webUiStyle, describe}`；`main: ./src/index.ts`；`files` 白名单 |
| A18 | `packages/cortico-world-desktop-pet/src/definition.ts:19-68` | `DESCRIBE`：`describeTools(petToolDecls()+CUA_*)` + 6 事件（`desktop-pet.message` 带 `trigger:'preempt'`） |
| A19 | `packages/cortico-world-desktop-pet/src/world.ts:723` | `outputTap(): OutputTap \| undefined` —— 桌宠已占用该旁路 |
| A20 | `packages/cortico-world-desktop-pet/README.md:323-340` | 「形象包兼容承诺」六条（**仅**覆盖 figure pack 契约） |
| A21 | `README.md:46` / `README_zh.md:46` | Memory 用户可见描述：`PARTNER.md` + 工作区版本历史（macOS/Linux 需装 git） |
| A22 | `README.md / README_zh.md:170` | Extensions 页在高级模式；装完点 Restart process，再在 World Overview 启用 |
| A23 | `README.md:181` / 隐私节 | 网络访问清单：GitHub release、npm 与官方索引、GitHub 投票评论、ModelScope/HF 语音模型 |
| A24 | `docs/releases/v0.2.10.md:1-18` | 0.2.10 改动与八种安装包文件名 |
| A25 | `console/advanced/features/extensions/index.ts:384, 1487-1491, 1226, 1170-1176` | `source: 'npm' \| 'local'`、`pickPath` 目录选择、`/api/extensions/install`、`/api/extensions` 回 `dir` |
| A26 | `console/index.ts:76` | `fromFeature(extensionsFeature, 'integrations')` —— Extensions 页注册 |
| A27 | `console/base/api.ts:130-133` | `pickPath()` → `POST /api/path-picker` |

### B. Cortico 子模块（`/tmp/coopanion-ref/vendor/cortico`，`cb9ddbd6`，0.2.7）

| # | 路径:行号 | 关键引用 |
| --- | --- | --- |
| B1 | `docs/extensions.md:5-6` | 「扩展是一个 npm 包,给一份部署补一个 World、一个 provider 或一个 bot」 |
| B2 | `docs/extensions.md:8-44` | 安装：`extensions/` 目录 / `CORTICO_EXTENSIONS_DIR`；WebUI 扩展页（关键字搜索、手填包名、**选本机目录 link 装入**）；`POST /api/extensions/check` 只读 manifest；pnpm `minimumReleaseAge` 24h；`allowBuilds` 构建脚本闸门；`builtin` 不可删 |
| B3 | `docs/extensions.md:46-67` | 更新；`link:` 本机扩展不查 npm |
| B4 | `docs/extensions.md:69-105` | 官方索引仓 `Pal-AI-Lab/cortico-extensions`；raw + contents API 两处回退；`index.json`/`catalog.json`/`packages/<name>.json` |
| B5 | `docs/extensions.md:142-202` | World 扩展 manifest 示例、`displayName`/`icon` 可选、`tags`/`locales`/`screenshots`/`describe` 不参与加载、入口导出 `WorldDefinition`、`cortico/<路径>` 导入机制、`type: module` 硬要求 |
| B6 | `docs/extensions.md:222-237` | bot 扩展；「一个进程只跑一个 bot」「包目录只读」「`memoryName` 是 Memory 页标题」 |
| B7 | `docs/extensions.md:239-268` | 自描述：World `tools{name,description,parameters,tags,summary}` + `events{type,description,trigger,tags}`；`describe:extension` / `check:extension` |
| B8 | `docs/extensions.md:270-301` | 校验：`check:extension` 导入入口、假部署 `create()`、工具名冲突检查；**不调用 `start()`、不验证真实服务**；配置路径必须落在自己段内 |
| B9 | `docs/extensions.md:303-317` | 契约版本 world 6 / provider 6 / bot 7；上一版过渡层；下一个大版本删除 |
| B10 | `docs/extensions.md:319-325` | 已有扩展：`cortico-world-vtuber`、`cortico-world-asr`、`cortico-provider-grok`（独立发布） |
| B11 | `docs/worlds.md:5-7` | 「World 通过事件报告外部环境变化…**World 不直接访问 Memory 或调用 Persona 的工具**」 |
| B12 | `docs/worlds.md:11-24` | `World` 成员表（`id`/`envPromptVars`/`tools`/`start`/`stop`/`webUi`/`outputTap`/`onHandoffEnded`/`onTurnEnded`/`onEventsSettled`/`onRunPhase`/`shutdownVerification`） |
| B13 | `docs/worlds.md:26-39` | `WorldHost` 能力表（`pushEvent`/`pushDeferred`/`pushCandidate`/`store`/`drainPendingEvents`/`withdrawPending`/`promotePending`/`modelFacts`/`blob`/`reportUsage`/`llmStalls`/`cognition`/`log`） |
| B14 | `docs/worlds.md:41-56` | `trigger` 五档语义 |
| B15 | `docs/worlds.md:58-71` | `EventEnvelope` 字段；`origin` 规则；`ToolOutcome`；**工具名全局唯一、前缀约定、冲突拒绝挂载**；`<PREFIX>_TOOL_DECLS` 约定 |
| B16 | `docs/worlds.md:73-90` | `WorldDefinition` 字段；`WorldContext`（`cfg`/`timezone`/`botName`/`botDir`/`packageDir`/`dataDir`/`repoRoot`/`secret`/`storeSecret`/`persist`/`restart`）；`x-hot` 语义；`dataDir` 共用与命名前缀 |
| B17 | `docs/worlds.md:167-179` | 内建 World 表（console/qq/bilibili/minecraft/websearch/webui-fixture）；`websearch` 是最短的源码参照 |
| B18 | `docs/worlds.md:131-165` | PWSR（Persona–World 状态对账）：「bot 从 Memory 读取记录,再调用 World 工具登记;**World 不直接读取 Memory**」 |
| B19 | `docs/world-compatibility.md:1-8, 51-67` | L1–L4 能力分级；World 对照表（`websearch` = L1） |
| B20 | `src/extensions/manifest.ts:14-55` | `EXTENSION_KINDS`、`EXTENSION_API_VERSIONS = {world:6, provider:6, bot:7}`、`EXTENSION_KEYWORDS`、`FRAMEWORK_SPECIFIER='cortico'`、`ExtensionManifest` 接口 |
| B21 | `src/extensions/manifest.ts:100-188` | `parseExtensionManifest`：`type!=='module'` 拒绝、`cortico` 缺失拒绝、`api` 严格相等（`:128-140`）、`webUi*`/`describe` 校验、keyword 仅 warning |
| B22 | `src/extensions/runtime.ts:1-45` | `registerHooks` 把 `cortico/*` 映射到框架 `src/*`；`childExecArgv()` 保留加载器 |
| B23 | `src/world.ts:29-48` | `WorldContext` 完整字段（**无 `memoryDir`**） |
| B24 | `src/world.ts:50-89` | `WorldDefinition` / `WorldDescribe` / `describeTools()` |
| B25 | `src/world.ts:451-462` | `toolClash()`：与保留名或已挂载 World 工具同名 → 拒绝挂载 |
| B26 | `src/world.ts:485-505` | `context()`：`botDir=rootDir`、`dataDir`、`storeSecret` 写 `.env`、`persist`、`restart` |
| B27 | `src/core/types.ts:195-200` | `ToolTag = 'read'\|'write'\|'speak'\|'act'\|'flow'\|'snapshot'`；`write` = 「修改 Memory 或 World 的内部记录」 |
| B28 | `src/core/types.ts:262-280` | `ToolDef`（含 `barrierAfter`/`endsTurn`/`interruptible`/`handler`） |
| B29 | `src/core/types.ts:447-456` | `OutputTap { onEvent, externalizes?, onRoundEnd?, onAbort? }` |
| B30 | `src/core/types.ts:600-620` | `TriggerMode` 五档 |
| B31 | `src/core/types.ts:679-780` | `WorldHost` 完整接口（含 `pushEvent` 语义、`cognition`） |
| B32 | `src/core/types.ts:903-952` | `World` 接口 |
| B33 | `src/core/types.ts:1034-1037` | `Persona.memory?: object`（「Core 不读它的内容」）+ `memoryDir` |
| B34 | `src/core/types.ts:1084-1087` | `PersonaWebUiDecl.memory`：Memory 页声明（面板/模板/存储项） |
| B35 | `src/core/config.ts:127, 173-184` | `paths: { memory: 'memory', data: 'data' }`；`LoadedConfig.memoryDir` / `dataDir` |
| B36 | `src/deploy.ts:166-167` | `memoryDir: abs(config.paths.memory)`、`dataDir: abs(config.paths.data)` |
| B37 | `src/extensions.ts:40, 97-102, 110-131` | `EXTENSIONS_DIRNAME='extensions'`、`EXTENSIONS_DIR_ENV`、`extensionsDir()`；`readInstalled()` 读 `dependencies`；`resolveExtensionEntry()` |
| B38 | `src/extensions.ts:252-282` | `loadExtensions()`：`registerFrameworkResolver()` → 遍历 `readInstalled` → 解析 manifest → `import(pathToFileURL(entry))` |
| B39 | `src/extensions.ts:769-790` | `list()` 计算 `removed`/`pending-restart`/`loaded`/`idle`/`failed` |
| B40 | `src/extensions.ts:822-823` | `updates()` 跳过 `link:`/`file:`/`workspace:` spec |
| B41 | `src/extensions.ts:1033-1051` | `check()`：本机目录只读 `package.json`、校验 `name`/`version`/`kind`（**不校验 `os`**） |
| B42 | `src/extensions.ts:1057-1074` | `install()`：`pnpm add <spec>` + `allowBuilds` 审批 |
| B43 | `src/extensions.ts:1083-1096` | `installSpec()`：path → 绝对路径 + 目录/package.json 存在校验 |
| B44 | `bots/cormini/persona/memory.ts:1-4` | 「文件式工作区记忆:路径检查、文件读写、遍历、检索、二进制附件和 Git 历史」 |
| B45 | `templates/extension/world/{package.json, src/index.ts, src/definition.ts, src/world.ts, src/config.ts, src/ENV_PROMPT.md}` | 最小 World 模板全套 |
| B46 | `tests/helpers/fake-host.ts` / `src/extensions/dry-mount.ts` | `FakeHost`、`dryMountWorld` —— 扩展单测入口 |
| B47 | `src/worlds/websearch/definition.ts:6-28`、`world.ts:1-4`、`brave-client.ts:225-233` | 只提供请求/响应工具的 World + `fetch` 样本 |
| B48 | `docs/sessions.md:20, 30` | `outputTap` 是输出流旁路（演出、字幕） |
| B49 | `src/core/loop.ts:1109-1135` | `tap.onEvent` 异常只 `log.warn`，不中断模型调用 |
| B50 | `bots/cormini/persona/persona.ts:715-728` | **`outputTap()` 扇入**：`sortedWorlds().flatMap(m => m.outputTap?.() ?? [])`，0 个不声明、1 个直通、多个则逐项转发 + `externalizes` 取 `some`；头注释「主 session 的输出旁路:挂载 World 的接收器扇成一个 tap…每批投递时现取,World 运行中挂载/卸载即生效」 |
| B51 | `tests/cormini/output-tap.test.ts:1-40` | 「`outputTap` 扇入」测试：一个 World 不给接收器时另一个照常收到；此行为属 **Cormini**，非 Core 保证 |
| B52 | `bots/cormini/persona/persona.ts:735-755` | Cormini `tools()` 是「她对记忆的全部动作面」，注释「换记忆实现就是换掉这一份的内容」—— Persona 层可改，World 不能 |

### C. 本机发行版实测（只读）

| # | 路径 | 实测结果 |
| --- | --- | --- |
| C1 | `/Applications/Coopanion.app/Contents/Info.plist` | `CFBundleShortVersionString = 0.2.10`，`LSMinimumSystemVersion 13.0` |
| C2 | `.../Contents/Resources/app/app/main.cjs:24-30` | 数据目录 `~/Library/Application Support/Coopanion`；含 `home/`(部署、endpoint、Memory)、`extensions/`(npm 装的 World 与 provider)、`logs/`、`tmp/`、`pnpm/` |
| C3 | `.../app/app/main.cjs:259-260` | `CORTICO_HOME: join(userData,'home')`、`CORTICO_EXTENSIONS_DIR: join(userData,'extensions')` |
| C4 | `.../app/app/main.cjs:273-278` | `PATH` 首位 shim 目录；`CORTICO_NODE_EXE`；`CORTICO_PNPM_CJS` |
| C5 | `.../app/app/main.cjs:304-330` | 设置窗口自有 session；扩展面板以 Core 全权运行；figure pack 代码沙箱且不可读写 Core API |
| C6 | `.../app/app/main.cjs:334` | `WINDOW_CSP = script-src 'self'; object-src 'none'; …` |
| C7 | `.../app/app/main.cjs:396-407` | 设置 session 的 `onBeforeRequest` 白名单：本机 / `RELEASE_CHECK` / `MARKET_IMAGES`，其余 `cancel` |
| C8 | `.../app/app/main.cjs:346-358` | 到桌宠服务器的转发规则（Origin / 无 referrer 帧文件） |
| C9 | `.../app/app/shims/corepack` | corepack 替身：`ELECTRON_RUN_AS_NODE=1 exec "$CORTICO_NODE_EXE" "$CORTICO_PNPM_CJS" "$@"` |
| C10 | `.../app/app/core-host.cjs:1-27` | Core 是 `fork` 出的子进程，`core/boot.ts` + `--import tsx`；崩溃 5 次/5 分钟后 `failed` |
| C11 | `.../app/app/core-env.cjs:1-19, 41-45` | `ELECTRON_RUN_AS_NODE=1`、`NODE_USE_ENV_PROXY=1`、`NO_PROXY` 补 `127.0.0.1/localhost/::1`；SOCKS 直连 |
| C12 | `.../app/build/cortico/src/worlds/` | 实测只有 `console` 与 `index.ts`（`websearch` 等已被 stage 剔除） |
| C13 | `.../app/build/cortico/src/web/server.ts:1884-1894` | `POST /api/run/restart`（落重启标志 + 规范关机，supervised 才有回执） |
| C14 | `.../app/build/cortico/src/web/server.ts:2062-2079` | `POST /api/extensions/check`（`{target:{name?,version?,path?},kind?}`） |
| C15 | `.../app/build/cortico/src/web/server.ts:2081-2090` | `POST /api/extensions/install`（`{path}` 或 `{name,version}`） |
| C16 | `.../app/build/cortico/src/extensions.ts:1083-1091` | `installSpec()` path 分支（与 B43 一致） |
| C17 | `.../app/build/cortico/src/web/path-picker.ts:245, 307` | macOS 用 `osascript`；`platform==='darwin'` → `pickMacos` |
| C18 | `~/Library/Application Support/Coopanion/extensions/` | 仅 `package.json`（`cortico-extensions`, 空 deps）、`pnpm-workspace.yaml`（0 字节）、`market-catalog.json`、`market-index.json`；**无 `node_modules/`**；目录可写 |
| C19 | `~/Library/Application Support/Coopanion/home/companion/` | `config.json`（**无 `paths` 段**）、`deployment.json`（`{"bot":"cormini"}`）、`workspace/`（`.git`、`.gitignore`、`CONSTITUTION.md`、`PARTNER.md`、`partner/`）、`data/`（`core-state.json`、`session-main.jsonl`、`usage.jsonl`、`runs/`、`instance.lock`）、`avatar.png`、`theme.json`、`guide.json`、`notice.json`、`telemetry.json` |
| C20 | `~/Library/Application Support/Coopanion/home/companion/workspace/PARTNER.md` | 实际内容（人称「Pal」、称呼、语言偏好、首次见面记录、形象）——证明这是 Coo 的长期记忆实体 |
| C21 | `~/Library/Application Support/Coopanion/extensions/market-catalog.json` | 145 个包；133 个 `kind:world`、6 个 `kind:bot`；含 `cortico-bot-memory`（`记忆归 bot 私有…无需 world`，150 下载）、`cortico-world-dream`（21 工具/8 事件，`declaredTags` 含 `memory`） |
| C22 | `~/Library/Application Support/Coopanion/extensions/market-index.json` | `schema:1`、`official:{maintainers:['phantivia'], githubOwners:['Pal-AI-Lab']}`、官方标签含 `coopanion`/`pal-ai-world`/`corti` |

### D. 外部 URL

| # | URL | 取到的内容 |
| --- | --- | --- |
| D1 | `https://api.github.com/repos/Pal-AI-Lab/Coopanion/releases/latest` | `tag_name 0.2.10`、`published_at 2026-10-25T06:35:03Z` |
| D2 | `https://registry.npmjs.org/cortico` | `dist-tags.latest = 0.2.7`，共 25 个版本 |
| D3 | `https://github.com/Pal-AI-Lab/Cortico`（子模块 origin） | Cortico 本体，子模块 pin 在 `cb9ddbd6` |
| D4 | `https://github.com/Pal-AI-Lab/cortico-extensions` | 官方索引仓（`DESIGN.md` / `TAGS.md` 为格式权威，本探索未展开） |

---

## ③ 对插件设计的影响与风险

> 以下是把上述事实折进「Cortico World 包 + Mem 双向打通」这个 D3 决定的直接含义。属**事实推论**，不是设计裁决；方案选择权归 architecture。

### 3.1 有利条件（可直接依赖）

1. **本地 sideload 路径成立**（A1 主要关切）：发行版 Extensions 页有 `local` 分段 + 系统目录选择框 + `POST /api/extensions/install {path}`，完全绕过官方市场与 npm 公开发布。开发迭代可以用 `link:` 方式装项目目录，改源码后重启 Core 即生效（B2、C15、C17）。
2. **扩展可自由访问 localhost 与外部 URL**（A3 主要关切）：Core 是完整 Node 进程；`NO_PROXY` 强制补回环，直连本机 Mem 不受系统代理干扰（B16 之上、C10、C11、C6/C7 仅限 renderer）。
3. **双向记忆的「读」与「写」都能由 World 工具承载**：`tools()` 天然是「给 Bot 的读写接口」，`tags: ['read'|'write']` 正好对应 D2 的读/写两类操作（B27、B28）。`ENV_PROMPT.md` 是告诉 Coo「何时该召回、何时该沉淀」的官方位置（B16、B45）。
4. **秘密与配置有成熟机制**：`ctx.secret()` / `ctx.storeSecret()` 存远程 Mem 的 url+key，`ConfigGroup` JSON Schema 暴露可热改旋钮（`x-hot`）（B16、B26、B45）。
5. **最小参照齐备**：模板（B45）+ 桌宠 World（A17–A19）+ `websearch`（B47）覆盖「声明 + 工具 + fetch + 配置 + 自描述」全部要素；`dryMountWorld`/`FakeHost` 支持离线单测（B46）。
6. **版本锚点清晰**：`api: 6`、`cortico ^0.2.7`，与当前发行版 0.2.10 一致（问 6、D2）。

### 3.2 风险与硬约束

| # | 风险/约束 | 证据 | 影响 |
| --- | --- | --- | --- |
| R1 | **World 不能读 Coo 的 Memory，也无法订阅「对话写入」** | B11、B23、B18 | 「Coo 对话中的新记忆自动沉淀」**不能由 World 自己感知**；必须让 Coo 主动调工具写入，或在 `ENV_PROMPT` 里训练它何时调。「读」同样只能由 Coo 主动调 `mem_search` 类工具。 |
| R2 | **`outputTap` 可捕获模型输出，但只到「增量」粒度，看不到用户输入与工具回执全文** | A19、B29、B48、**B50/B51** | **已核实可并存**：Cormini 扇入多个 World 的 tap（`bots/cormini/persona/persona.ts:715-728`）。所以扩展可以实现 `outputTap()` 拿到 Coo 的回复增量，用于「自动沉淀」。**但**：`OutputTap` 只有 `onEvent(StreamEvent)`（`types.ts:447-456`），能看 `response.output_text.delta` 与函数调用项，**看不到用户说了什么**（用户输入是 event，不是输出流）。要沉淀「对话」需同时靠 `outputTap`（Coo 说了什么）+ 事件（用户说了什么）两路拼，且增量需自行拼接去重。仍不宜作为唯一路径。 |
| R3 | **扩展默认不启用，需人工两步** | A22、B39 | 装完必须「Restart process」+ 在 World 总览启用；用户文档要写清，macOS 上无自动。**注意 `World` 段默认 `enabled:false`**（B16、模板 `config.ts`）——Coo 的 `declares` 是硬编码 3 项（A9），扩展 World 不会被默认启用。 |
| R4 | **工具名全局唯一，冲突即拒绝挂载** | B25、B15 | 必须用独特前缀（如 `nmem_`）；且不能与 Core 保留帧名、3 个内置 World 及 Persona（Cormini 文件工具）撞名。 |
| R5 | **不能直接读写 PARTNER.md，写路径需架构决策** | B11、A6、A8 | 主文档 A5 的疑问（并行写 / 仅 Mem / 用户可配）在契约层面只能靠「World 工具 + Coo 自主调用」实现并存，**不存在 hook 能在 PARTNER.md 写入时联动**。 |
| R6 | **`dataDir` ≠ `memoryDir`** | B36、C19 | 若扩展想落本地缓存/游标，用 `ctx.dataDir` 且文件名以 World id 前缀（B16），**不要**假设它与 `workspace/` 同目录。 |
| R7 | **`storeSecret` 拒绝含空白的值** | B26（`world.ts:186-196`） | 若 Mem 的 api-key 含空白字符，需先 trim 或另存（例如落到 `dataDir` 的自管配置文件）。 |
| R8 | **react 面板前端受 renderer 网络白名单约束** | C6、C7 | 若做 WebUI 面板，面板里的浏览器代码**不能**外联；所有 Mem 请求必须在 World 的 Node 侧完成，面板只经 `invoke` 与后端交互。 |
| R9 | **`websearch` 已从发行版剔除** | A15、C12 | 不能依赖发行版里的任何内建「外部 API」World 存在；只能自带实现。 |
| R10 | **契约升级会让扩展「需要升级」并被拒载** | B9、B21 | 无产品级兼容承诺；world 6→7 时旧包直接不加载（虽有一版过渡层，但 `check:extension` 判失败，且下个大版本删除）。需在 README 标注「随 Coopanion 大版本升级需跟进」。 |
| R11 | **`check:extension` 不验证真实服务** | B8（`extensions.md:278-280`） | 通过 check ≠ 能连上 Mem；验收必须靠本机实测（D6 已具备条件）。 |
| R12 | **CG 缺 git 时工作区版本历史失效** | A21 | macOS 需系统装有 git；与本插件无直接冲突，但「Coo 记忆已有版本历史」的事实要写进设计前提，避免重复建设。 |
| R13 | **市场 `os` 限制只影响市场 UI** | B2（`extensions.md:43`）、B41 | 本地 path 安装不校验 `os`；但若要上架，需正确声明 `os`（本插件跨平台）与 `local` 等标签（A4 要求声明）。 |
| R14 | **`outputTap` 看不到用户输入** | B29、`bots/cormini/persona/persona.ts:715-728` | 「对话沉淀」若靠输出流，只能拿到 Coo 的回复；用户消息是 `EventEnvelope` 进上下文，World 只能 `host.store` 读到**自己推的**事件，读不到桌宠推的用户消息（`desktop-pet.message` 的 `source` 是桌宠 World）。因此自动沉淀仍需 Coo 主动调工具，或由事件 + tap 组合推断。 |

### 3.3 与主文档假设的对照

| 假设 | 探索结论 |
| --- | --- |
| A1「发行版允许本地第三方扩展 sideload，无需进市场」 | **成立**（C15–C17、B2）。补充限定：走 `pnpm add`（应用内置 pnpm + Electron Node），装完需重启 Core 并手动启用。 |
| A3「扩展运行环境可对 localhost 与远程 URL 发 HTTP(S)」 | **成立**（C10、C11、B16 之上的 Node 能力；本机回环免代理）。限定：renderer 侧受限（C7）。 |
| （新增）「扩展可读 Coo 现有记忆（PARTNER.md）」 | **不成立**。契约明确禁止 World 访问 Memory（B11、B23）。 |
| （新增）「扩展能自动捕获对话内容用于沉淀」 | **部分成立**：`outputTap` 可与桌宠并存（扇入，`bots/cormini/persona/persona.ts:715-728`），能拿到 Coo 的回复增量；但拿不到用户输入（R14），且只能读到本 World 自己的事件库。完全自动的「双向对话沉淀」仍需 Coo 主动调工具。 |

---

## ④ 未决问题（需要 orchestrator / architecture 处理）

1. **【需 architecture 裁决】写路径与 PARTNER.md 的关系**（对应主文档 A5）。契约层面 World 无法感知 PARTNER.md 的写入，也无法自动挂到 Coo 的记忆流；可行方案只有「World 提供 `nmem_*` 工具 + 由 Coo 自主调用」，因此「并行写 / 仅 Mem / 用户可配」三选一必须在**提示词策略层**（`ENV_PROMPT.md`）落地，而不是代码 hook。请确认这是否可接受，以及是否需要一个把「何时必须沉淀」写成硬规则的 env prompt 设计。
2. **【需 architecture 裁决】读召回的触发方式**。既然 World 不能自动注入记忆到上下文，`mem_search` 只能由 Coo 主动调。需要决定：是纯工具（模型自主）、还是在 `envPromptVars()` 里做「会话开场提示」（`World.envPromptVars()` 每次前缀重建都会调用，`worlds.md:16`，理论上可在此处做同步/缓存的召回）。后者涉及「每轮前缀重建都打 Mem」的成本与延迟，属架构取舍。
3. **【需 orchestrator 决策】发布形态与依赖**。本地 sideload 成立，但上不上官方市场（`Pal-AI-Lab/cortico-extensions`）会决定是否需要 `tags`/`locales`/`screenshots`/`CHANGELOG` 与 `os`/`local` 标签（B4、B2:43）。也决定是否需要一次性把 `describe.json` 与 `check:extension` 纳入 CI。
4. **【需 orchestrator 决策】验收步骤与文档口径**。需明确「安装 = 装包 → Restart process → World 总览启用」这三步的验收脚本（C13、A22），并确认 macOS 上是否需要 git（A21 显示 macOS 需系统 git，与本插件无关但会影响「记忆版本」的用户说明）。
5. **【需 architecture 确认】是否复用 `cortico-bot-memory` 一类 bot 包思路**。C21 显示市场已有 bot 形态的长期记忆扩展（替换 Persona）。若走 World 路线则内置记忆完全保留；两条路互斥（一个进程只跑一个 bot，B6）。请明确排除 bot 路线的理由，以免后续重复评估。
6. **【需 architecture 决策】`outputTap` 是否作为「对话自动沉淀」的来源**。**已核实可多路复用**：Cormini 把所有 World 的 tap 扇成一个（`bots/cormini/persona/persona.ts:715-728`，测试 `tests/cormini/output-tap.test.ts:30-40`），所以扩展可以和桌宠并存。但 `OutputTap` 只给模型输出增量，**拿不到用户输入**（R14），且增量需自行拼接。请决定：① 只用工具（Coo 主动调）② 工具 + `outputTap` 兜底（能记 Coo 说了什么，记不全用户说了什么）③ 其它。
7. **【需确认】面板是否要做**。若不做 WebUI 面板，则完全规避 R8；配置改由 `ConfigGroup` 旋钮承担（B16、模板 `config.ts`）。这属产品取舍，不在探索范围。

---

## 附：本探索未覆盖 / 未验证的边界

- ~~未验证多个 World 同时实现 `outputTap()` 时的合并语义~~ —— **已核实**：扇入实现在 `bots/cormini/persona/persona.ts:715-728`，有测试 `tests/cormini/output-tap.test.ts`。注意这是 **Cormini（即 Coo 的 Persona 基类）** 的行为，不是 Core 的保证。
- 未验证 `outputTap` 收到的 `StreamEvent` 具体能覆盖哪些字段（只确认 `types.ts:447-456` 的签名与 `loop.ts:1210` 的转发点），也未验证增量拼接的边界（重试、`preempt` 取消后的残留）。
- 未展开官方索引仓的 `DESIGN.md` / `TAGS.md` 具体格式（D4，仅确认其存在与用途）。
- 未实际执行安装（只读边界；本机 `extensions/` 至今无 `node_modules/`），因此「path 安装 + 重启后加载」是**静态路径成立**，不是运行证明。
- 未验证 `check:extension` / `describe:extension` 在本机的实际输出（需先在项目内建包，属实现阶段）。
- 未核查 Nowledge Mem 侧 API（属 EXPLORE-NMEM-API）。
