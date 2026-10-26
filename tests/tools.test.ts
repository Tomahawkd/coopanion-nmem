import { describe, it, expect } from 'vitest';
import type { Logger, ToolCallContext, ToolDef, ToolOutcome } from 'cortico/core/types.ts';
import { NMEM_DEFAULTS, type NmemConfigSection } from '../src/config.ts';
import {
  MemAuthError,
  MemHttpError,
  MemProtocolError,
  MemRateLimitError,
  MemServerError,
  MemTransportError,
} from '../src/mem/client.ts';
import type {
  MemoryHit,
  MemoryRecord,
  MemorySavePayload,
  MemorySaveResult,
  MemorySearchOptions,
} from '../src/mem/types.ts';
import { nmemTools, type NmemToolArgs, type NmemToolClient } from '../src/tools.ts';

const NOOP_LOGGER: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  emit: () => {},
  child: () => NOOP_LOGGER,
};

const CALL: ToolCallContext = { role: 'test', log: NOOP_LOGGER };

const MARKER = 'nmem_leak_marker';

interface SearchCall {
  query: string;
  options?: MemorySearchOptions;
}

class FakeToolClient implements NmemToolClient {
  searchCalls: SearchCall[] = [];
  getCalls: string[] = [];
  saveCalls: MemorySavePayload[] = [];
  hits: MemoryHit[] = [];
  record: MemoryRecord | null = null;
  saveResult: MemorySaveResult = { memory: { id: 'mem-new', content: 'saved' }, action: 'created' };
  failure: Error | null = null;

  async searchMemories(query: string, options?: MemorySearchOptions): Promise<MemoryHit[]> {
    this.searchCalls.push({ query, options });
    this.raise();
    return this.hits;
  }

  async getMemory(id: string): Promise<MemoryRecord | null> {
    this.getCalls.push(id);
    this.raise();
    return this.record;
  }

  async saveMemory(payload: MemorySavePayload): Promise<MemorySaveResult> {
    this.saveCalls.push(payload);
    this.raise();
    return this.saveResult;
  }

  private raise(): void {
    if (this.failure !== null) throw this.failure;
  }
}

interface Harness {
  tools: ToolDef[];
  client: FakeToolClient;
  cfg: NmemConfigSection;
}

function setup(): Harness {
  const client = new FakeToolClient();
  const cfg: NmemConfigSection = { ...NMEM_DEFAULTS };
  return { tools: nmemTools({ client, cfg }), client, cfg };
}

function toolNamed(tools: ToolDef[], name: string): ToolDef {
  const found = tools.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`工具未声明:${name}`);
  return found;
}

function outcomeOf(result: string | ToolOutcome): ToolOutcome {
  return typeof result === 'string' ? { text: result } : result;
}

async function call(tools: ToolDef[], name: string, args: NmemToolArgs): Promise<ToolOutcome> {
  return outcomeOf(await toolNamed(tools, name).handler(args, CALL));
}

function availableHits(start: number, count: number): MemoryHit[] {
  const hits: MemoryHit[] = [];
  for (let index = start; index < start + count; index += 1) {
    hits.push({
      memory: { id: `mem-${index}`, content: `内容 ${index}`, title: `标题 ${index}` },
      similarity_score: 0.9,
    });
  }
  return hits;
}

function listedLines(count: number): string[] {
  const lines: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`${index}. [0.90] 标题 ${index} — 内容 ${index}(id: mem-${index})`);
  }
  return lines;
}

function missingHits(count: number): MemoryHit[] {
  const hits: MemoryHit[] = [];
  for (let index = 0; index < count; index += 1) {
    hits.push({ memory: null, similarity_score: 0.5 });
  }
  return hits;
}

const ERROR_CASES: Array<{ label: string; error: Error; text: string }> = [
  {
    label: 'MemTransportError',
    error: new MemTransportError(MARKER),
    text: 'Nowledge Mem 不可达:请确认 Mem 正在运行,且 baseUrl 配置正确。',
  },
  {
    label: 'MemAuthError',
    error: new MemAuthError(401, MARKER),
    text: 'Nowledge Mem 认证失败:API key 无效或已轮转,请检查 NMEM_API_KEY 配置。',
  },
  {
    label: 'MemRateLimitError',
    error: new MemRateLimitError(429, MARKER),
    text: 'Nowledge Mem 限流,请稍后再试。',
  },
  {
    label: 'MemServerError',
    error: new MemServerError(503, MARKER),
    text: 'Nowledge Mem 服务端错误,请稍后再试。',
  },
  {
    label: 'MemProtocolError',
    error: new MemProtocolError(MARKER),
    text: 'Nowledge Mem 响应异常,可能版本不兼容。',
  },
  {
    label: 'MemHttpError(400)',
    error: new MemHttpError(400, MARKER),
    text: 'Nowledge Mem 请求失败(状态码 400):请稍后再试或检查参数。',
  },
  {
    label: '普通 Error',
    error: new Error(MARKER),
    text: 'Nowledge Mem 工具执行失败:发生未预期的错误。',
  },
];

const SEARCH_RECEIPT = [
  '找到 2 条相关记忆:',
  '1. [0.88] 猫的名字 — 用户的猫叫 Pixel(id: mem-1)',
  '2. [0.50] 无标题 — 偏好深色主题(id: mem-2)',
  '需要全文时,用 nmem_get 按 id 读取。',
];

const CAP_DEFAULT_RECEIPT = [
  '找到 5 条相关记忆:',
  ...listedLines(5),
  '（另有 6 条结果未列出）',
  '需要全文时,用 nmem_get 按 id 读取。',
];

const CAP_TEN_RECEIPT = [
  '找到 10 条相关记忆:',
  ...listedLines(10),
  '（另有 1 条结果未列出）',
  '需要全文时,用 nmem_get 按 id 读取。',
];

const CAP_MIXED_RECEIPT = [
  '找到 10 条相关记忆:',
  ...listedLines(10),
  '（另有 1 条结果未列出）',
  '（另有 12 条结果因数据缺失被略过）',
  '需要全文时,用 nmem_get 按 id 读取。',
];

const CAP_THREE_RECEIPT = [
  '找到 3 条相关记忆:',
  ...listedLines(3),
  '（另有 2 条结果未列出）',
  '需要全文时,用 nmem_get 按 id 读取。',
];

describe('工具声明', () => {
  it('三工具带标签、必填参数与封闭参数表', () => {
    const { tools } = setup();
    expect(tools.map((entry) => entry.name)).toEqual(['nmem_search', 'nmem_get', 'nmem_save']);
    expect(tools.map((entry) => entry.tags)).toEqual([['read'], ['read'], ['write']]);
    expect(tools[0].parameters).toMatchObject({ required: ['query'], additionalProperties: false });
    expect(tools[1].parameters).toMatchObject({ required: ['id'], additionalProperties: false });
    expect(tools[2].parameters).toMatchObject({
      required: ['content'],
      additionalProperties: false,
    });
  });
});

describe('nmem_search 缺省值与覆盖', () => {
  it('缺省 limit 与 mode 取配置,query 原样透传', async () => {
    const { tools, client } = setup();
    const outcome = await call(tools, 'nmem_search', { query: '猫' });
    expect(client.searchCalls).toEqual([
      { query: '猫', options: { limit: NMEM_DEFAULTS.searchLimit, mode: NMEM_DEFAULTS.searchMode } },
    ]);
    expect(outcome).toEqual({ text: '没有找到相关记忆。' });
  });

  it('显式 limit 与 mode 覆盖配置', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_search', { query: '项目决定', limit: 3, mode: 'deep' });
    expect(client.searchCalls[0]?.options).toEqual({ limit: 3, mode: 'deep' });
  });

  it('配置热改后每次调用现读新值', async () => {
    const { tools, client, cfg } = setup();
    await call(tools, 'nmem_search', { query: '猫' });
    cfg.searchLimit = 8;
    cfg.searchMode = 'deep';
    await call(tools, 'nmem_search', { query: '猫' });
    expect(client.searchCalls.map((entry) => entry.options)).toEqual([
      { limit: 5, mode: 'fast' },
      { limit: 8, mode: 'deep' },
    ]);
  });
});

describe('nmem_search 回执格式', () => {
  it('逐条给出编号、相似度、标题或「无标题」、摘要与 id', async () => {
    const { tools, client } = setup();
    client.hits = [
      {
        memory: { id: 'mem-1', content: '用户的猫叫 Pixel', title: '猫的名字' },
        similarity_score: 0.876,
      },
      { memory: { id: 'mem-2', content: '偏好深色主题', title: null }, similarity_score: 0.5 },
    ];
    const outcome = await call(tools, 'nmem_search', { query: '用户' });
    expect(outcome.text.split('\n')).toEqual(SEARCH_RECEIPT);
    expect(outcome.failed).toBeUndefined();
  });

  it('摘要超过 200 字符时截断并加省略号', async () => {
    const { tools, client } = setup();
    client.hits = [
      { memory: { id: 'mem-3', content: 'x'.repeat(250), title: '长记忆' }, similarity_score: 1 },
    ];
    const outcome = await call(tools, 'nmem_search', { query: '长' });
    expect(outcome.text).toContain(`— ${'x'.repeat(200)}…(id: mem-3)`);
  });

  it('标题超过 80 字符时截断并加省略号,回执长度有界', async () => {
    const { tools, client } = setup();
    client.hits = [
      { memory: { id: 'mem-5', content: '正文', title: 't'.repeat(4000) }, similarity_score: 1 },
    ];
    const outcome = await call(tools, 'nmem_search', { query: '长标题' });
    expect(outcome.text.split('\n')).toEqual([
      '找到 1 条相关记忆:',
      `1. [1.00] ${'t'.repeat(80)}… — 正文(id: mem-5)`,
      '需要全文时,用 nmem_get 按 id 读取。',
    ]);
    expect(outcome.text.length).toBeLessThan(200);
  });
});

describe('nmem_search 数据缺失', () => {
  it('memory 为 null 的命中被跳过并计数', async () => {
    const { tools, client } = setup();
    client.hits = [
      { memory: null, similarity_score: 0.9 },
      { memory: { id: 'mem-4', content: '留下的那条' }, similarity_score: 0.4 },
    ];
    const outcome = await call(tools, 'nmem_search', { query: '记忆' });
    expect(outcome.text.split('\n')).toEqual([
      '找到 1 条相关记忆:',
      '1. [0.40] 无标题 — 留下的那条(id: mem-4)',
      '（另有 1 条结果因数据缺失被略过）',
      '需要全文时,用 nmem_get 按 id 读取。',
    ]);
  });

  it('全部命中都缺数据时如实说明没有结果', async () => {
    const { tools, client } = setup();
    client.hits = [{ memory: null, similarity_score: 0.9 }];
    const outcome = await call(tools, 'nmem_search', { query: '记忆' });
    expect(outcome.text.split('\n')).toEqual([
      '没有找到相关记忆。',
      '（另有 1 条结果因数据缺失被略过）',
    ]);
  });
});

describe('nmem_search 回执条数上限', () => {
  it('响应超过缺省 limit 时只列 5 条并注明未列出', async () => {
    const { tools, client } = setup();
    client.hits = availableHits(1, 11);
    const outcome = await call(tools, 'nmem_search', { query: '上限' });
    const lines = outcome.text.split('\n');
    expect(lines).toHaveLength(8);
    expect(lines).toEqual(CAP_DEFAULT_RECEIPT);
  });

  it('响应超过显式 limit 10 时只列 10 条并注明未列出', async () => {
    const { tools, client } = setup();
    client.hits = availableHits(1, 11);
    const outcome = await call(tools, 'nmem_search', { query: '上限', limit: 10 });
    const lines = outcome.text.split('\n');
    expect(lines).toHaveLength(13);
    expect(lines).toEqual(CAP_TEN_RECEIPT);
  });

  it('混入 null 时未列出与数据缺失两种尾注并存', async () => {
    const { tools, client } = setup();
    client.hits = [...availableHits(1, 5), ...missingHits(12), ...availableHits(6, 6)];
    const outcome = await call(tools, 'nmem_search', { query: '上限', limit: 10 });
    const lines = outcome.text.split('\n');
    expect(lines).toHaveLength(14);
    expect(lines).toEqual(CAP_MIXED_RECEIPT);
  });

  it('配置缺省超过 10 时按硬上限 10 截断', async () => {
    const { tools, client, cfg } = setup();
    cfg.searchLimit = 23;
    client.hits = availableHits(1, 11);
    const outcome = await call(tools, 'nmem_search', { query: '上限' });
    const lines = outcome.text.split('\n');
    expect(client.searchCalls[0]?.options?.limit).toBe(10);
    expect(lines).toHaveLength(13);
    expect(lines).toEqual(CAP_TEN_RECEIPT);
  });

  it('显式 limit 3 时只列 3 条并注明未列出', async () => {
    const { tools, client } = setup();
    client.hits = availableHits(1, 5);
    const outcome = await call(tools, 'nmem_search', { query: '上限', limit: 3 });
    const lines = outcome.text.split('\n');
    expect(lines).toHaveLength(6);
    expect(lines).toEqual(CAP_THREE_RECEIPT);
  });
});

describe('nmem_search 参数校验', () => {
  it('query 缺失、非字符串或空白时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const args of [{}, { query: 42 }, { query: '   ' }]) {
      expect(await call(tools, 'nmem_search', args)).toEqual({
        text: '检索词不能为空:请提供 1–500 字符的检索词。',
        failed: true,
      });
    }
    expect(client.searchCalls).toEqual([]);
  });

  it('query 超过 500 字符时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    expect(await call(tools, 'nmem_search', { query: 'a'.repeat(501) })).toEqual({
      text: '检索词过长(501 字符,上限 500),请提炼后重试。',
      failed: true,
    });
    expect(client.searchCalls).toEqual([]);
  });

  it('limit 非法时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const limit of [0, 11, 2.5, '3']) {
      expect(await call(tools, 'nmem_search', { query: '猫', limit })).toEqual({
        text: 'limit 必须是 1–10 的整数。',
        failed: true,
      });
    }
    expect(client.searchCalls).toEqual([]);
  });

  it('mode 非法时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    expect(await call(tools, 'nmem_search', { query: '猫', mode: 'slow' })).toEqual({
      text: 'mode 必须是 fast 或 deep。',
      failed: true,
    });
    expect(client.searchCalls).toEqual([]);
  });
});

describe('nmem_search 错误回执', () => {
  it.each(ERROR_CASES)('client 抛出 $label 时回执是固定文案,不含响应摘要', async ({ error, text }) => {
    const { tools, client } = setup();
    client.failure = error;
    const outcome = await call(tools, 'nmem_search', { query: '猫' });
    expect(outcome).toEqual({ text, failed: true });
    expect(outcome.text).not.toContain(MARKER);
  });
});

describe('nmem_get', () => {
  it('命中时回执带 id、标题与全文', async () => {
    const { tools, client } = setup();
    client.record = { id: 'mem-7', content: '第一行\n第二行', title: '调试偏好' };
    expect(await call(tools, 'nmem_get', { id: 'mem-7' })).toEqual({
      text: '记忆 mem-7「调试偏好」:\n第一行\n第二行',
    });
    expect(client.getCalls).toEqual(['mem-7']);
  });

  it('标题缺失或为 null 时只给 id 与全文', async () => {
    const { tools, client } = setup();
    client.record = { id: 'mem-8', content: '没有标题的记忆' };
    expect((await call(tools, 'nmem_get', { id: 'mem-8' })).text).toBe(
      '记忆 mem-8:\n没有标题的记忆',
    );
    client.record = { id: 'mem-8', content: '没有标题的记忆', title: null };
    expect((await call(tools, 'nmem_get', { id: 'mem-8' })).text).toBe(
      '记忆 mem-8:\n没有标题的记忆',
    );
  });

  it('client 返回 null 时是未找到的普通回执,不算失败', async () => {
    const { tools } = setup();
    expect(await call(tools, 'nmem_get', { id: 'ghost' })).toEqual({
      text: '未找到 id 为 ghost 的记忆。',
    });
  });

  it('id 缺失、非字符串或空白时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const args of [{}, { id: 7 }, { id: '  ' }]) {
      expect(await call(tools, 'nmem_get', args)).toEqual({
        text: 'id 不能为空:请传入要读取的记忆 id。',
        failed: true,
      });
    }
    expect(client.getCalls).toEqual([]);
  });

  it('client 抛错时回执是固定文案,不含响应摘要', async () => {
    const { tools, client } = setup();
    client.failure = new MemAuthError(401, MARKER);
    const outcome = await call(tools, 'nmem_get', { id: 'mem-1' });
    expect(outcome).toEqual({
      text: 'Nowledge Mem 认证失败:API key 无效或已轮转,请检查 NMEM_API_KEY 配置。',
      failed: true,
    });
    expect(outcome.text).not.toContain(MARKER);
  });
});

describe('nmem_save 回执', () => {
  it('新建时回执报告服务端 id', async () => {
    const { tools } = setup();
    expect(await call(tools, 'nmem_save', { content: '用户的猫叫 Pixel' })).toEqual({
      text: '已新建记忆 mem-new。',
    });
  });

  it('更新既有记忆时回执报告 updated', async () => {
    const { tools, client } = setup();
    client.saveResult = { memory: { id: 'mem-9', content: '更新后的正文' }, action: 'updated' };
    expect(await call(tools, 'nmem_save', { content: '更新后的正文', id: 'mem-9' })).toEqual({
      text: '已更新既有记忆 mem-9。',
    });
    expect(client.saveCalls[0]?.id).toBe('mem-9');
  });

});

describe('nmem_save 可选字段', () => {
  it('溯源三字段与默认 label 总是写入', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_save', { content: '决定:门店周末延长营业' });
    expect(client.saveCalls[0]).toMatchObject({
      content: '决定:门店周末延长营业',
      source: 'coopanion',
      source_app: 'cortico-world-nmem',
      agent_id: 'coopanion',
      labels: ['coopanion'],
    });
  });

  it('调用方标签保留,默认 label 并入且不重复', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_save', { content: '正文一', labels: ['team'] });
    await call(tools, 'nmem_save', { content: '正文二', labels: ['coopanion', 'team'] });
    expect(client.saveCalls.map((entry) => entry.labels)).toEqual([
      ['team', 'coopanion'],
      ['coopanion', 'team'],
    ]);
  });

  it('可选字段原样透传', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_save', {
      content: ' 决定全文 ',
      id: 'mem-9',
      title: '营业时间',
      unit_type: 'decision',
      labels: ['team'],
      importance: 0.5,
    });
    expect(client.saveCalls[0]).toEqual({
      content: ' 决定全文 ',
      id: 'mem-9',
      title: '营业时间',
      unit_type: 'decision',
      labels: ['team', 'coopanion'],
      importance: 0.5,
      source: 'coopanion',
      source_app: 'cortico-world-nmem',
      agent_id: 'coopanion',
    });
  });
});

describe('nmem_save agentId 溯源旋钮', () => {
  it('cfg.agentId 覆盖时 payload 透传新值', async () => {
    const { tools, client, cfg } = setup();
    cfg.agentId = 'coo-pet';
    await call(tools, 'nmem_save', { content: '覆盖正文' });
    expect(client.saveCalls[0]?.agent_id).toBe('coo-pet');
  });

  it('直改 cfg.agentId 引用后下一次调用现读新值', async () => {
    const { tools, client, cfg } = setup();
    await call(tools, 'nmem_save', { content: '热改前' });
    cfg.agentId = 'coo-pet';
    await call(tools, 'nmem_save', { content: '热改后' });
    expect(client.saveCalls.map((entry) => entry.agent_id)).toEqual(['coopanion', 'coo-pet']);
  });

  it('非法 agentId 不在工具层拦截,服务端 422 走固定文案且不泄露响应摘要', async () => {
    const { tools, client, cfg } = setup();
    cfg.agentId = '大肥鱼';
    client.failure = new MemHttpError(422, MARKER);
    const outcome = await call(tools, 'nmem_save', { content: '非法溯源' });
    expect(client.saveCalls[0]?.agent_id).toBe('大肥鱼');
    expect(outcome).toEqual({
      text: 'Nowledge Mem 请求失败(状态码 422):请稍后再试或检查参数。',
      failed: true,
    });
    expect(outcome.text).not.toContain(MARKER);
  });
});

describe('nmem_save 省略字段', () => {
  it('省略的可选字段只以 undefined 值出现,序列化时不进请求体', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_save', { content: '只有正文' });
    const payload = client.saveCalls[0];
    expect(Object.keys(payload)).toEqual([
      'content',
      'id',
      'title',
      'unit_type',
      'labels',
      'importance',
      'source',
      'source_app',
      'agent_id',
    ]);
    expect(payload.id).toBeUndefined();
    expect(payload.title).toBeUndefined();
    expect(payload.unit_type).toBeUndefined();
    expect(payload.importance).toBeUndefined();
  });
});

describe('nmem_save content 校验', () => {
  it('content 空白时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const args of [{}, { content: 42 }, { content: '  \n ' }]) {
      expect(await call(tools, 'nmem_save', args)).toEqual({
        text: 'content 不能为空:请提供 1–30000 字符的记忆内容。',
        failed: true,
      });
    }
    expect(client.saveCalls).toEqual([]);
  });

  it('content 超过 30000 字符时拒绝且不截断、不调 client', async () => {
    const { tools, client } = setup();
    expect(await call(tools, 'nmem_save', { content: 'c'.repeat(30001) })).toEqual({
      text: '内容过长(30001 字符,上限 30000),请提炼后重试。',
      failed: true,
    });
    expect(client.saveCalls).toEqual([]);
  });

});

describe('nmem_save 枚举与数值校验', () => {
  it('id 空白或过长时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    expect(await call(tools, 'nmem_save', { content: '正文', id: '   ' })).toEqual({
      text: 'id 不能为空(新建请直接省略该参数)。',
      failed: true,
    });
    expect(await call(tools, 'nmem_save', { content: '正文', id: 'i'.repeat(201) })).toEqual({
      text: 'id 过长(201 字符,上限 200)。',
      failed: true,
    });
    expect(client.saveCalls).toEqual([]);
  });

  it('title 非字符串时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    expect(await call(tools, 'nmem_save', { content: '正文', title: 42 })).toEqual({
      text: 'title 必须是字符串。',
      failed: true,
    });
    expect(client.saveCalls).toEqual([]);
  });

  it('unit_type 不在枚举内时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const unitType of ['idea', 7]) {
      expect(await call(tools, 'nmem_save', { content: '正文', unit_type: unitType })).toEqual({
        text: 'unit_type 必须是 fact/preference/decision/plan/procedure/learning/context/event 之一。',
        failed: true,
      });
    }
    expect(client.saveCalls).toEqual([]);
  });

});

describe('nmem_save 标签与重要度校验', () => {
  it('labels 不是字符串数组时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const labels of ['team', ['team', 7]]) {
      expect(await call(tools, 'nmem_save', { content: '正文', labels })).toEqual({
        text: 'labels 必须是字符串数组。',
        failed: true,
      });
    }
    expect(client.saveCalls).toEqual([]);
  });

  it('importance 越界或非数值时拒绝且不调 client', async () => {
    const { tools, client } = setup();
    for (const importance of [-0.1, 1.5, '0.5', Number.POSITIVE_INFINITY]) {
      expect(await call(tools, 'nmem_save', { content: '正文', importance })).toEqual({
        text: 'importance 必须是 0–1 的数值。',
        failed: true,
      });
    }
    expect(client.saveCalls).toEqual([]);
  });
});

describe('边界值接受', () => {
  it('limit 的上下界 1 与 10 都透传给 client', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_search', { query: '边界', limit: 1 });
    await call(tools, 'nmem_search', { query: '边界', limit: 10 });
    expect(client.searchCalls.map((entry) => entry.options?.limit)).toEqual([1, 10]);
  });

  it('content 恰好 30000 字符时照常保存', async () => {
    const { tools, client } = setup();
    const outcome = await call(tools, 'nmem_save', { content: 'c'.repeat(30000) });
    expect(outcome).toEqual({ text: '已新建记忆 mem-new。' });
    expect(client.saveCalls[0]?.content).toBe('c'.repeat(30000));
  });

  it('id 恰好 200 字符时透传给 client', async () => {
    const { tools, client } = setup();
    const id = 'i'.repeat(200);
    const outcome = await call(tools, 'nmem_save', { content: '正文', id });
    expect(outcome).toEqual({ text: '已新建记忆 mem-new。' });
    expect(client.saveCalls[0]?.id).toBe(id);
  });

  it('importance 的上下界 0 与 1 都透传给 client', async () => {
    const { tools, client } = setup();
    await call(tools, 'nmem_save', { content: '正文一', importance: 0 });
    await call(tools, 'nmem_save', { content: '正文二', importance: 1 });
    expect(client.saveCalls.map((entry) => entry.importance)).toEqual([0, 1]);
  });
});

describe('nmem_save 错误回执', () => {
  it('client 抛错时回执是固定文案,不含响应摘要', async () => {
    const { tools, client } = setup();
    client.failure = new MemServerError(503, MARKER);
    const outcome = await call(tools, 'nmem_save', { content: '正文' });
    expect(outcome).toEqual({ text: 'Nowledge Mem 服务端错误,请稍后再试。', failed: true });
    expect(outcome.text).not.toContain(MARKER);
  });
});
