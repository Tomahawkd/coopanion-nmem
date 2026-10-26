/** World 测试共用的假宿主:记录推送的事件与唤醒口径,其余宿主接口都是空实现。 */
import type {
  EventEnvelope,
  EventGrepHit,
  EventGrepQuery,
  EventRangeQuery,
  EventStoreReader,
  Logger,
  ModelFacts,
  PushOptions,
  WorldHost,
} from 'cortico/core/types.ts';

const NOOP_LOGGER: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  emit: () => {},
  child: () => NOOP_LOGGER,
};

export class FakeHost implements WorldHost {
  events: EventEnvelope[] = [];
  pushDeferred(): void {}
  store: EventStoreReader;
  blobs = new Map<string, { bytes: Uint8Array; mime: string }>();
  blob = (handle: string): { bytes: Uint8Array; mime: string } | null => this.blobs.get(handle) ?? null;
  modelFacts: ModelFacts = {
    model: () => 'test',
    accepts: () => false,
    contextWindow: () => 128000,
  };
  log = NOOP_LOGGER;

  /** 与 events 逐条对齐:唤醒/攒批的口径也要能断言 */
  pushOpts: Array<PushOptions | undefined> = [];

  constructor() {
    this.store = {
      get: (cursor: number) => this.events.find((event) => event.cursor === cursor),
      latestCursor: () => this.events.length,
      range: (q: EventRangeQuery) => {
        const from = q.fromCursor ?? 0;
        const to = q.toCursor ?? Number.MAX_SAFE_INTEGER;
        const selected = this.events.filter((event) => event.cursor >= from && event.cursor <= to);
        return q.limit === undefined ? selected : selected.slice(-q.limit);
      },
      around: (cursor: number, before: number, after: number) => {
        const index = this.events.findIndex((event) => event.cursor === cursor);
        return index < 0 ? [] : this.events.slice(Math.max(0, index - before), index + after + 1);
      },
      grep: (q: EventGrepQuery): EventGrepHit[] => {
        const keyword = q.keyword.toLowerCase();
        const limit = q.limit ?? this.events.length;
        return this.events
          .filter((event) => event.text.toLowerCase().includes(keyword))
          .slice(0, limit)
          .map((event) => ({
            hitCursor: event.cursor,
            events: this.events.slice(
              Math.max(0, event.cursor - 1 - q.context),
              event.cursor + q.context,
            ),
          }));
      },
    };
  }

  async pushEvent(e: Omit<EventEnvelope, 'cursor'>, opts?: PushOptions): Promise<EventEnvelope> {
    const full: EventEnvelope = { ...e, cursor: this.events.length + 1 };
    this.events.push(full);
    this.pushOpts.push(opts);
    return full;
  }
  async drainPendingEvents(): Promise<EventEnvelope[]> {
    return [];
  }
  reportUsage(): void {}
}
