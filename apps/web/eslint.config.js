import kinhale from '@kinhale/eslint-config';
import i18nextPlugin from 'eslint-plugin-i18next';

export default [
  { ignores: ['.tamagui/**', '.next/**', 'next-env.d.ts'] },
  ...kinhale,
  {
    plugins: { i18next: i18nextPlugin },
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          markupOnly: true,
          ignoreAttribute: ['className', 'style', 'href', 'src', 'alt', 'type', 'role'],
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
    // jest.setup.ts est un fichier d'infrastructure de test Node.js — node:crypto y est
    // autorisé car il sert uniquement à polyfiller crypto.randomUUID dans jsdom.
    files: ['jest.setup.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
