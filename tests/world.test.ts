import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger, ToolCallContext, ToolDef, ToolOutcome } from 'cortico/core/types.ts';
import { dryMountWorld, fakeWorldContext } from 'cortico/extensions/dry-mount.ts';
import type { WorldContext } from 'cortico/world.ts';
import { NMEM } from '../src/definition.ts';
import { NMEM_CONFIG_GROUP, NMEM_DEFAULTS, type NmemConfigSection } from '../src/config.ts';
import type {
  MemoryHit,
  MemoryRecord,
  MemorySavePayload,
  MemorySaveResult,
  MemorySearchOptions,
} from '../src/mem/types.ts';
import type { NmemToolClient } from '../src/tools.ts';
import { NmemWorld } from '../src/world.ts';
import describeFile from '../describe.json';
import { FakeHost } from './helpers/fake-host.ts';

let scratchDir: string;
beforeEach(() => { scratchDir = mkdtempSync(join(tmpdir(), 'nmem-world-')); });
afterEach(() => rmSync(scratchDir, { recursive: true, force: true }));

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

class RecordingClient implements NmemToolClient {
  searchCalls: { query: string; options?: MemorySearchOptions }[] = [];
  getCalls: string[] = [];
  saveCalls: MemorySavePayload[] = [];
  hits: MemoryHit[] = [];

  async searchMemories(query: string, options?: MemorySearchOptions): Promise<MemoryHit[]> {
    this.searchCalls.push({ query, options });
    return this.hits;
  }

  async getMemory(id: string): Promise<MemoryRecord | null> {
    this.getCalls.push(id);
    return null;
  }

  async saveMemory(payload: MemorySavePayload): Promise<MemorySaveResult> {
    this.saveCalls.push(payload);
    return { memory: { id: 'mem-fake', content: 'fake' }, action: 'created' };
  }
}

function textOf(result: string | ToolOutcome): string {
  return typeof result === 'string' ? result : result.text;
}

function toolNamed(tools: ToolDef[], name: string): ToolDef {
  const found = tools.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`工具未声明:${name}`);
  return found;
}

function worldWithFakeClient(client: NmemToolClient): {
  world: NmemWorld;
  ctx: WorldContext<NmemConfigSection>;
} {
  const ctx = fakeWorldContext(NMEM, { scratchDir });
  const world = new NmemWorld({
    cfg: ctx.cfg,
    timezone: ctx.timezone,
    client,
  });
  return { world, ctx };
}

describe('Nowledge Mem World 挂载', () => {
  it('干装载不报失败:装载器会接受它', async () => {
    const report = await dryMountWorld(NMEM, { scratchDir, packageDir: process.cwd() });
    expect(report.failures).toEqual([]);
  });

  it('默认禁用', () => {
    expect(NMEM_DEFAULTS.enabled).toBe(false);
    expect(NMEM.defaults().enabled).toBe(false);
  });

  it('挂载时投一条 nmem.started 事件,origin 是 internal', async () => {
    const world = NMEM.create(fakeWorldContext(NMEM, { scratchDir }));
    const host = new FakeHost();
    await world.start(host);
    expect(host.events.map((e) => e.type)).toEqual(['nmem.started']);
    expect(host.events[0].origin).toBe('internal');
    expect(host.events[0].source).toBe('nmem');
    expect(host.events[0].text).toBe('Nowledge Mem World 已挂载,nmem_search/nmem_get/nmem_save 可用。');
    expect(host.pushOpts).toEqual([undefined]);
    expect(host.store.latestCursor()).toBe(1);
    expect(host.store.get(1)?.type).toBe('nmem.started');
    expect(host.store.range({})).toEqual(host.events);
    expect(host.store.around(1, 0, 0)).toEqual(host.events);
    expect(host.store.grep({ keyword: '挂载', context: 0 })).toHaveLength(1);
    await world.stop();
  });
});

describe('Nowledge Mem World 工具与配置', () => {
  it('提供三个记忆工具,环境变量表仍为空', () => {
    const world = NMEM.create(fakeWorldContext(NMEM, { scratchDir }));
    const tools = world.tools();
    expect(tools.map((tool) => tool.name)).toEqual(['nmem_search', 'nmem_get', 'nmem_save']);
    expect(tools.map((tool) => tool.tags)).toEqual([['read'], ['read'], ['write']]);
    expect(world.envPromptVars()).toEqual({});
  });

  it('ConfigGroup 只声明四个自有旋钮,enabled 归 World 总览开关', () => {
    expect(Object.keys(NMEM_CONFIG_GROUP.schema.properties)).toEqual([
      'worlds.nmem.baseUrl',
      'worlds.nmem.searchLimit',
      'worlds.nmem.searchMode',
      'worlds.nmem.agentId',
    ]);
    expect(NMEM_CONFIG_GROUP.schema.properties).not.toHaveProperty('worlds.nmem.enabled');
  });
});

describe('Nowledge Mem World 自描述', () => {
  it('describe.json 与定义中的工具、事件及 ENV_PROMPT 内容一致', () => {
    const world = NMEM.create(fakeWorldContext(NMEM, { scratchDir }));
    const envDocs = (world.webUi?.().promptDocs ?? []).filter((doc) => doc.role === 'envPrompt');
    expect(envDocs.map((doc) => doc.key)).toEqual(['worlds.nmem.envPrompt']);
    expect(describeFile.tools.map((tool) => tool.name)).toEqual([
      'nmem_search',
      'nmem_get',
      'nmem_save',
    ]);
    expect(describeFile.tools).toEqual(NMEM.describe?.tools ?? []);
    expect(describeFile.events).toEqual(NMEM.describe?.events ?? []);
    expect(describeFile.prompts).toEqual(envDocs.map((doc) => ({
      key: doc.key,
      title: doc.title,
      role: doc.role,
      content: readFileSync(doc.path, 'utf8'),
    })));
  });
});

describe('Nowledge Mem World 接线', () => {
  it('envPromptVars 返回空表且不发起任何 Mem I/O', () => {
    const client = new RecordingClient();
    const { world } = worldWithFakeClient(client);
    expect(world.envPromptVars()).toEqual({});
    expect(client.searchCalls).toEqual([]);
    expect(client.getCalls).toEqual([]);
    expect(client.saveCalls).toEqual([]);
  });

  it('注入的 client 决定回执,cfg 热改后缺省值随读随新', async () => {
    const client = new RecordingClient();
    client.hits = [
      { memory: { id: 'mem-1', content: '用户的猫叫 Pixel', title: '猫' }, similarity_score: 0.9 },
    ];
    const { world, ctx } = worldWithFakeClient(client);
    const search = toolNamed(world.tools(), 'nmem_search');
    expect(textOf(await search.handler({ query: '猫' }, CALL))).toBe(
      '找到 1 条相关记忆:\n1. [0.90] 猫 — 用户的猫叫 Pixel(id: mem-1)\n需要全文时,用 nmem_get 按 id 读取。',
    );
    expect(client.searchCalls[0]?.options).toEqual({ limit: 5, mode: 'fast' });
    ctx.persist({ searchLimit: 8, searchMode: 'deep' });
    await search.handler({ query: '猫' }, CALL);
    expect(client.searchCalls[1]?.options).toEqual({ limit: 8, mode: 'deep' });
  });

  it('cfg 热改 agentId 后 nmem_save 用新值溯源', async () => {
    const client = new RecordingClient();
    const { world, ctx } = worldWithFakeClient(client);
    const save = toolNamed(world.tools(), 'nmem_save');
    expect(await save.handler({ content: '缺省溯源' }, CALL)).toEqual({ text: '已新建记忆 mem-fake。' });
    expect(client.saveCalls[0]?.agent_id).toBe('coopanion');
    ctx.persist({ agentId: 'coo-pet' });
    await save.handler({ content: '热改后溯源' }, CALL);
    expect(client.saveCalls[1]?.agent_id).toBe('coo-pet');
  });
});

describe('FakeHost', () => {
  it('提供附件、模型能力与日志的空实现', () => {
    const host = new FakeHost();
    host.blobs.set('mem:1', { bytes: new Uint8Array([1]), mime: 'text/plain' });
    expect(host.blob('mem:1')?.mime).toBe('text/plain');
    expect(host.blob('missing')).toBeNull();
    expect(host.modelFacts.model()).toBe('test');
    expect(host.modelFacts.accepts('text/plain')).toBe(false);
    expect(host.modelFacts.contextWindow()).toBe(128000);
    expect(host.log.child('nmem')).toBe(host.log);
    host.log.info('test');
  });
});
