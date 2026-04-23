import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const customConfig: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^@kinhale/i18n$': '<rootDir>/../../packages/i18n/src/index.ts',
    '^@kinhale/crypto$': '<rootDir>/../../packages/crypto/src/index.ts',
    '^@kinhale/sync$': '<rootDir>/../../packages/sync/src/index.ts',
    '^@kinhale/sync/client$': '<rootDir>/../../packages/sync/src/client/index.ts',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-native-web|@tamagui|tamagui|@react-native|idb|fake-indexeddb)/)/',
  ],
};

const jestConfig: () => Promise<Config> = createJestConfig(customConfig);
export default jestConfig;
