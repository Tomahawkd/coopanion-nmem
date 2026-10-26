/** Nowledge Mem 的记忆记录;`GET /memories/{id}` 的响应与写入响应里的 `memory` 共用这一形态。 */
export interface MemoryRecord {
  id: string;
  content: string;
  /** 服务端可能返回 null 或省略。 */
  title?: string | null;
}

/** 一次检索命中;服务端其余检索诊断字段(实体、演进上下文、相关链接)本客户端不消费。 */
export interface MemoryHit {
  /** 命中的记忆;服务端可能返回 null,调用方决定如何呈现缺失。 */
  memory: MemoryRecord | null;
  similarity_score: number;
}

/** 检索模式:fast 只跑 BM25+vector,deep 是服务端默认的全量检索。 */
export type MemorySearchMode = 'fast' | 'deep';

/** 检索的可选参数;未提供的项由服务端取默认值。 */
export interface MemorySearchOptions {
  limit?: number;
  mode?: MemorySearchMode;
}

/** `POST /memories/search` 的请求体。 */
export interface MemorySearchRequest extends MemorySearchOptions {
  query: string;
}

/** 知识单元类型,取值与服务端 `unit_type` 一致。 */
export type MemoryUnitType =
  | 'fact'
  | 'preference'
  | 'decision'
  | 'plan'
  | 'procedure'
  | 'learning'
  | 'context'
  | 'event';

/**
 * `POST /memories` 的请求体。
 * `id` 存在时服务端按 upsert 处理;`source`/`source_app`/`agent_id` 等溯源字段由调用方传入,客户端只透传。
 */
export interface MemorySavePayload {
  content: string;
  id?: string;
  title?: string;
  labels?: string[];
  importance?: number;
  unit_type?: MemoryUnitType;
  source?: string;
  source_app?: string;
  agent_id?: string;
}

/** 写入动作:新建记忆,或按 `id` 更新既有记忆。 */
export type MemorySaveAction = 'created' | 'updated';

/** `POST /memories` 的成功响应。 */
export interface MemorySaveResult {
  memory: MemoryRecord;
  action: MemorySaveAction;
}

/** `GET /health` 的探活结果;服务端只保证返回 `status`。 */
export interface MemHealth {
  status: string;
}

/**
 * 解析 `GET /memories/{id}` 的响应体。
 * 形状不符返回 `null`;`JSON.parse` 的语法错误原样抛出,由调用方映射为协议错误。
 */
export function parseMemoryRecord(body: string): MemoryRecord | null {
  const value = JSON.parse(body);
  if (typeof value !== 'object' || value === null) return null;
  const id = Reflect.get(value, 'id');
  const content = Reflect.get(value, 'content');
  if (typeof id !== 'string' || typeof content !== 'string') return null;
  const title = Reflect.get(value, 'title');
  if (title === undefined) return { id, content };
  if (title !== null && typeof title !== 'string') return null;
  return { id, content, title };
}

/**
 * 解析 `POST /memories/search` 的响应体:裸数组,元素 `memory` 可为 null。
 * 形状不符返回 `null`;`JSON.parse` 的语法错误原样抛出,由调用方映射为协议错误。
 */
export function parseMemoryHits(body: string): MemoryHit[] | null {
  const value = JSON.parse(body);
  if (!Array.isArray(value)) return null;
  const hits: MemoryHit[] = [];
  for (const element of value) {
    const score = element?.similarity_score;
    if (typeof score !== 'number') return null;
    const memory = element?.memory;
    if (memory === null) {
      hits.push({ memory: null, similarity_score: score });
      continue;
    }
    const id = memory?.id;
    const content = memory?.content;
    const title = memory?.title;
    if (typeof id !== 'string' || typeof content !== 'string') return null;
    if (title === undefined) {
      hits.push({ memory: { id, content }, similarity_score: score });
      continue;
    }
    if (title !== null && typeof title !== 'string') return null;
    hits.push({ memory: { id, content, title }, similarity_score: score });
  }
  return hits;
}

/**
 * 解析 `POST /memories` 的响应体:`memory` 记录与 `action` 两项契约。
 * 形状不符返回 `null`;`JSON.parse` 的语法错误原样抛出,由调用方映射为协议错误。
 */
export function parseMemorySaveResult(body: string): MemorySaveResult | null {
  const value = JSON.parse(body);
  if (typeof value !== 'object' || value === null) return null;
  const action = Reflect.get(value, 'action');
  if (action !== 'created' && action !== 'updated') return null;
  const memory = Reflect.get(value, 'memory');
  const id = memory?.id;
  const content = memory?.content;
  const title = memory?.title;
  if (typeof id !== 'string' || typeof content !== 'string') return null;
  if (title === undefined) return { memory: { id, content }, action };
  if (title !== null && typeof title !== 'string') return null;
  return { memory: { id, content, title }, action };
}

/**
 * 解析 `GET /health` 的响应体;真实服务只返回 `{"status":"ok"}`。
 * 形状不符返回 `null`;`JSON.parse` 的语法错误原样抛出,由调用方映射为协议错误。
 */
export function parseMemHealth(body: string): MemHealth | null {
  const value = JSON.parse(body);
  if (typeof value !== 'object' || value === null) return null;
  const status = Reflect.get(value, 'status');
  return typeof status === 'string' ? { status } : null;
}
