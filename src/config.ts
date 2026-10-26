import type { ConfigGroup, ConfigProperty } from 'cortico/core/types.ts';

/** config.json 的 worlds.nmem 段,默认禁用;bot 或部署可启用。 */
export interface NmemConfigSection {
  enabled: boolean;
  /** Nowledge Mem 的 HTTP API 基址;改动需重启 World。 */
  baseUrl: string;
  /** `nmem_search` 的缺省结果条数;热改。 */
  searchLimit: number;
  /** `nmem_search` 的缺省检索模式;热改。 */
  searchMode: 'fast' | 'deep';
  /**
   * 写入 Mem 的 `agent_id` 溯源标识;热改。须满足 Mem 对 agent profile id 的约束:
   * 小写字母或数字起始,仅含小写字母、数字与 `_.:-`(中文会被 Mem 拒绝)。
   */
  agentId: string;
}

/** 部署 `.env` 里的 Mem API key 名;本机 Mem 免 key。 */
export const NMEM_API_KEY = 'NMEM_API_KEY';

export const NMEM_DEFAULTS: NmemConfigSection = {
  enabled: false,
  baseUrl: 'http://127.0.0.1:14242',
  searchLimit: 5,
  searchMode: 'fast',
  agentId: 'coopanion',
};

/**
 * 配置项声明:`pattern` 是 JSON Schema 的字符串约束关键字(声明面携带;当前框架表单与
 * Core 均不执行该校验,非法值由 Mem 服务端拒绝),
 * 当前框架的 `ConfigProperty` 尚未声明它,故本地补齐后按结构兼容交给 `ConfigGroup`。
 */
interface NmemConfigProperty extends ConfigProperty {
  pattern?: string;
}

interface NmemConfigGroup extends ConfigGroup {
  schema: {
    type: 'object';
    title: string;
    description?: string;
    properties: Record<string, NmemConfigProperty>;
  };
}

const NMEM_CONFIG_DECL: NmemConfigGroup = {
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
      'worlds.nmem.agentId': {
        type: 'string',
        title: 'agent_id 溯源标识',
        description:
          '写入 Nowledge Mem 的 agent_id。须以小写字母或数字开头,仅含小写字母、数字与 _ . : -（中文如 displayName 会被 Mem 拒绝 422）。',
        pattern: '^[a-z0-9][a-z0-9_.:-]*$',
        'x-hot': true,
      },
    },
  },
};

/** World 配置的 JSON Schema 声明。全部路径落在 `worlds.nmem.` 段内。 */
export const NMEM_CONFIG_GROUP: ConfigGroup = NMEM_CONFIG_DECL;
