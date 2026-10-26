import { fileURLToPath } from 'node:url';
import type { ToolDef, World, WorldHost, WorldWebUiDecl } from 'cortico/core/types.ts';
import { nowIso } from 'cortico/core/util.ts';
import { NMEM_CONFIG_GROUP, type NmemConfigSection } from './config.ts';
import { nmemTools, type NmemToolClient } from './tools.ts';

const ENV_PROMPT_FILE = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));

export interface NmemWorldOptions {
  /** `worlds.nmem` 的活引用:工具每次调用现读缺省条数、检索模式与 `agent_id`。 */
  cfg: NmemConfigSection;
  timezone: string;
  /** Mem 客户端;组合根注入真实 `MemClient`,测试注入手写 fake。 */
  client: NmemToolClient;
}

/** Nowledge Mem World:挂载事件 + 搜索/读取/沉淀三个记忆工具。 */
export class NmemWorld implements World {
  readonly id = 'nmem';

  constructor(private readonly opts: NmemWorldOptions) {}

  /** 环境模板没有变量;这里只报空表,不做任何 I/O。 */
  envPromptVars(): Record<string, string> {
    return {};
  }

  tools(): ToolDef[] {
    return nmemTools({ client: this.opts.client, cfg: this.opts.cfg });
  }

  webUi(): WorldWebUiDecl {
    return {
      config: [NMEM_CONFIG_GROUP],
      promptDocs: [
        {
          key: 'worlds.nmem.envPrompt',
          title: 'Nowledge Mem · 环境提示词',
          description: '告诉 Coo 本 World 的用途与当前能力边界。',
          path: ENV_PROMPT_FILE,
          role: 'envPrompt',
          vars: [],
        },
      ],
    };
  }

  /** 挂载时投递状态事件;origin: internal 表示 World 的内部机制事件。 */
  async start(host: WorldHost): Promise<void> {
    await host.pushEvent({
      type: 'nmem.started',
      ts: nowIso(this.opts.timezone),
      source: this.id,
      origin: 'internal',
      senderKey: this.id,
      text: 'Nowledge Mem World 已挂载,nmem_search/nmem_get/nmem_save 可用。',
    });
  }

  async stop(): Promise<void> {}
}
