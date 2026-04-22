/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  testMatch: [
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/app/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/app/**/*.test.{ts,tsx}',
  ],
  moduleNameMapper: {
    '^@kinhale/i18n$': '<rootDir>/../../packages/i18n/src/index.ts',
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    '^expo-secure-store$': '<rootDir>/src/__mocks__/expo-secure-store.ts',
    '^expo-notifications$': '<rootDir>/src/__mocks__/expo-notifications.ts',
    '^expo-device$': '<rootDir>/src/__mocks__/expo-device.ts',
    '^@kinhale/crypto$': '<rootDir>/src/__mocks__/@kinhale/crypto.ts',
    '^@kinhale/sync$': '<rootDir>/src/__mocks__/@kinhale/sync.ts',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|tamagui|@tamagui/.*)',
  ],
};
