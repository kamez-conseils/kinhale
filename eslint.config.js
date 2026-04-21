import kinhale from '@kinhale/eslint-config';

export default [
  {
    ignores: ['apps/web/.tamagui/**', 'apps/web/.next/**', 'apps/web/next-env.d.ts'],
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
];
