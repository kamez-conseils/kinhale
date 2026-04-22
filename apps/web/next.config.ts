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
  webpack: (config, { isServer }) => {
    // Les packages monorepo utilisent NodeNext (imports avec extension .js)
    // mais sont en source TypeScript. On dit à webpack de tenter .ts/.tsx avant .js.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    // Automerge 2.x embarque du WebAssembly. L'entrypoint nodejs/automerge_wasm.cjs
    // utilise fs.readFileSync pour charger le .wasm — or le fichier n'est pas copié
    // dans .next/server/vendor-chunks. On force l'entrypoint bundler partout
    // (client + server) + opt-in asyncWebAssembly pour webpack.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    // Sur le serveur, on marque @automerge/automerge comme external pour éviter
    // son eval lors du SSR — les composants qui l'importent sont 'use client'.
    if (isServer) {
      const existingExternals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existingExternals,
        '@automerge/automerge',
        '@automerge/automerge/next',
      ];
    }
    return config;
  },
};

export default withTamagui({
  config: './src/lib/tamagui.config.ts',
  components: ['tamagui'],
  outputCSS: './public/tamagui.css',
  disableExtraction: process.env.NODE_ENV === 'development',
})(nextConfig);
