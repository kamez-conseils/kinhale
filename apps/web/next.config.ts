import type { NextConfig } from 'next';
import { withTamagui } from '@tamagui/next-plugin';

const nextConfig: NextConfig = {
  transpilePackages: [
    'react-native-web',
    'tamagui',
    '@tamagui/core',
    '@tamagui/config',
    '@tamagui/animations-react-native',
    '@kinhale/crypto',
    '@kinhale/sync',
    '@kinhale/i18n',
    '@kinhale/domain',
    '@kinhale/ui',
  ],
  webpack: (config) => {
    // Les packages monorepo utilisent NodeNext (imports avec extension .js)
    // mais sont en source TypeScript. On dit à webpack de tenter .ts/.tsx avant .js.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default withTamagui({
  config: './src/lib/tamagui.config.ts',
  components: ['tamagui'],
  outputCSS: './public/tamagui.css',
  disableExtraction: process.env.NODE_ENV === 'development',
})(nextConfig);
