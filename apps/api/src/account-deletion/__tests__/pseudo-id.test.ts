import { describe, it, expect } from 'vitest';
import { computeDeletedAccountPseudoId } from '../pseudo-id.js';

const ACCOUNT_A = '11111111-2222-3333-4444-555555555555';
const ACCOUNT_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PEPPER_1 = 'test-pepper-secret-aaa';
const PEPPER_2 = 'test-pepper-secret-bbb';

describe('computeDeletedAccountPseudoId', () => {
  it('produit un hash hex 64 chars (SHA-256)', async () => {
    const id = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_1);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe pour un même couple (accountId, pepper)', async () => {
    const a = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_1);
    const b = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_1);
    expect(a).toBe(b);
  });

  it('change avec accountId différent (même pepper)', async () => {
    const a = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_1);
    const b = await computeDeletedAccountPseudoId(ACCOUNT_B, PEPPER_1);
    expect(a).not.toBe(b);
  });

  it('change avec pepper différent (même accountId) — empêche les rainbow tables', async () => {
    const a = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_1);
    const b = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_2);
    expect(a).not.toBe(b);
  });

  it("ne contient pas l'accountId en clair (zero-knowledge)", async () => {
    const id = await computeDeletedAccountPseudoId(ACCOUNT_A, PEPPER_1);
    expect(id).not.toContain('11111111');
    expect(id).not.toContain('555');
  });
});
