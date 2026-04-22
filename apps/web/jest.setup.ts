import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Node 17+ expose structuredClone globalement, mais certaines versions de jsdom
// l'omettent. fake-indexeddb en a besoin pour cloner les valeurs insérées
// (y compris Uint8Array — JSON.parse/stringify ne suffit pas).
if (typeof globalThis.structuredClone === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const v8 = require('v8') as {
    deserialize: (buf: Buffer) => unknown;
    serialize: (val: unknown) => Buffer;
  };
  globalThis.structuredClone = <T>(val: T): T => v8.deserialize(v8.serialize(val)) as T;
}

// jsdom ne fournit pas crypto.randomUUID — polyfill depuis Node.js webcrypto
if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

// jsdom ne fournit pas window.matchMedia — requis par Tamagui
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
