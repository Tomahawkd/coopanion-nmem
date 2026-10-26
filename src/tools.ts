import type { ToolDef, ToolOutcome } from 'cortico/core/types.ts';
import type { NmemConfigSection } from './config.ts';
import {
  MemAuthError,
  MemHttpError,
  MemProtocolError,
  MemRateLimitError,
  MemServerError,
  MemTransportError,
} from './mem/client.ts';
import type {
  MemoryHit,
  MemoryRecord,
  MemorySavePayload,
  MemorySaveResult,
  MemorySearchMode,
  MemorySearchOptions,
  MemoryUnitType,
} from './mem/types.ts';

const QUERY_MAX = 500;
const LIMIT_MAX = 10;
const ID_MAX = 200;
const CONTENT_MAX = 30000;
const SUMMARY_MAX = 200;
const TITLE_MAX = 80;
const DEFAULT_LABEL = 'coopanion';
const SOURCE = 'coopanion';
const SOURCE_APP = 'cortico-world-nmem';

const UNIT_TYPES: readonly MemoryUnitType[] = [
  'fact',
  'preference',
  'decision',
  'plan',
  'procedure',
  'learning',
  'context',
  'event',
];

const QUERY_EMPTY_TEXT = '检索词不能为空:请提供 1–500 字符的检索词。';
const LIMIT_TEXT = 'limit 必须是 1–10 的整数。';
const MODE_TEXT = 'mode 必须是 fast 或 deep。';
const GET_ID_TEXT = 'id 不能为空:请传入要读取的记忆 id。';
const CONTENT_EMPTY_TEXT = 'content 不能为空:请提供 1–30000 字符的记忆内容。';
const SAVE_ID_EMPTY_TEXT = 'id 不能为空(新建请直接省略该参数)。';
const TITLE_TEXT = 'title 必须是字符串。';
const UNIT_TYPE_TEXT =
  'unit_type 必须是 fact/preference/decision/plan/procedure/learning/context/event 之一。';
const LABELS_TEXT = 'labels 必须是字符串数组。';
const IMPORTANCE_TEXT = 'importance 必须是 0–1 的数值。';
const TRANSPORT_TEXT = 'Nowledge Mem 不可达:请确认 Mem 正在运行,且 baseUrl 配置正确。';
const AUTH_TEXT = 'Nowledge Mem 认证失败:API key 无效或已轮转,请检查 NMEM_API_KEY 配置。';
const RATE_LIMIT_TEXT = 'Nowledge Mem 限流,请稍后再试。';
const SERVER_TEXT = 'Nowledge Mem 服务端错误,请稍后再试。';
const PROTOCOL_TEXT = 'Nowledge Mem 响应异常,可能版本不兼容。';
const UNEXPECTED_TEXT = 'Nowledge Mem 工具执行失败:发生未预期的错误。';

/** 工具层消费的 Mem 客户端面;`MemClient` 与测试里的手写 fake 都实现它。 */
export interface NmemToolClient {
  searchMemories(query: string, options?: MemorySearchOptions): Promise<MemoryHit[]>;
  getMemory(id: string): Promise<MemoryRecord | null>;
  saveMemory(payload: MemorySavePayload): Promise<MemorySaveResult>;
}

/** 装配工具所需的三项依赖。 */
export interface NmemToolDeps {
  client: NmemToolClient;
  /** `worlds.nmem` 的活引用:每次调用现读缺省条数与检索模式。 */
  cfg: NmemConfigSection;
  /** 写进 `agent_id` 的溯源身份。 */
  botName: string;
}

/** 参数校验的一次性收窄结果:通过时带具体输入,失败时带可直接返回的回执。 */
type Validated<T> = { ok: true; value: T } | { ok: false; outcome: ToolOutcome };

/** 框架交给工具 handler 的原始入参(模型给出的 JSON,未经收窄);校验函数在这里一次性收窄成具体输入。 */
export type NmemToolArgs = Parameters<ToolDef['handler']>[0];

/** 全部工具的声明;`describe` 自描述与实例 `tools()` 都取它。 */
export const NMEM_TOOL_DECLS: ReadonlyArray<Omit<ToolDef, 'handler'>> = [
  {
    name: 'nmem_search',
    description:
      'Search the Nowledge Mem long-term memory library and return matching memories with ids, titles, similarity scores and short excerpts. Use nmem_get with an id to read one memory in full.',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          maxLength: QUERY_MAX,
          description:
            'What to look for: a topic, a person, a preference, a past decision or a project.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: LIMIT_MAX,
          description: 'How many memories to return; defaults to the configured searchLimit.',
        },
        mode: {
          type: 'string',
          enum: ['fast', 'deep'],
          description:
            'Search mode: fast is low latency, deep is more exhaustive; defaults to the configured searchMode.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'nmem_get',
    description:
      'Read one Nowledge Mem memory in full by id. Use ids from nmem_search receipts; a missing id returns a not-found message instead of an error.',
    tags: ['read'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: {
          type: 'string',
          minLength: 1,
          description: 'The memory id, as returned by nmem_search or nmem_save.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'nmem_save',
    description:
      'Save a durable memory to the Nowledge Mem library. Omit id to create a new memory; pass an id from nmem_search to update that memory in place (upsert). Keep one memory focused, self-contained and under 30000 characters.',
    tags: ['write'],
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: {
          type: 'string',
          minLength: 1,
          maxLength: CONTENT_MAX,
          description: 'The memory itself, written so it still makes sense out of this conversation.',
        },
        id: {
          type: 'string',
          minLength: 1,
          maxLength: ID_MAX,
          description: 'Id of an existing memory to update; omit it to create a new memory.',
        },
        title: { type: 'string', description: 'Short title shown in search receipts.' },
        unit_type: {
          type: 'string',
          enum: ['fact', 'preference', 'decision', 'plan', 'procedure', 'learning', 'context', 'event'],
          description: 'What kind of knowledge this memory holds.',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extra labels for filtering in Nowledge Mem; the coopanion label is always added.',
        },
        importance: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'How important the memory is, from 0 to 1.',
        },
      },
      required: ['content'],
    },
  },
];

/** 按依赖装配三个记忆工具的 handler;每次调用现读 `cfg`。 */
export function nmemTools({ client, cfg, botName }: NmemToolDeps): ToolDef[] {
  return [
    { ...NMEM_TOOL_DECLS[0], handler: searchHandler(client, cfg) },
    { ...NMEM_TOOL_DECLS[1], handler: getHandler(client) },
    { ...NMEM_TOOL_DECLS[2], handler: saveHandler(client, botName) },
  ];
}

interface SearchInput {
  query: string;
  limit?: number;
  mode?: MemorySearchMode;
}

interface GetInput {
  id: string;
}

interface SaveInput {
  content: string;
  id?: string;
  title?: string;
  unit_type?: MemoryUnitType;
  labels?: string[];
  importance?: number;
}

function searchHandler(client: NmemToolClient, cfg: NmemConfigSection): ToolDef['handler'] {
  return async (args) => {
    const input = validateSearch(args);
    if (!input.ok) return input.outcome;
    const limit = Math.min(input.value.limit ?? cfg.searchLimit, LIMIT_MAX);
    const options: MemorySearchOptions = {
      limit,
      mode: input.value.mode ?? cfg.searchMode,
    };
    return attemptOutcome(
      async () => formatSearch(await client.searchMemories(input.value.query, options), limit),
    );
  };
}

function getHandler(client: NmemToolClient): ToolDef['handler'] {
  return async (args) => {
    const input = validateGet(args);
    if (!input.ok) return input.outcome;
    const id = input.value.id;
    return attemptOutcome(async () => formatGet(id, await client.getMemory(id)));
  };
}

function saveHandler(client: NmemToolClient, botName: string): ToolDef['handler'] {
  return async (args) => {
    const input = validateSave(args);
    if (!input.ok) return input.outcome;
    const payload: MemorySavePayload = {
      content: input.value.content,
      id: input.value.id,
      title: input.value.title,
      unit_type: input.value.unit_type,
      labels: withDefaultLabel(input.value.labels),
      importance: input.value.importance,
      source: SOURCE,
      source_app: SOURCE_APP,
      agent_id: botName,
    };
    return attemptOutcome(async () => formatSave(await client.saveMemory(payload)));
  };
}

function validateSearch(args: NmemToolArgs): Validated<SearchInput> {
  const query = args.query;
  if (typeof query !== 'string' || query.trim() === '') return rejected(QUERY_EMPTY_TEXT);
  if (query.length > QUERY_MAX) {
    return rejected(`检索词过长(${query.length} 字符,上限 ${QUERY_MAX}),请提炼后重试。`);
  }
  const limit = validateLimit(args);
  if (!limit.ok) return limit;
  const mode = validateMode(args);
  if (!mode.ok) return mode;
  return { ok: true, value: { query, limit: limit.value, mode: mode.value } };
}

function validateLimit(args: NmemToolArgs): Validated<number | undefined> {
  const limit = args.limit;
  if (limit === undefined) return { ok: true, value: undefined };
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX) {
    return rejected(LIMIT_TEXT);
  }
  return { ok: true, value: limit };
}

function validateMode(args: NmemToolArgs): Validated<MemorySearchMode | undefined> {
  const mode = args.mode;
  if (mode === undefined) return { ok: true, value: undefined };
  if (mode !== 'fast' && mode !== 'deep') return rejected(MODE_TEXT);
  return { ok: true, value: mode };
}

function validateGet(args: NmemToolArgs): Validated<GetInput> {
  const id = args.id;
  if (typeof id !== 'string' || id.trim() === '') return rejected(GET_ID_TEXT);
  return { ok: true, value: { id: id.trim() } };
}

function validateSave(args: NmemToolArgs): Validated<SaveInput> {
  const content = validateContent(args);
  if (!content.ok) return content;
  const id = validateId(args);
  if (!id.ok) return id;
  const title = validateTitle(args);
  if (!title.ok) return title;
  const unitType = validateUnitType(args);
  if (!unitType.ok) return unitType;
  const labels = validateLabels(args);
  if (!labels.ok) return labels;
  const importance = validateImportance(args);
  if (!importance.ok) return importance;
  return {
    ok: true,
    value: {
      content: content.value,
      id: id.value,
      title: title.value,
      unit_type: unitType.value,
      labels: labels.value,
      importance: importance.value,
    },
  };
}

function validateContent(args: NmemToolArgs): Validated<string> {
  const content = args.content;
  if (typeof content !== 'string' || content.trim() === '') return rejected(CONTENT_EMPTY_TEXT);
  if (content.length > CONTENT_MAX) {
    return rejected(`内容过长(${content.length} 字符,上限 ${CONTENT_MAX}),请提炼后重试。`);
  }
  return { ok: true, value: content };
}

function validateId(args: NmemToolArgs): Validated<string | undefined> {
  const id = args.id;
  if (id === undefined) return { ok: true, value: undefined };
  if (typeof id !== 'string' || id.trim() === '') return rejected(SAVE_ID_EMPTY_TEXT);
  if (id.length > ID_MAX) return rejected(`id 过长(${id.length} 字符,上限 ${ID_MAX})。`);
  return { ok: true, value: id.trim() };
}

function validateTitle(args: NmemToolArgs): Validated<string | undefined> {
  const title = args.title;
  if (title === undefined) return { ok: true, value: undefined };
  if (typeof title !== 'string') return rejected(TITLE_TEXT);
  return { ok: true, value: title };
}

function validateUnitType(args: NmemToolArgs): Validated<MemoryUnitType | undefined> {
  const unitType = args.unit_type;
  if (unitType === undefined) return { ok: true, value: undefined };
  if (typeof unitType !== 'string' || !isUnitType(unitType)) return rejected(UNIT_TYPE_TEXT);
  return { ok: true, value: unitType };
}

function validateLabels(args: NmemToolArgs): Validated<string[] | undefined> {
  const labels = args.labels;
  if (labels === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(labels)) return rejected(LABELS_TEXT);
  const values: string[] = [];
  for (const label of labels) {
    if (typeof label !== 'string') return rejected(LABELS_TEXT);
    values.push(label);
  }
  return { ok: true, value: values };
}

function validateImportance(args: NmemToolArgs): Validated<number | undefined> {
  const importance = args.importance;
  if (importance === undefined) return { ok: true, value: undefined };
  if (typeof importance !== 'number' || !Number.isFinite(importance)) return rejected(IMPORTANCE_TEXT);
  if (importance < 0 || importance > 1) return rejected(IMPORTANCE_TEXT);
  return { ok: true, value: importance };
}

function isUnitType(value: string): value is MemoryUnitType {
  return UNIT_TYPES.some((candidate) => candidate === value);
}

function withDefaultLabel(labels: string[] | undefined): string[] {
  const merged = labels ?? [];
  return merged.includes(DEFAULT_LABEL) ? [...merged] : [...merged, DEFAULT_LABEL];
}

function rejected(text: string): Validated<never> {
  return { ok: false, outcome: { text, failed: true } };
}

async function attemptOutcome(format: () => Promise<ToolOutcome>): Promise<ToolOutcome> {
  try {
    return await format();
  } catch (error) {
    if (error instanceof MemTransportError) return failed(TRANSPORT_TEXT);
    if (error instanceof MemAuthError) return failed(AUTH_TEXT);
    if (error instanceof MemRateLimitError) return failed(RATE_LIMIT_TEXT);
    if (error instanceof MemServerError) return failed(SERVER_TEXT);
    if (error instanceof MemProtocolError) return failed(PROTOCOL_TEXT);
    if (error instanceof MemHttpError) {
      return failed(`Nowledge Mem 请求失败(状态码 ${error.status}):请稍后再试或检查参数。`);
    }
    return failed(UNEXPECTED_TEXT);
  }
}

function failed(text: string): ToolOutcome {
  return { text, failed: true };
}

function formatSearch(hits: MemoryHit[], limit: number): ToolOutcome {
  const lines: string[] = [];
  let omitted = 0;
  let skipped = 0;
  for (const hit of hits) {
    const memory = hit.memory;
    if (memory === null) {
      skipped += 1;
    } else if (lines.length < limit) {
      lines.push(hitLine(lines.length + 1, hit.similarity_score, memory));
    } else {
      omitted += 1;
    }
  }
  return { text: searchText(lines, omitted, skipped) };
}

function searchText(lines: string[], omitted: number, skipped: number): string {
  const notes: string[] = [];
  if (omitted !== 0) notes.push(`（另有 ${omitted} 条结果未列出）`);
  if (skipped !== 0) notes.push(`（另有 ${skipped} 条结果因数据缺失被略过）`);
  if (lines.length === 0) return ['没有找到相关记忆。', ...notes].join('\n');
  return [
    `找到 ${lines.length} 条相关记忆:`,
    ...lines,
    ...notes,
    '需要全文时,用 nmem_get 按 id 读取。',
  ].join('\n');
}

function hitLine(index: number, score: number, memory: MemoryRecord): string {
  return `${index}. [${score.toFixed(2)}] ${titleOf(memory)} — ${summarize(memory.content)}(id: ${memory.id})`;
}

function titleOf(memory: MemoryRecord): string {
  const title = memoryTitle(memory);
  if (title === null) return '无标题';
  return title.length <= TITLE_MAX ? title : `${title.slice(0, TITLE_MAX)}…`;
}

function memoryTitle(memory: MemoryRecord): string | null {
  const title = memory.title;
  if (title === undefined || title === null || title === '') return null;
  return title;
}

function summarize(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= SUMMARY_MAX) return oneLine;
  return `${oneLine.slice(0, SUMMARY_MAX)}…`;
}

function formatGet(id: string, memory: MemoryRecord | null): ToolOutcome {
  if (memory === null) return { text: `未找到 id 为 ${id} 的记忆。` };
  const title = memoryTitle(memory);
  const heading = title === null ? `记忆 ${memory.id}:` : `记忆 ${memory.id}「${title}」:`;
  return { text: `${heading}\n${memory.content}` };
}

function formatSave(result: MemorySaveResult): ToolOutcome {
  const text =
    result.action === 'created'
      ? `已新建记忆 ${result.memory.id}。`
      : `已更新既有记忆 ${result.memory.id}。`;
  return { text };
}
