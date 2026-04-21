import type { NextConfig } from 'next'
import { withTamagui } from '@tamagui/next-plugin'

const nextConfig: NextConfig = {
  transpilePackages: [
    'react-native-web',
    'tamagui',
    '@tamagui/core',
    '@tamagui/config',
    '@tamagui/animations-react-native',
  ],
}

export default withTamagui({
  config: './src/lib/tamagui.config.ts',
  components: ['tamagui'],
  outputCSS: './public/tamagui.css',
  disableExtraction: process.env.NODE_ENV === 'development',
})(nextConfig)
