import { fileURLToPath } from 'node:url';
import type { ToolDef, World, WorldHost, WorldWebUiDecl } from 'cortico/core/types.ts';
import { nowIso } from 'cortico/core/util.ts';
import { NMEM_CONFIG_GROUP, type NmemConfigSection } from './config.ts';

const ENV_PROMPT_FILE = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));

export interface NmemWorldOptions {
  /** `worlds.nmem` 的活引用。 */
  cfg: NmemConfigSection;
  timezone: string;
}

/** Nowledge Mem World:当前只提供挂载事件,记忆工具由后续任务接入。 */
export class NmemWorld implements World {
  readonly id = 'nmem';

  constructor(private readonly opts: NmemWorldOptions) {}

  /** 环境模板没有变量;这里只报空表,不做任何 I/O。 */
  envPromptVars(): Record<string, string> {
    return {};
  }

  tools(): ToolDef[] {
    return [];
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
      text: 'Nowledge Mem World 已挂载。',
    });
  }

  async stop(): Promise<void> {}
}
