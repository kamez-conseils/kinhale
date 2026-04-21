import { describe, it, expect } from 'vitest';
import { randomBytes } from './random.js';

describe('randomBytes', () => {
  it('génère N octets aléatoires', async () => {
    const bytes = await randomBytes(32);
    expect(bytes).toHaveLength(32);
  });

  it('deux appels produisent des valeurs différentes', async () => {
    const a = await randomBytes(32);
    const b = await randomBytes(32);
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });
});
