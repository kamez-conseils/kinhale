import { describe, it, expect } from 'vitest';
import { generateInvitationToken } from './token.js';

describe('generateInvitationToken', () => {
  it('retourne un hex de 64 caractères (32 bytes)', async () => {
    const token = await generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('génère des tokens uniques sur 1000 itérations', async () => {
    const tokens = new Set(
      await Promise.all(Array.from({ length: 1000 }, () => generateInvitationToken())),
    );
    expect(tokens.size).toBe(1000);
  });
});
