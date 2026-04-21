import kinhale from '@kinhale/eslint-config';

export default [
  ...kinhale,
  {
    files: ['*.{js,mjs,cjs}', '*.config.{js,mjs,cjs,ts}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
