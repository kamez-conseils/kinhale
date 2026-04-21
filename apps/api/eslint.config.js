import kinhale from '@kinhale/eslint-config'

export default [
  ...kinhale,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]
