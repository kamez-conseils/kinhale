import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui, type TamaguiInternalConfig } from 'tamagui';

import { kinhaleDarkColors, kinhaleLightColors } from './colors';

// Each theme exposes a stable set of semantic keys. Components reference them
// via `$key` (e.g. `bg="$surface"` or `color="$maintInk"`).
const kinhale_light = {
  background: kinhaleLightColors.bg,
  surface: kinhaleLightColors.surface,
  surface2: kinhaleLightColors.surface2,
  borderColor: kinhaleLightColors.line,
  borderColorStrong: kinhaleLightColors.lineStrong,
  color: kinhaleLightColors.ink,
  colorMuted: kinhaleLightColors.ink2,
  colorMore: kinhaleLightColors.ink3,
  colorFaint: kinhaleLightColors.ink4,

  maint: kinhaleLightColors.maint,
  maintSoft: kinhaleLightColors.maintSoft,
  maintInk: kinhaleLightColors.maintInk,

  rescue: kinhaleLightColors.rescue,
  rescueSoft: kinhaleLightColors.rescueSoft,
  rescueInk: kinhaleLightColors.rescueInk,

  amber: kinhaleLightColors.amber,
  amberSoft: kinhaleLightColors.amberSoft,
  amberInk: kinhaleLightColors.amberInk,

  ok: kinhaleLightColors.ok,
  okSoft: kinhaleLightColors.okSoft,
  okInk: kinhaleLightColors.okInk,

  miss: kinhaleLightColors.miss,
  missSoft: kinhaleLightColors.missSoft,

  white: kinhaleLightColors.white,
} as const;

const kinhale_dark = {
  background: kinhaleDarkColors.bg,
  surface: kinhaleDarkColors.surface,
  surface2: kinhaleDarkColors.surface2,
  borderColor: kinhaleDarkColors.line,
  borderColorStrong: kinhaleDarkColors.lineStrong,
  color: kinhaleDarkColors.ink,
  colorMuted: kinhaleDarkColors.ink2,
  colorMore: kinhaleDarkColors.ink3,
  colorFaint: kinhaleDarkColors.ink4,

  maint: kinhaleDarkColors.maint,
  maintSoft: kinhaleDarkColors.maintSoft,
  maintInk: kinhaleDarkColors.maintInk,

  rescue: kinhaleDarkColors.rescue,
  rescueSoft: kinhaleDarkColors.rescueSoft,
  rescueInk: kinhaleDarkColors.rescueInk,

  amber: kinhaleDarkColors.amber,
  amberSoft: kinhaleDarkColors.amberSoft,
  amberInk: kinhaleDarkColors.amberInk,

  ok: kinhaleDarkColors.ok,
  okSoft: kinhaleDarkColors.okSoft,
  okInk: kinhaleDarkColors.okInk,

  miss: kinhaleDarkColors.miss,
  missSoft: kinhaleDarkColors.missSoft,

  white: kinhaleDarkColors.white,
} as const;

const kinhaleConfig: TamaguiInternalConfig = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    kinhale_light,
    kinhale_dark,
  },
});

export default kinhaleConfig;
export type KinhaleConfig = typeof kinhaleConfig;
export { kinhale_light, kinhale_dark };
