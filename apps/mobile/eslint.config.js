import kinhale from '@kinhale/eslint-config'
import i18nextPlugin from 'eslint-plugin-i18next'

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
          ignoreAttribute: ['testID', 'accessibilityLabel', 'style', 'className'],
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
]
