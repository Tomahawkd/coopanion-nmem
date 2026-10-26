# AGENTS.md

本仓库的工程规约。改动或评审代码前先按第 1 条读共享工程标准。

1. 改动/评审代码前先读 `../codeharness/docs/engineering-standards.md`（覆盖 TS）。
2. 类型保真：具体类型端到端；Mem 响应在 client ingress 一次性收窄；禁 `any`/`unknown` 宽化、断言、序列化往返绕边界；`JSON.stringify` 仅限 client 的 HTTP 请求体出口（如门禁不识别，按 `docs/dev/coopanion-mem-plugin/architecture.md` §4.1 加声明而非绕过）。
3. 架构边界以 `.codeharness/code-harness.json` 为准并与实现一致；策略变更需全量审计 + architecture 审查。
4. 完成前跑：`pnpm typecheck`（`tsc --noEmit`——门禁不做类型推断，TS 项目必须配类型感知检查器）、`pnpm test`（vitest run）、`pnpm test:coverage`（v8，语句/分支报告与缺口检视为交付证据；未配置阈值）、以及（codeharness 环境就绪后）在 `../codeharness` 下 `uv run --no-sync code-harness --root <本仓库绝对路径> --all`。变异实证为补充证据，不替代覆盖测量，两者均记入 worklog。
5. **不自动回滚/还原/丢弃/删除代码改动**；门禁只读；不得以排除文件、调高阈值、刷新 baseline 制造通过。
6. 不写实现注释与压制注释（JS/TS 唯一例外：批准的 next-line 诊断压制，须带精确规则 ID 与理由）。
7. `describe.json` 与工具声明保持同步（一致性测试守护）；dry-mount/check 通过 ≠ 联网可用（`check:extension` 不验证真实服务）。
8. 秘密读取遵循框架 `ctx.secret()` 语义（进程环境变量优先于部署 `.env`；`NMEM_API_KEY`），key 仍不得进 config.json、日志、回执或测试快照。
