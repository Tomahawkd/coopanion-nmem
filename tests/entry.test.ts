import { describe, expect, it } from 'vitest';
import entry from '../src/index.ts';
import { NMEM } from '../src/definition.ts';

describe('Package entry', () => {
  it('default export re-exports the same WorldDefinition reference', () => {
    expect(entry).toBe(NMEM);
  });
});
