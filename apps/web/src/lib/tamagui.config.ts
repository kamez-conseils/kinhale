import { kinhaleConfig, type KinhaleConfig } from '@kinhale/ui/theme';

const config = kinhaleConfig;

export default config;
export type AppConfig = KinhaleConfig;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppConfig {}
}
