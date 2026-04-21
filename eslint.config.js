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
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // jest.setup.ts est un fichier d'infrastructure de test Node.js uniquement.
    // node:crypto y est autorisé pour polyfiller crypto.randomUUID dans jsdom.
    files: ['**/jest.setup.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
