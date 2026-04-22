import { describe, it, expect } from 'vitest';
import { generatePin, hashPin, verifyPin } from './pin.js';

describe('generatePin', () => {
  it('retourne 6 chiffres', async () => {
    for (let i = 0; i < 100; i++) {
      expect(await generatePin()).toMatch(/^\d{6}$/);
    }
  });

  it('distribue raisonnablement uniformément sur 10000 tirages', async () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10000; i++) {
      const p = await generatePin();
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const maxRepeat = Math.max(...counts.values());
    // Sur 10000 tirages dans [0..999999], la probabilité de voir un PIN 5+ fois est très faible.
    expect(maxRepeat).toBeLessThanOrEqual(5);
  });
});

describe('hashPin / verifyPin', () => {
  it("verifyPin retourne true pour le PIN d'origine", async () => {
    const pin = '123456';
    const hash = await hashPin(pin);
    expect(await verifyPin(pin, hash)).toBe(true);
  });
  it('verifyPin retourne false pour un PIN différent', async () => {
    const hash = await hashPin('123456');
    expect(await verifyPin('654321', hash)).toBe(false);
  });
  it('deux hashes du même PIN sont différents (salt aléatoire)', async () => {
    const h1 = await hashPin('123456');
    const h2 = await hashPin('123456');
    expect(h1).not.toBe(h2);
  });
});
