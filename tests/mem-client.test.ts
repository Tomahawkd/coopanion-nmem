import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MEM_TIMEOUT_MS,
  MemAuthError,
  MemClient,
  MemHttpError,
  MemProtocolError,
  MemRateLimitError,
  MemServerError,
  MemTransportError,
  type MemResponse,
  type MemTransport,
  type MemTransportRequest,
} from '../src/mem/client.ts';
import type { MemHealth, MemoryHit, MemoryRecord, MemorySaveResult } from '../src/mem/types.ts';

const BASE_URL = 'http://127.0.0.1:14242';

interface RecordedCall {
  url: string;
  request: MemTransportRequest;
}

interface TransportStub {
  transport: MemTransport;
  calls: RecordedCall[];
}

function stubTransport(...responses: MemResponse[]): TransportStub {
  const calls: RecordedCall[] = [];
  const transport: MemTransport = async (url, request) => {
    calls.push({ url, request });
    return responses[Math.min(calls.length - 1, responses.length - 1)];
  };
  return { transport, calls };
}

function expectSameRequest(actual: RecordedCall, expected: RecordedCall): void {
  expect(actual.url).toBe(expected.url);
  expect(actual.request.method).toBe(expected.request.method);
  expect(actual.request.headers).toEqual(expected.request.headers);
  expect(actual.request.body).toBe(expected.request.body);
}

function jsonResponse(status: number, body: string, headers?: Headers): MemResponse {
  return { status, headers: headers ?? new Headers(), text: async () => body };
}

const SEARCH_HIT_BODY =
  '[{"memory":{"id":"m1","content":"用户的猫叫 Pixel","title":"猫"},"similarity_score":0.87},'
  + '{"memory":null,"similarity_score":0.2}]';

type MemCallResult = MemoryHit[] | MemoryRecord | null | MemorySaveResult | MemHealth;

async function failureOf(call: Promise<MemCallResult>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('fake transport 抛出了非 Error 值');
  }
  throw new Error('期望调用失败,但调用成功了');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MemClient 鉴权头', () => {
  it('没有配置 key 时请求字面不含 Authorization', async () => {
    const { transport, calls } = stubTransport(jsonResponse(200, '[]'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await client.searchMemories('cat');
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0].request.headers)).toEqual(['Accept', 'Content-Type']);
    expect('Authorization' in calls[0].request.headers).toBe(false);
    expect(calls[0].request.headers.Accept).toBe('application/json');
    expect(calls[0].request.headers['Content-Type']).toBe('application/json');
    expect(calls[0].request.body).toBe('{"query":"cat"}');
  });

  it('key 为空串等同没有 key', async () => {
    const { transport, calls } = stubTransport(jsonResponse(200, SEARCH_HIT_BODY));
    const client = new MemClient({ baseUrl: BASE_URL, apiKey: '', transport });
    await client.searchMemories('cat');
    expect('Authorization' in calls[0].request.headers).toBe(false);
  });

  it('配置了 key 时发 Bearer,GET 不带 Content-Type', async () => {
    const { transport, calls } = stubTransport(jsonResponse(200, '{"id":"m1","content":"正文"}'));
    const client = new MemClient({ baseUrl: BASE_URL, apiKey: 'nmem_test', transport });
    const record = await client.getMemory('m1');
    expect(record).toMatchObject({ id: 'm1', content: '正文' });
    expect(calls[0].request.headers.Authorization).toBe('Bearer nmem_test');
    expect(calls[0].request.headers['Content-Type']).toBeUndefined();
    expect(calls[0].request.body).toBeUndefined();
  });

  it('baseUrl 的尾斜杠被归一,id 经 URL 编码', async () => {
    const { transport, calls } = stubTransport(jsonResponse(200, '{"id":"a/b","content":"正文"}'));
    const client = new MemClient({ baseUrl: `${BASE_URL}/`, transport });
    await client.getMemory('a/b');
    expect(calls[0].url).toBe(`${BASE_URL}/memories/a%2Fb`);
  });
});

describe('MemClient HTTP 错误分类', () => {
  it('401 映射为 MemAuthError 且不重试', async () => {
    const { transport, calls } = stubTransport(jsonResponse(401, '{"detail":"bad key"}'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const error = await failureOf(client.getMemory('m1'));
    expect(calls).toHaveLength(1);
    if (!(error instanceof MemAuthError)) throw new Error(`期望 MemAuthError,实际 ${error.name}`);
    expect(error.status).toBe(401);
    expect(error.excerpt).toBe('{"detail":"bad key"}');
  });

  it('其余 4xx 映射为 MemHttpError,摘要超长截断', async () => {
    const { transport, calls } = stubTransport(jsonResponse(400, `  ${'x'.repeat(400)}  `));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const error = await failureOf(client.searchMemories('cat'));
    expect(calls).toHaveLength(1);
    expect(error).not.toBeInstanceOf(MemAuthError);
    if (!(error instanceof MemHttpError)) throw new Error(`期望 MemHttpError,实际 ${error.name}`);
    expect(error.status).toBe(400);
    expect(error.excerpt).toHaveLength(301);
    expect(error.excerpt.endsWith('…')).toBe(true);
  });

  it('500 不重试', async () => {
    const { transport, calls } = stubTransport(jsonResponse(500, 'boom'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const error = await failureOf(client.health());
    expect(calls).toHaveLength(1);
    expect(error.name).toBe('MemHttpError');
  });

  it('get 的 404 返回 null 且不重试', async () => {
    const { transport, calls } = stubTransport(jsonResponse(404, 'not found'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await expect(client.getMemory('missing')).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });
});

describe('MemClient 协议错误', () => {
  it('坏 JSON 映射为 MemProtocolError', async () => {
    const { transport } = stubTransport(jsonResponse(200, '<html>not json</html>'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const error = await failureOf(client.searchMemories('cat'));
    expect(error.name).toBe('MemProtocolError');
  });

  it('端点返回包装对象而非裸数据时抛 MemProtocolError', async () => {
    const { transport } = stubTransport(
      jsonResponse(200, '{"memories":[]}'),
      jsonResponse(200, '{"memories":[{"id":"m1"}]}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await expect(client.searchMemories('cat')).rejects.toBeInstanceOf(MemProtocolError);
    await expect(client.getMemory('m1')).rejects.toBeInstanceOf(MemProtocolError);
  });

  it('命中元素形状不符时抛 MemProtocolError', async () => {
    const bodies = [
      '[{"memory":{"id":"m1"},"similarity_score":0.5}]',
      '[null]',
      '[{"memory":null}]',
      '[{"memory":{"id":"m1","content":"正文","title":7},"similarity_score":0.5}]',
    ];
    for (const body of bodies) {
      const { transport } = stubTransport(jsonResponse(200, body));
      const client = new MemClient({ baseUrl: BASE_URL, transport });
      await expect(client.searchMemories('cat')).rejects.toBeInstanceOf(MemProtocolError);
    }
  });

  it('记录非对象或缺少必填字段时抛 MemProtocolError', async () => {
    const bodies = ['null', '42', '{"id":"m1"}', '{"id":"m1","content":"正文","title":7}'];
    for (const body of bodies) {
      const { transport } = stubTransport(jsonResponse(200, body));
      const client = new MemClient({ baseUrl: BASE_URL, transport });
      await expect(client.getMemory('m1')).rejects.toBeInstanceOf(MemProtocolError);
    }
  });
});

describe('MemClient 写入与探活协议错误', () => {
  it('写入响应缺 memory 或为非对象时抛 MemProtocolError', async () => {
    const bodies = ['null', '{"action":"created"}'];
    for (const body of bodies) {
      const { transport } = stubTransport(jsonResponse(200, body));
      const client = new MemClient({ baseUrl: BASE_URL, transport });
      await expect(client.saveMemory({ content: '正文' })).rejects.toBeInstanceOf(MemProtocolError);
    }
  });

  it('写入响应的 action 不在枚举内时抛 MemProtocolError', async () => {
    const { transport } = stubTransport(
      jsonResponse(200, '{"memory":{"id":"m1","content":"正文"},"action":"merged"}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await expect(client.saveMemory({ content: '正文' })).rejects.toBeInstanceOf(MemProtocolError);
  });

  it('写入响应的 memory title 非字符串时抛 MemProtocolError', async () => {
    const { transport } = stubTransport(
      jsonResponse(200, '{"memory":{"id":"m1","content":"正文","title":7},"action":"created"}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await expect(client.saveMemory({ content: '正文' })).rejects.toBeInstanceOf(MemProtocolError);
  });

  it('探活响应不是合法 JSON、非对象或缺少 status 时抛 MemProtocolError', async () => {
    const bodies = ['{"status":', 'null', '42', '{"version":"0.10.108"}', '{"status":7}'];
    for (const body of bodies) {
      const { transport } = stubTransport(jsonResponse(200, body));
      const client = new MemClient({ baseUrl: BASE_URL, transport });
      await expect(client.health()).rejects.toBeInstanceOf(MemProtocolError);
    }
  });
});

describe('MemClient 429 限流重试', () => {
  it('按 Retry-After 秒数退避后重试一次', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(
      jsonResponse(429, 'slow down', new Headers({ 'Retry-After': '2' })),
      jsonResponse(200, '[]'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const call = client.searchMemories('cat');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(call).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
    expectSameRequest(calls[1], calls[0]);
    expect(calls[1].request.body).toBe('{"query":"cat"}');
  });

  it('无 Retry-After 时按 1000ms 退避', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(jsonResponse(429, 'slow down'), jsonResponse(200, '[]'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const call = client.searchMemories('cat');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(call).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('Retry-After 不可解析时按 1000ms 退避', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(
      jsonResponse(429, 'slow down', new Headers({ 'Retry-After': 'later' })),
      jsonResponse(200, '[]'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const call = client.searchMemories('cat');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(call).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
  });
});

describe('MemClient 429 重试上限', () => {
  it('重试后仍限流即止,总尝试两次', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(
      jsonResponse(429, 'slow down', new Headers({ 'Retry-After': '1' })),
      jsonResponse(429, 'still limited'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const failure = expect(client.searchMemories('cat')).rejects.toMatchObject({
      name: 'MemRateLimitError',
      status: 429,
      excerpt: 'still limited',
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await failure;
    expect(calls).toHaveLength(2);
  });
});

describe('MemClient 5xx 重试', () => {
  it('503 重试一次,间隔 500ms', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(
      jsonResponse(503, 'unavailable'),
      jsonResponse(200, SEARCH_HIT_BODY),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const call = client.searchMemories('cat');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(499);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const hits = await call;
    expect(hits).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expectSameRequest(calls[1], calls[0]);
    expect(calls[1].request.body).toBe('{"query":"cat"}');
  });

  it('504 按服务端错误重试一次', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(jsonResponse(504, 'gateway timeout'), jsonResponse(200, '[]'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const call = client.searchMemories('cat');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(499);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(call).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('502 重试后仍失败即止,映射为 MemServerError', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(jsonResponse(502, 'bad gateway'), jsonResponse(503, 'unavailable'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const failure = expect(client.health()).rejects.toMatchObject({
      name: 'MemServerError',
      status: 503,
      excerpt: 'unavailable',
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    await failure;
    expect(calls).toHaveLength(2);
  });
});

describe('MemClient 重试请求一致性', () => {
  it('429 重试按原请求重发:方法、鉴权头与请求体逐字段一致', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(
      jsonResponse(429, 'slow down', new Headers({ 'Retry-After': '1' })),
      jsonResponse(200, '{"memory":{"id":"m1","content":"正文"},"action":"created"}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, apiKey: 'nmem_test', transport });
    const call = client.saveMemory({ content: '正文' });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(call).resolves.toEqual({ memory: { id: 'm1', content: '正文' }, action: 'created' });
    expect(calls).toHaveLength(2);
    expectSameRequest(calls[1], calls[0]);
    expect(calls[1].url).toBe(`${BASE_URL}/memories`);
    expect(calls[1].request.method).toBe('POST');
    expect(calls[1].request.headers.Authorization).toBe('Bearer nmem_test');
    expect(calls[1].request.body).toBe('{"content":"正文"}');
  });

  it('503 重试探活仍是 GET 且不带请求体', async () => {
    vi.useFakeTimers();
    const { transport, calls } = stubTransport(jsonResponse(503, 'unavailable'), jsonResponse(200, '{"status":"ok"}'));
    const client = new MemClient({ baseUrl: BASE_URL, apiKey: 'nmem_test', transport });
    const call = client.health();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    await expect(call).resolves.toEqual({ status: 'ok' });
    expect(calls).toHaveLength(2);
    expectSameRequest(calls[1], calls[0]);
    expect(calls[1].url).toBe(`${BASE_URL}/health`);
    expect(calls[1].request.method).toBe('GET');
    expect(calls[1].request.headers['Content-Type']).toBeUndefined();
    expect(calls[1].request.body).toBeUndefined();
  });
});

describe('MemClient 传输失败与超时', () => {
  it('传输失败不重试并映射为 MemTransportError', async () => {
    let attempts = 0;
    const transport: MemTransport = async () => {
      attempts += 1;
      throw new Error('connect ECONNREFUSED 127.0.0.1:14242');
    };
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const error = await failureOf(client.health());
    expect(attempts).toBe(1);
    if (!(error instanceof MemTransportError)) throw new Error(`期望 MemTransportError,实际 ${error.name}`);
    expect(error.message).toContain('无法连接 Nowledge Mem');
    expect(error.message).toContain('ECONNREFUSED');
  });

  it('传输抛出非 Error 值时映射为 MemTransportError 并标注未知原因', async () => {
    let attempts = 0;
    const transport: MemTransport = async () => {
      attempts += 1;
      throw 'boom';
    };
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const error = await failureOf(client.health());
    expect(attempts).toBe(1);
    if (!(error instanceof MemTransportError)) throw new Error(`期望 MemTransportError,实际 ${error.name}`);
    expect(error.message).toContain('无法连接 Nowledge Mem');
    expect(error.message).toContain('未知原因');
  });

  it('超时由 AbortController 中断且不重试', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const transport: MemTransport = (url, request) =>
      new Promise((resolve) => {
        attempts += 1;
        request.signal?.addEventListener('abort', () => resolve(Promise.reject(new Error(`aborted ${url}`))));
      });
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const failure = expect(client.health()).rejects.toMatchObject({
      name: 'MemTransportError',
      message: expect.stringContaining(`请求超时(${MEM_TIMEOUT_MS}ms)`),
    });
    await vi.advanceTimersByTimeAsync(MEM_TIMEOUT_MS);
    await failure;
    expect(attempts).toBe(1);
  });
});

describe('MemClient 检索收窄', () => {
  it('裸数组收窄为 MemoryHit,memory 为 null 的元素原样保留', async () => {
    const { transport } = stubTransport(jsonResponse(200, SEARCH_HIT_BODY));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const hits: MemoryHit[] = await client.searchMemories('cat', { limit: 2, mode: 'fast' });
    expect(hits).toEqual([
      { memory: { id: 'm1', content: '用户的猫叫 Pixel', title: '猫' }, similarity_score: 0.87 },
      { memory: null, similarity_score: 0.2 },
    ]);
  });

  it('记忆缺 title 时收窄结果不含该字段', async () => {
    const { transport } = stubTransport(
      jsonResponse(200, '[{"memory":{"id":"m1","content":"正文"},"similarity_score":0.5}]'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await expect(client.searchMemories('cat')).resolves.toEqual([
      { memory: { id: 'm1', content: '正文' }, similarity_score: 0.5 },
    ]);
  });

  it('检索参数透传为请求体', async () => {
    const { transport, calls } = stubTransport(jsonResponse(200, '[]'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    await client.searchMemories('cat', { limit: 3, mode: 'deep' });
    expect(calls[0].request.body).toBe('{"query":"cat","limit":3,"mode":"deep"}');
  });
});

describe('MemClient 读取、写入与探活收窄', () => {
  it('get 裸对象收窄为 MemoryRecord', async () => {
    const { transport } = stubTransport(jsonResponse(200, '{"id":"m1","content":"正文","title":null,"rating":3}'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const record: MemoryRecord | null = await client.getMemory('m1');
    expect(record).toMatchObject({ id: 'm1', content: '正文', title: null });
  });

  it('save 透传可选 id 与溯源字段,并收窄 action', async () => {
    const { transport, calls } = stubTransport(
      jsonResponse(200, '{"memory":{"id":"fixed-id","content":"正文"},"action":"updated"}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const result: MemorySaveResult = await client.saveMemory({
      id: 'fixed-id',
      content: '正文',
      title: '标题',
      labels: ['coopanion'],
      importance: 0.8,
      unit_type: 'fact',
      source: 'coopanion',
      source_app: 'cortico-world-nmem',
      agent_id: 'coo',
    });
    expect(result.action).toBe('updated');
    expect(result.memory.id).toBe('fixed-id');
    expect(calls[0].request.body).toBe(
      '{"id":"fixed-id","content":"正文","title":"标题","labels":["coopanion"],"importance":0.8,'
      + '"unit_type":"fact","source":"coopanion","source_app":"cortico-world-nmem","agent_id":"coo"}',
    );
  });

});

describe('MemClient 写入与探活收窄', () => {
  it('save 不传 id 时请求体不含 id,新建动作可收窄', async () => {
    const { transport, calls } = stubTransport(
      jsonResponse(200, '{"memory":{"id":"generated","content":"正文"},"action":"created"}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const result = await client.saveMemory({ content: '正文' });
    expect(result.action).toBe('created');
    expect(calls[0].request.body).toBe('{"content":"正文"}');
  });

  it('写入响应的 memory title 为字符串时保留', async () => {
    const { transport } = stubTransport(
      jsonResponse(200, '{"memory":{"id":"m1","content":"正文","title":"标题"},"action":"created"}'),
    );
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const result: MemorySaveResult = await client.saveMemory({ content: '正文' });
    expect(result).toEqual({ memory: { id: 'm1', content: '正文', title: '标题' }, action: 'created' });
  });

  it('health 按真实形态收窄为 MemHealth', async () => {
    const { transport } = stubTransport(jsonResponse(200, '{"status":"ok"}'));
    const client = new MemClient({ baseUrl: BASE_URL, transport });
    const health: MemHealth = await client.health();
    expect(health).toEqual({ status: 'ok' });
  });
});
