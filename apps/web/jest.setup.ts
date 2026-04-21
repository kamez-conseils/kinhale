import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';

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
