import { describe, it, expect } from 'vitest';
import { generateStorageKey } from './key.js';

describe('generateStorageKey', () => {
  it('retourne 32 bytes', async () => {
    expect((await generateStorageKey()).length).toBe(32);
  });
  it('génère des clés uniques', async () => {
    const keys = await Promise.all(Array.from({ length: 100 }, () => generateStorageKey()));
    const set = new Set(keys.map((k) => Buffer.from(k).toString('hex')));
    expect(set.size).toBe(100);
  });
});
