import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const customConfig: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
    '^@kinhale/i18n$': '<rootDir>/../../packages/i18n/src/index.ts',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react-native-web|@tamagui|tamagui|@react-native)/)',
  ],
}

const jestConfig: () => Promise<Config> = createJestConfig(customConfig)
export default jestConfig
