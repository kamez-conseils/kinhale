import kinhale from '@kinhale/eslint-config';

export default [
  {
    ignores: [
      'apps/web/.tamagui/**',
      'apps/web/.next/**',
      'apps/web/next-env.d.ts',
      '.worktrees/**/apps/web/.tamagui/**',
      '.worktrees/**/apps/web/.next/**',
      '.worktrees/**/apps/web/next-env.d.ts',
    ],
  },
  ...kinhale,
  {
    files: ['*.{js,mjs,cjs}', '*.config.{js,mjs,cjs,ts}', '**/*.config.{js,mjs,cjs}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // require() dans jest.mock factories + jest.resetModules() est le pattern
    // Jest standard en mode CJS (jest-expo/Babel). Les règles d'import ESM ne
    // s'appliquent pas aux fichiers de test et d'infrastructure Jest.
    files: [
      '**/__tests__/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/jest.setup.{js,ts}',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // jest.setup.ts est un fichier d'infrastructure de test Node.js uniquement.
    // node:crypto y est autorisé pour polyfiller crypto.randomUUID dans jsdom.
    files: ['**/jest.setup.{ts,js}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
