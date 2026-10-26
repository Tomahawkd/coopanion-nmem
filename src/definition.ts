import { describeTools, type WorldDefinition } from 'cortico/world.ts';
import { NMEM_DEFAULTS, type NmemConfigSection } from './config.ts';
import { NmemWorld } from './world.ts';

export const NMEM: WorldDefinition<NmemConfigSection> = {
  id: 'nmem',
  label: 'Nowledge Mem',
  defaults: () => ({ ...NMEM_DEFAULTS }),
  create: (ctx) => new NmemWorld({ cfg: ctx.cfg, timezone: ctx.timezone }),
  describe: {
    tools: describeTools([], {}),
    events: [
      { type: 'nmem.started', description: { zh: 'World 挂载完成。', en: 'The World was mounted.' } },
    ],
  },
};
