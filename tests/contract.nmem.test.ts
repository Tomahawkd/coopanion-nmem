import { describe, expect, it } from 'vitest';

const DEFAULT_BASE_URL = 'http://127.0.0.1:14242';
const PROBE_ID = 'coopanion-nmem-contract-probe';
const PROBE_CONTENT_PREFIX = '契约探针内容';
const PROBE_QUERY = 'Coopanion 契约探针 猫';
const PROBE_LABEL_OWNER = 'coopanion';
const PROBE_LABEL_SCOPE = 'contract-test';
const SOURCE = 'coopanion';
const SOURCE_APP = 'cortico-world-nmem';
const AGENT_ID = 'coopanion';
const INVALID_AGENT_ID = '大肥鱼';
const INVALID_PROBE_KEY = 'nmem_contract_invalid_probe';
const EXCERPT_LIMIT = 200;

const CONTRACT_ENABLED = process.env.NMEM_CONTRACT_BASE_URL !== undefined;
const BASE_URL = contractBaseUrl(process.env.NMEM_CONTRACT_BASE_URL);

type HttpMethod = 'GET' | 'POST' | 'DELETE';
type SearchMode = 'fast' | 'deep';

interface ProbeResponse {
  status: number;
  body: string;
}

interface ProbeHealth {
  status: string;
}

interface ProbeMemory {
  id: string;
  content: string;
}

interface ProbeHit {
  memory: ProbeMemory | null;
  similarityScore: number;
}

interface ProbeRecord {
  id: string;
  content: string;
  source: string;
  agentId: string;
  sourceApp: string;
}

interface ProbeSaveResult {
  id: string;
  action: 'created' | 'updated';
}

function contractBaseUrl(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') return DEFAULT_BASE_URL;
  return raw.trim().replace(/\/+$/, '');
}

function excerpt(body: string): string {
  return body.length > EXCERPT_LIMIT ? `${body.slice(0, EXCERPT_LIMIT)}…` : body;
}

function plainHeaders(): Headers {
  return new Headers({ Accept: 'application/json' });
}

function jsonHeaders(): Headers {
  return new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
}

function bearerHeaders(token: string): Headers {
  return new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` });
}

function searchBody(query: string, mode: SearchMode): string {
  return `{"query":"${query}","mode":"${mode}"}`;
}

function saveBody(content: string, agentId: string): string {
  const labels = `["${PROBE_LABEL_OWNER}","${PROBE_LABEL_SCOPE}"]`;
  return `{"id":"${PROBE_ID}","content":"${content}","labels":${labels},`
    + `"source":"${SOURCE}","source_app":"${SOURCE_APP}","agent_id":"${agentId}"}`;
}

async function callMem(
  method: HttpMethod,
  path: string,
  headers: Headers,
  body?: string,
): Promise<ProbeResponse> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body });
  } catch (error) {
    const reason = error instanceof Error ? error.message : '未知网络错误';
    throw new Error(
      `Nowledge Mem 不可达(${BASE_URL}${path}):${reason}。`
        + '请确认 Mem 正在运行,并检查 NMEM_CONTRACT_BASE_URL 是否指向它。',
      { cause: error },
    );
  }
  return { status: response.status, body: await response.text() };
}

function parseHealth(body: string): ProbeHealth {
  const value = JSON.parse(body);
  if (typeof value !== 'object' || value === null) {
    throw new Error(`GET /health 响应不是 JSON 对象:${excerpt(body)}`);
  }
  const status = Reflect.get(value, 'status');
  if (typeof status !== 'string') {
    throw new Error(`GET /health 响应缺少字符串 status:${excerpt(body)}`);
  }
  return { status };
}

function parseHits(body: string): ProbeHit[] {
  const value = JSON.parse(body);
  if (!Array.isArray(value)) {
    throw new Error(`POST /memories/search 响应不是数组:${excerpt(body)}`);
  }
  const hits: ProbeHit[] = [];
  for (const element of value) {
    const score = Reflect.get(element, 'similarity_score');
    if (typeof score !== 'number') {
      throw new Error(`检索命中缺少数值型 similarity_score:${excerpt(body)}`);
    }
    const memory = Reflect.get(element, 'memory');
    if (memory === null || memory === undefined) {
      hits.push({ memory: null, similarityScore: score });
      continue;
    }
    const id = Reflect.get(memory, 'id');
    const content = Reflect.get(memory, 'content');
    if (typeof id !== 'string' || typeof content !== 'string') {
      throw new Error(`检索命中的 memory 缺少字符串 id/content:${excerpt(body)}`);
    }
    hits.push({ memory: { id, content }, similarityScore: score });
  }
  return hits;
}

function parseSaveResult(body: string): ProbeSaveResult {
  const value = JSON.parse(body);
  if (typeof value !== 'object' || value === null) {
    throw new Error(`POST /memories 响应不是 JSON 对象:${excerpt(body)}`);
  }
  const action = Reflect.get(value, 'action');
  const memory = Reflect.get(value, 'memory');
  if (action !== 'created' && action !== 'updated') {
    throw new Error(`POST /memories 响应 action 不是 created/updated:${excerpt(body)}`);
  }
  if (typeof memory !== 'object' || memory === null) {
    throw new Error(`POST /memories 响应缺少 memory 对象:${excerpt(body)}`);
  }
  const id = Reflect.get(memory, 'id');
  if (typeof id !== 'string') {
    throw new Error(`POST /memories 响应的 memory 缺少字符串 id:${excerpt(body)}`);
  }
  return { id, action };
}

function parseRecord(body: string): ProbeRecord {
  const value = JSON.parse(body);
  if (typeof value !== 'object' || value === null) {
    throw new Error(`GET /memories/{id} 响应不是 JSON 对象:${excerpt(body)}`);
  }
  const id = Reflect.get(value, 'id');
  const content = Reflect.get(value, 'content');
  const source = Reflect.get(value, 'source');
  const metadata = Reflect.get(value, 'metadata');
  if (typeof id !== 'string' || typeof content !== 'string' || typeof source !== 'string') {
    throw new Error(`GET /memories/{id} 响应缺少字符串 id/content/source:${excerpt(body)}`);
  }
  if (typeof metadata !== 'object' || metadata === null) {
    throw new Error(`GET /memories/{id} 响应缺少 metadata 对象:${excerpt(body)}`);
  }
  const agentId = Reflect.get(metadata, 'agent_id');
  const sourceApp = Reflect.get(metadata, 'source_app');
  if (typeof agentId !== 'string' || typeof sourceApp !== 'string') {
    throw new Error(`GET /memories/{id} 的 metadata 缺少溯源字段 agent_id/source_app:${excerpt(body)}`);
  }
  return { id, content, source, agentId, sourceApp };
}

async function writeProbe(content: string): Promise<ProbeResponse> {
  return callMem('POST', '/memories', jsonHeaders(), saveBody(content, AGENT_ID));
}

async function readProbe(): Promise<ProbeResponse> {
  return callMem('GET', `/memories/${PROBE_ID}`, plainHeaders());
}

async function deleteProbe(): Promise<ProbeResponse> {
  return callMem('DELETE', `/memories/${PROBE_ID}`, plainHeaders());
}

function expectProbeRecord(record: ProbeRecord, content: string): void {
  expect(record.id).toBe(PROBE_ID);
  expect(record.content).toBe(content);
  expect(record.source).toBe(SOURCE);
  expect(record.agentId).toBe(AGENT_ID);
  expect(record.sourceApp).toBe(SOURCE_APP);
}

async function expectProbeRemoved(): Promise<void> {
  const removed = await deleteProbe();
  expect(removed.status).toBeGreaterThanOrEqual(200);
  expect(removed.status).toBeLessThan(300);
  const afterDelete = await readProbe();
  expect(afterDelete.status).toBe(404);
}

describe('Nowledge Mem 契约 · 探活与鉴权(opt-in:NMEM_CONTRACT_BASE_URL 已设才执行)', () => {
  it('GET /health 返回 200 与 ok 状态', async ({ skip }) => {
    if (!CONTRACT_ENABLED) {
      skip();
      return;
    }
    const response = await callMem('GET', '/health', plainHeaders());
    expect(response.status).toBe(200);
    expect(parseHealth(response.body).status).toBe('ok');
  });

  it('鉴权走数据端点:假 key 401,无 key 200', async ({ skip }) => {
    if (!CONTRACT_ENABLED) {
      skip();
      return;
    }
    const withInvalidKey = await callMem('GET', '/memories', bearerHeaders(INVALID_PROBE_KEY));
    console.log(`[contract] GET /memories 带无效 key 的状态码:${withInvalidKey.status}`);
    expect(withInvalidKey.status).toBe(401);
    const withoutKey = await callMem('GET', '/memories', plainHeaders());
    console.log(`[contract] GET /memories 不带鉴权头的状态码:${withoutKey.status}`);
    expect(withoutKey.status).toBe(200);
  });
});

describe('Nowledge Mem 契约 · 检索形态与延迟', () => {
  it('POST /memories/search 的 fast 结果逐元素可收窄,并观测 deep 延迟', async ({ skip }) => {
    if (!CONTRACT_ENABLED) {
      skip();
      return;
    }
    const fast = await callMem('POST', '/memories/search', jsonHeaders(), searchBody(PROBE_QUERY, 'fast'));
    expect(fast.status).toBe(200);
    const hits = parseHits(fast.body);
    expect(Array.isArray(hits)).toBe(true);
    for (const hit of hits) {
      expect(typeof hit.similarityScore).toBe('number');
      expect(Number.isFinite(hit.similarityScore)).toBe(true);
      if (hit.memory !== null) {
        expect(hit.memory.id.length).toBeGreaterThan(0);
        expect(typeof hit.memory.content).toBe('string');
      }
    }
    const startedAt = Date.now();
    const deep = await callMem('POST', '/memories/search', jsonHeaders(), searchBody(PROBE_QUERY, 'deep'));
    const elapsedMs = Date.now() - startedAt;
    console.log(`[contract] deep 检索耗时 ${elapsedMs}ms(${hits.length} 条 fast 命中;信息性记录,无阈值断言)`);
    expect(deep.status).toBe(200);
    expect(parseHits(deep.body).length).toBeGreaterThanOrEqual(0);
  });
});

describe('Nowledge Mem 契约 · 沙箱写读回与 agent_id 规则', () => {
  it('固定 id 沙箱写读回,溯源字段在位,随后 DELETE 清理并读回 404', async ({ skip }) => {
    if (!CONTRACT_ENABLED) {
      skip();
      return;
    }
    const content = `${PROBE_CONTENT_PREFIX} ${new Date().toISOString()}`;
    const write = await writeProbe(content);
    expect(write.status).toBe(200);
    const saved = parseSaveResult(write.body);
    console.log(`[contract] 固定 id 写入的 action:${saved.action}`);
    expect(saved.id).toBe(PROBE_ID);
    expect(['created', 'updated']).toContain(saved.action);
    const read = await readProbe();
    expect(read.status).toBe(200);
    expectProbeRecord(parseRecord(read.body), content);
    await expectProbeRemoved();
  });

  it('agent_id 中文样本被服务端拒绝(422)', async ({ skip }) => {
    if (!CONTRACT_ENABLED) {
      skip();
      return;
    }
    const content = `${PROBE_CONTENT_PREFIX} ${new Date().toISOString()}`;
    const rejected = await callMem('POST', '/memories', jsonHeaders(), saveBody(content, INVALID_AGENT_ID));
    console.log(`[contract] agent_id=${INVALID_AGENT_ID} 的写入响应:${rejected.status} ${excerpt(rejected.body)}`);
    if (rejected.status >= 200 && rejected.status < 300) {
      const cleanup = await deleteProbe();
      console.log(`[contract] 意外写入成功,清理探针状态码:${cleanup.status}`);
    }
    expect(rejected.status).toBe(422);
  });
});
