import { describeTools, type WorldDefinition } from 'cortico/world.ts';
import { NMEM_API_KEY, NMEM_DEFAULTS, type NmemConfigSection } from './config.ts';
import { MemClient } from './mem/client.ts';
import { NMEM_TOOL_DECLS } from './tools.ts';
import { NmemWorld } from './world.ts';

export const NMEM: WorldDefinition<NmemConfigSection> = {
  id: 'nmem',
  label: 'Nowledge Mem',
  defaults: () => ({ ...NMEM_DEFAULTS }),
  create: (ctx) =>
    new NmemWorld({
      cfg: ctx.cfg,
      timezone: ctx.timezone,
      botName: ctx.botName,
      client: new MemClient({ baseUrl: ctx.cfg.baseUrl, apiKey: ctx.secret(NMEM_API_KEY) }),
    }),
  describe: {
    tools: describeTools(NMEM_TOOL_DECLS, {
      nmem_search: {
        zh: '在 Nowledge Mem 长期记忆库里检索记忆,返回 id、标题、相似度与摘要。',
        en: 'Searches the Nowledge Mem library and returns ids, titles, similarity scores and excerpts.',
      },
      nmem_get: {
        zh: '按 id 读取一条记忆的全文。',
        en: 'Reads one Nowledge Mem memory in full by id.',
      },
      nmem_save: {
        zh: '把一条值得长期保留的记忆写入 Nowledge Mem;带 id 时更新既有记忆。',
        en: 'Saves a durable memory to Nowledge Mem; an id updates the existing memory.',
      },
    }),
    events: [
      { type: 'nmem.started', description: { zh: 'World 挂载完成。', en: 'The World was mounted.' } },
    ],
  },
};
