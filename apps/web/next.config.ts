import path from 'node:path';
import type { NextConfig } from 'next';
import { withTamagui } from '@tamagui/next-plugin';

const nextConfig: NextConfig = {
  // Build autonome : copie node_modules + serveur Node minimal dans
  // `.next/standalone`, exploité par `apps/web/Dockerfile.prod` pour produire
  // une image runtime ~150 Mo au lieu de ~1.2 Go (full workspace install).
  // En monorepo pnpm, la racine du workspace doit être indiquée pour que le
  // tracer Next inclue les fichiers de `packages/*` dans `.next/standalone`.
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
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
