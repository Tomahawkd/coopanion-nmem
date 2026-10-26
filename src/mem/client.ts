import {
  parseMemHealth,
  parseMemoryHits,
  parseMemoryRecord,
  parseMemorySaveResult,
  type MemHealth,
  type MemoryHit,
  type MemoryRecord,
  type MemorySavePayload,
  type MemorySaveResult,
  type MemorySearchOptions,
  type MemorySearchRequest,
} from './types.ts';

/** 单次请求的超时上限;本机 deep 检索实测约 2.2s。 */
export const MEM_TIMEOUT_MS = 10_000;

const SERVER_RETRY_DELAY_MS = 500;
const RATE_LIMIT_RETRY_DELAY_MS = 1000;
const RESPONSE_EXCERPT_LIMIT = 300;
const RETRYABLE_SERVER_STATUSES: readonly number[] = [502, 503, 504];

export type MemMethod = 'GET' | 'POST';

/** 客户端发出的请求头;`Authorization` 只在配置了 key 时出现。 */
export type MemRequestHeaders = {
  Accept: string;
  'Content-Type'?: string;
  Authorization?: string;
};

/** 交给 transport 的一次请求。 */
export interface MemTransportRequest {
  method: MemMethod;
  headers: MemRequestHeaders;
  body?: string;
  signal?: AbortSignal;
}

/** transport 返回的响应;测试注入的实现只需实现这三个成员。 */
export interface MemResponse {
  status: number;
  headers: MemResponseHeaders;
  text(): Promise<string>;
}

export interface MemResponseHeaders {
  get(name: string): string | null;
}

/** HTTP 传输缝;缺省用全局 `fetch`。 */
export type MemTransport = (url: string, request: MemTransportRequest) => Promise<MemResponse>;

/** Mem 客户端错误的基类;调用方按具体子类决定回执文案。 */
export class MemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** HTTP 非 2xx;携带状态码与截断后的响应摘要。 */
export class MemHttpError extends MemError {
  constructor(readonly status: number, readonly excerpt: string) {
    super(`Mem 请求失败(${status}):${excerpt}`);
  }
}

/** 401:API key 无效或已轮转;不重试。 */
export class MemAuthError extends MemHttpError {}

/** 429:触发限流;已做单次退避,仍失败即止。 */
export class MemRateLimitError extends MemHttpError {}

/** 502/503/504:服务端暂时不可用;已做单次重试。 */
export class MemServerError extends MemHttpError {}

/** 响应不是合法 JSON,或形状与端点契约不符。 */
export class MemProtocolError extends MemError {}

/** 传输失败或超时;不重试。 */
export class MemTransportError extends MemError {}

const fetchTransport: MemTransport = async (url, request) => {
  const response = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
  });
  return { status: response.status, headers: response.headers, text: () => response.text() };
};

interface MemReply {
  status: number;
  headers: MemResponseHeaders;
  body: string;
}

export interface MemClientOptions {
  baseUrl: string;
  /** 为空或缺失时完全不发鉴权头:本机 Mem 免 key,带错 key 反而 401。 */
  apiKey?: string;
  transport?: MemTransport;
}

/** Nowledge Mem REST 客户端:传输、鉴权头决策、超时、重试与 ingress 收窄的唯一所有者。 */
export class MemClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly transport: MemTransport;

  constructor(options: MemClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey ?? '';
    this.transport = options.transport ?? fetchTransport;
  }

  /** 混合检索记忆;响应是裸数组,`memory` 为 null 的命中原样返回给调用方处置。 */
  async searchMemories(query: string, options: MemorySearchOptions = {}): Promise<MemoryHit[]> {
    const payload: MemorySearchRequest = { query, ...options };
    const reply = await this.send('POST', '/memories/search', JSON.stringify(payload));
    return readBody('memories/search', expectOk(reply), parseMemoryHits);
  }

  /** 按 ID 读取一条记忆;服务端 404 是唯一不抛错的失败分支。 */
  async getMemory(id: string): Promise<MemoryRecord | null> {
    const reply = await this.send('GET', `/memories/${encodeURIComponent(id)}`);
    if (reply.status === 404) return null;
    return readBody('memories/{id}', expectOk(reply), parseMemoryRecord);
  }

  /** 写入记忆;带 `id` 时服务端按 upsert 处理,`action` 区分新建与更新。 */
  async saveMemory(payload: MemorySavePayload): Promise<MemorySaveResult> {
    const reply = await this.send('POST', '/memories', JSON.stringify(payload));
    return readBody('memories', expectOk(reply), parseMemorySaveResult);
  }

  /** 探活;错误分类与重试矩阵与其他端点一致。 */
  async health(): Promise<MemHealth> {
    const reply = await this.send('GET', '/health');
    return readBody('health', expectOk(reply), parseMemHealth);
  }

  private async send(method: MemMethod, path: string, body?: string): Promise<MemReply> {
    const first = await this.attempt(method, path, body);
    const delay = retryDelayMs(first);
    if (delay === null) return first;
    await sleep(delay);
    return this.attempt(method, path, body);
  }

  private async attempt(method: MemMethod, path: string, body?: string): Promise<MemReply> {
    const headers = requestHeaders(this.apiKey, body !== undefined);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MEM_TIMEOUT_MS);
    try {
      const response = await this.transport(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      return { status: response.status, headers: response.headers, body: await response.text() };
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知原因';
      const reason = controller.signal.aborted
        ? `请求超时(${MEM_TIMEOUT_MS}ms)`
        : `无法连接 Nowledge Mem:${detail}`;
      throw new MemTransportError(reason);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function requestHeaders(apiKey: string, hasBody: boolean): MemRequestHeaders {
  const headers: MemRequestHeaders = { Accept: 'application/json' };
  if (apiKey !== '') headers.Authorization = `Bearer ${apiKey}`;
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
}

function retryDelayMs(reply: MemReply): number | null {
  if (reply.status === 429) return retryAfterDelayMs(reply.headers.get('Retry-After'));
  if (RETRYABLE_SERVER_STATUSES.includes(reply.status)) return SERVER_RETRY_DELAY_MS;
  return null;
}

function retryAfterDelayMs(header: string | null): number {
  if (header === null) return RATE_LIMIT_RETRY_DELAY_MS;
  const seconds = Number(header.trim());
  if (!Number.isFinite(seconds) || seconds < 0) return RATE_LIMIT_RETRY_DELAY_MS;
  return seconds * 1000;
}

function expectOk(reply: MemReply): string {
  if (reply.status >= 200 && reply.status < 300) return reply.body;
  throw httpError(reply.status, reply.body);
}

function httpError(status: number, body: string): MemHttpError {
  const excerpt = excerptOf(body);
  if (status === 401) return new MemAuthError(status, excerpt);
  if (status === 429) return new MemRateLimitError(status, excerpt);
  if (RETRYABLE_SERVER_STATUSES.includes(status)) return new MemServerError(status, excerpt);
  return new MemHttpError(status, excerpt);
}

function excerptOf(body: string): string {
  const normalized = body.trim();
  if (normalized.length <= RESPONSE_EXCERPT_LIMIT) return normalized;
  return `${normalized.slice(0, RESPONSE_EXCERPT_LIMIT)}…`;
}

function readBody<T>(endpoint: string, body: string, parse: (body: string) => T | null): T {
  let value: T | null;
  try {
    value = parse(body);
  } catch {
    throw new MemProtocolError('Mem 响应不是合法 JSON');
  }
  if (value === null) throw protocolError(endpoint, body);
  return value;
}

function protocolError(endpoint: string, body: string): MemProtocolError {
  return new MemProtocolError(`Mem 响应形状不符(${endpoint}):${excerptOf(body)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
