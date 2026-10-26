import type { ConfigGroup } from 'cortico/core/types.ts';

/** config.json 的 worlds.nmem 段,默认禁用;bot 或部署可启用。 */
export interface NmemConfigSection {
  enabled: boolean;
  /** Nowledge Mem 的 HTTP API 基址;改动需重启 World。 */
  baseUrl: string;
  /** `nmem_search` 的缺省结果条数;热改。 */
  searchLimit: number;
  /** `nmem_search` 的缺省检索模式;热改。 */
  searchMode: 'fast' | 'deep';
}

export const NMEM_DEFAULTS: NmemConfigSection = {
  enabled: false,
  baseUrl: 'http://127.0.0.1:14242',
  searchLimit: 5,
  searchMode: 'fast',
};

/** World 配置的 JSON Schema 声明。全部路径落在 `worlds.nmem.` 段内。 */
export const NMEM_CONFIG_GROUP: ConfigGroup = {
  id: 'world:nmem',
  owner: 'world:nmem',
  schema: {
    type: 'object',
    title: 'Nowledge Mem',
    description: 'Coo 与 Nowledge Mem 记忆库的连接参数。',
    properties: {
      'worlds.nmem.baseUrl': {
        type: 'string',
        title: 'Mem API 基址',
        description: '本机默认 http://127.0.0.1:14242;远程填 https://<host>。改动需重启。',
        'x-hot': false,
      },
      'worlds.nmem.searchLimit': {
        type: 'integer',
        title: '缺省结果条数',
        description: 'nmem_search 未指定 limit 时取此值。',
        minimum: 1,
        maximum: 10,
        'x-hot': true,
      },
      'worlds.nmem.searchMode': {
        type: 'string',
        title: '缺省检索模式',
        description: 'fast 延迟低;deep 更完整。工具参数可按次覆盖。',
        enum: ['fast', 'deep'],
        'x-hot': true,
      },
    },
  },
};
