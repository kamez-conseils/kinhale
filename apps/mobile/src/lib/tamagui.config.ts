import { defaultConfig } from '@tamagui/config/v4'
import { createTamagui, type TamaguiInternalConfig } from 'tamagui'

const config: TamaguiInternalConfig = createTamagui(defaultConfig)

export default config
export type AppConfig = typeof config

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}
