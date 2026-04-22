import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Shared ESLint 9 flat config for the Kinhale monorepo.
 * Paquets et apps étendent cette configuration via `extends` de flat config.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      '.expo/**',
      '.turbo/**',
      'coverage/**',
      'pnpm-lock.yaml',
      '*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Math.random est interdit pour tout usage sécurité. Utilise @kinhale/crypto.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'libsodium-wrappers',
              message: 'Import direct interdit. Utilise @kinhale/crypto.',
            },
            {
              name: 'crypto-js',
              message: 'crypto-js est interdit. Utilise @kinhale/crypto (libsodium).',
            },
            {
              name: 'node:crypto',
              message:
                'node:crypto est Node-only et casse la portabilité web/mobile. Utilise @kinhale/crypto.',
            },
            {
              name: 'crypto',
              message:
                'node:crypto est Node-only et casse la portabilité web/mobile. Utilise @kinhale/crypto.',
            },
            {
              name: 'js-sha256',
              message:
                'Implémentation JS interdite. Utilise @kinhale/crypto (Web Crypto API native).',
            },
            {
              name: 'sha.js',
              message:
                'Implémentation JS interdite. Utilise @kinhale/crypto (Web Crypto API native).',
            },
            {
              name: 'hash.js',
              message:
                'Implémentation JS interdite. Utilise @kinhale/crypto (Web Crypto API native).',
            },
            {
              name: 'crypto-browserify',
              message: 'Polyfill interdit. Utilise @kinhale/crypto (Web Crypto API native).',
            },
            {
              name: 'tweetnacl',
              message: 'Import direct interdit. Utilise @kinhale/crypto.',
            },
          ],
        },
      ],
    },
  },
);
