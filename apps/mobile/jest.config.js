/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@kinhale/i18n$': '<rootDir>/../../packages/i18n/src/index.ts',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|tamagui|@tamagui/.*)',
  ],
}
