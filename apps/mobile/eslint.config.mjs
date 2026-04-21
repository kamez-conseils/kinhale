import kinhale from '@kinhale/eslint-config';
import i18nextPlugin from 'eslint-plugin-i18next';

export default [
  { ignores: ['.expo/**', 'babel.config.js', 'metro.config.js', 'jest.config.js'] },
  ...kinhale,
  {
    plugins: { i18next: i18nextPlugin },
    files: ['src/**/*.{ts,tsx}', 'App.tsx'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          markupOnly: true,
          ignoreAttribute: ['testID', 'style', 'className'],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'i18next/no-literal-string': 'off',
    },
  },
  {
    // require() inside Jest resetModules / dynamic require patterns is the
    // standard Jest idiom — disable import rules for all test files and the
    // Jest setup file.
    files: [
      '**/__tests__/**/*.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'jest.setup.js',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
