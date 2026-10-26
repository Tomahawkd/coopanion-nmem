import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dryMountWorld, fakeWorldContext } from 'cortico/extensions/dry-mount.ts';
import { NMEM } from '../src/definition.ts';
import { NMEM_DEFAULTS } from '../src/config.ts';
import describeFile from '../describe.json';
import { FakeHost } from './helpers/fake-host.ts';

let scratchDir: string;
beforeEach(() => { scratchDir = mkdtempSync(join(tmpdir(), 'nmem-world-')); });
afterEach(() => rmSync(scratchDir, { recursive: true, force: true }));

describe('Nowledge Mem World', () => {
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
    expect(host.store.latestCursor()).toBe(1);
    expect(host.store.get(1)?.type).toBe('nmem.started');
    expect(host.store.range({})).toEqual(host.events);
    expect(host.store.around(1, 0, 0)).toEqual(host.events);
    expect(host.store.grep({ keyword: '挂载', context: 0 })).toHaveLength(1);
    await world.stop();
  });

  it('当前不提供工具,环境变量表为空', () => {
    const world = NMEM.create(fakeWorldContext(NMEM, { scratchDir }));
    expect(world.tools()).toEqual([]);
    expect(world.envPromptVars()).toEqual({});
  });

  it('describe.json 与定义中的工具、事件及 ENV_PROMPT 内容一致', () => {
    const world = NMEM.create(fakeWorldContext(NMEM, { scratchDir }));
    const envDocs = (world.webUi?.().promptDocs ?? []).filter((doc) => doc.role === 'envPrompt');
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
