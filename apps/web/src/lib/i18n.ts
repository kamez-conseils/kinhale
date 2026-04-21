import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, defaultNS, supportedLngs } from '@kinhale/i18n';

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: 'fr',
    fallbackLng: 'en',
    defaultNS,
    supportedLngs: [...supportedLngs],
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
