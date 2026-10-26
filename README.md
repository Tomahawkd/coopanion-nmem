# cortico-world-nmem

为 [Coopanion](https://github.com/Pal-AI-Lab/Coopanion) 的桌宠 Coo 提供 Nowledge Mem 记忆库接入的 Cortico World 扩展（`kind: world`，`api: 6`，TypeScript / ESM，零运行时依赖）。

它把 Coo 与 Nowledge Mem 双向打通：**读**——Coo 在需要回忆时检索/读取 Mem；**写**——对话中出现的持久事实、偏好与决定可沉淀进 Mem。Coo 内置的 `PARTNER.md` 工作记忆不受影响，两套记忆并行维护。

World 只提供工具，何时调用由 Coo 自行决定（框架不提供对话写入 hook，World 也读不到 Coo 的记忆）。

## 三个工具

| 工具 | 读写 | 作用 | 主要参数 |
| --- | --- | --- | --- |
| `nmem_search` | 读 | 在 Mem 中混合检索，返回 id、标题、相似度与摘要 | `query`（必填，1–500 字符）；`limit`（1–10，缺省取 `searchLimit`）；`mode`（`fast`/`deep`，缺省取 `searchMode`） |
| `nmem_get` | 读 | 按 id 读取一条记忆全文 | `id`（必填） |
| `nmem_save` | 写 | 写入一条记忆；带 `id` 时按服务端 upsert 更新既有记忆 | `content`（必填，1–30000 字符）；`title?`；`unit_type?`；`labels?`；`id?`；`importance?` |

`nmem_save` 恒写入溯源字段：`source: "coopanion"`、`source_app: "cortico-world-nmem"`、`agent_id`（取 `agentId` 旋钮，缺省 `coopanion`），并默认并入 label `coopanion`。写入回执会报告 `id` 与 `action`（`created` 或 `updated`）。

## 环境前提

- **Coopanion ≥ 0.2.10**（本机验收版本 0.2.10）。
- **Nowledge Mem** 可运行；本机默认 API 基址 `http://127.0.0.1:14242`（验收版本 0.10.108）。
- 本机 Mem 免 API key；远程/启用 key 的 Mem 需要额外配置 `NMEM_API_KEY`（见下文）。

## 安装（三步）

1. 打开 Coopanion **设置 → 高级模式 → Extensions 页**，在 **local** 分段选择本仓库目录，点 **Install**（以 `link` 方式安装本包）。
2. **Restart process**（重启 Coopanion 进程；等价于 `POST /api/run/restart`），让新扩展被加载。
3. 在 **World 总览**里启用 `nmem`（默认 `enabled: false`）。

启用后三工具对 Coo 可用，事件流中出现一条 `nmem.started`。

## 配置（四个旋钮）

全部落在 `worlds.nmem.*` 段，可在设置页/`POST /api/config`（group `world:nmem`）修改。

| 旋钮 | 类型 / 缺省 | 生效方式 | 说明 |
| --- | --- | --- | --- |
| `worlds.nmem.baseUrl` | string / `http://127.0.0.1:14242` | **改动需重启** | Mem HTTP API 基址。远程填 `https://<host>`。 |
| `worlds.nmem.searchLimit` | integer 1..10 / `5` | 热改 | `nmem_search` 未指定 `limit` 时的条数。 |
| `worlds.nmem.searchMode` | `fast` \| `deep` / `fast` | 热改 | `nmem_search` 缺省模式；工具参数可按次覆盖。交互场景建议 `fast`。 |
| `worlds.nmem.agentId` | string / `coopanion` | 热改 | 写入 Mem 的 `agent_id` 溯源标识。 |

`agentId` 必须满足 Mem 对 agent profile id 的约束：**以小写字母或数字起始，仅含小写字母、数字与 `_` `.` `:` `-`**。本插件配置面虽带 `pattern: "^[a-z0-9][a-z0-9_.:-]*$"` 声明，但当前框架（表单与 Core）不执行该 pattern 校验——**服务端才是权威**：非法值（例如中文 displayName）会被 Mem 以 `422` 拒绝，`nmem_save` 回执为失败。

## 秘密（API key）

远程或启用 key 的 Mem 需要 API key。本扩展**没有面板**，key 由用户手动写入 Coopanion 的部署 `.env`：

- 文件路径：`~/Library/Application Support/Coopanion/home/companion/.env`
- 文件不存在则创建，写入一行：`NMEM_API_KEY=nmem_...`
- 值不得含空白字符（框架的 `storeSecret` 拒绝含空白值；CLI/手工写入同样应遵守）
- key 只经部署 `.env` 提供：**不写入 `config.json`、不写日志、不在工具回执或错误信息中回显**
- 本机免 key 的 Mem 不要配 key：本机服务带错 key 反而会返回 `401`，客户端在未配置 key 时**完全不发送** `Authorization` 头

写入 `.env` 后重启 Coopanion 让客户端读到新 key（客户端在 World 创建时构造）。

## 远程模式（未实测）

本期仅完成本地验收（决策 D9），**远程路径未实测**，以下为配置步骤与对照参考，非实测结论。

两步配置：

1. 设置页把 `worlds.nmem.baseUrl` 改为 `https://<host>`，然后重启 Coopanion（`baseUrl` 非热改）。
2. 在部署 `.env` 写入 `NMEM_API_KEY=nmem_...`，再重启一次使客户端带上 key。

对照 Nowledge Mem CLI 的等价设置（两条命令是**两次独立调用**，不是一次带两个参数的调用）：

```bash
nmem config client set --url https://<host>
nmem config client set --api-key nmem_...
```

远程模式务必启用 key：远程端点若要求鉴权，缺少 key 会得到 `401`（工具回执为认证失败）。

## 安全说明

- 本机 Nowledge Mem 的 `nmem-server` 实测监听 **`*:14242`（全部网卡）**，并非仅 `127.0.0.1`。这意味着同一网络内的其他设备可以访问该 API。**不受信网络环境请注意这个暴露面**（可自行用系统防火墙限制，或改为仅回环监听）。
- 远程模式务必启用 API key（见上节）。
- 本扩展只向配置的 `baseUrl` 发起请求，不向其他地址外联，也不回显 key。

## 验收 runbook（场景 A–D；E 本期不执行）

每项建议同时留两类证据：Coo 的行为记录（会话函数调用与回执）与 Mem 端核对输出（`GET /memories/{id}` 等）。下面命令以本机默认地址为例。

### 场景 A：读召回命中

1. 预置一条独特事实，例如：
   ```bash
   curl -s -X POST http://127.0.0.1:14242/memories -H 'Content-Type: application/json' \
     -d '{"id":"coopanion-nmem-accept-a","content":"用户的猫叫 Pixel","labels":["coopanion","acceptance"],"source":"coopanion","source_app":"cortico-world-nmem","agent_id":"coopanion"}'
   ```
2. 问 Coo「我的猫叫什么名字？」。
3. 期望：Coo 调用 `nmem_search`，并在回答里引用「Pixel」。核对后可用 `DELETE /memories/coopanion-nmem-accept-a` 清理预置条目。

### 场景 B：写沉淀

1. 告诉 Coo 一条新的持久事实并要求记住。
2. 期望：Coo 调用 `nmem_save`；Mem 端可检索到该条，`labels` 含 `coopanion`，`source` 为 `coopanion`，`metadata.agent_id` 为 `coopanion`。
3. 再要求补充同一事实：期望 Coo 带**同一个 `id`** 走 upsert（回执 `action: updated`），而不是新建第二条。

### 场景 C：断连

1. 完全退出 Nowledge Mem（服务不可达）。
2. 问 Coo 一个记忆问题。
3. 期望：工具回执为 `failed`（文案为「Nowledge Mem 不可达:请确认 Mem 正在运行,且 baseUrl 配置正确。」），Coo 简短告知 Mem 不可用并继续对话；Coopanion 进程不崩溃、不挂起。
4. 重新启动 Mem 后，下一轮对话恢复可用。

### 场景 D：旋钮热改

1. 改 `worlds.nmem.searchLimit`（如 5 → 2）与 `worlds.nmem.searchMode`（`fast` → `deep`），**不重启**；期望下一轮 `nmem_search` 缺省条数与模式随之变化（回执条数变化、`deep` 时延迟上升）。
2. 把 `baseUrl` 改成错误值并重启 Coopanion；期望表现为场景 C（连接失败 → `failed` 回执，进程稳定）。
3. 恢复 `baseUrl` 缺省值并再次重启。

### 场景 E：远程

本期不执行（未实测，见「远程模式」一节的标注）。

## 契约测试（对本机真实 Mem，opt-in）

`tests/contract.nmem.test.ts` 用全局 `fetch` 直连真实 Mem 服务，不 import 本包源码，因此不计入默认 `pnpm test` 的断言面：**未设门控变量时全部 skip**（vitest 报告中显式显示 skipped）。

```bash
NMEM_CONTRACT_BASE_URL=http://127.0.0.1:14242 npx -y pnpm@11.28.6 vitest run tests/contract.nmem.test.ts
```

- 门控变量 `NMEM_CONTRACT_BASE_URL` 未设 → 全部用例 skip；已设但服务不可达 → 用例**失败**并给出明确错误信息（不会静默跳过）。变量为空串时回落到默认值 `http://127.0.0.1:14242`。
- 覆盖内容：`GET /health` 探活；数据端点鉴权（带无效 key → `401`，不带鉴权头 → `200`；探活端点不鉴权，不能用来验鉴权）；`POST /memories/search` 的 `fast` 结果逐元素形态（`memory` 可为 `null`、`similarity_score` 为数值）与 `deep` 耗时信息记录（无阈值断言）。
- 沙箱写读回：固定探针 id **`coopanion-nmem-contract-probe`**（labels `coopanion,contract-test`，溯源字段与插件写路径一致），断言 `action ∈ {created, updated}`、读回内容与 `metadata` 溯源字段一致，随后 `DELETE /memories/{id}` 自动清理并断言再读为 `404`。重复运行不会累积数据。
- `agent_id` 规则：缺省 `coopanion` 可正常写入（由上一条承载）；中文样本 `大肥鱼` → 断言 Mem 返回 `422`（响应体摘要会打印留证）。
- 契约测试会写入真实 Mem，但仅限上述固定探针 id，且运行结束即删除。

## License

MIT
