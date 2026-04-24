import { describe, expect, it } from 'vitest';
import { hashReportContent } from './sha256-report.js';

/**
 * Polyfill ponctuel pour Node < 20 sans Web Crypto. Node 20 LTS l'expose
 * globalement — ceci est une ceinture plus bretelles pour les CI hétérogènes.
 */
function ensureWebCrypto(): void {
  if (globalThis.crypto?.subtle !== undefined) return;
  // Lors d'un runtime sans Web Crypto, on ne peut simplement pas tester — le
  // package `@kinhale/crypto` lèverait `CRYPTO_UNAVAILABLE`. On laisse le test
  // échouer explicitement via son expect plutôt que de dégrader en SHA logiciel.
}

describe('hashReportContent', () => {
  it('produit un digest hex 64 caractères minuscules', async () => {
    ensureWebCrypto();
    const hash = await hashReportContent('Hello Kinhale');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe (même contenu → même hash)', async () => {
    const a = await hashReportContent('Rapport test');
    const b = await hashReportContent('Rapport test');
    expect(a).toBe(b);
  });

  it("diffère d'un seul byte à l'autre (collision improbable)", async () => {
    const a = await hashReportContent('Rapport A');
    const b = await hashReportContent('Rapport B');
    expect(a).not.toBe(b);
  });

  it('respecte le vecteur SHA-256 pour chaîne vide', async () => {
    // Vecteur FIPS 180-4 : SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hash = await hashReportContent('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
