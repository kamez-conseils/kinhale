import frCommon from './locales/fr/common.json';
import enCommon from './locales/en/common.json';

export const resources = {
  fr: { common: frCommon },
  en: { common: enCommon },
} as const;

export const defaultNS = 'common' as const;
export const supportedLngs = ['fr', 'en'] as const;
export type SupportedLng = (typeof supportedLngs)[number];
