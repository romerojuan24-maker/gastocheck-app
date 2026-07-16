import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import es from '../locales/es.json';
import en from '../locales/en.json';
import ptBR from '../locales/pt-BR.json';

export const resources = {
  es: { translation: es },
  en: { translation: en },
  'pt-BR': { translation: ptBR },
} as const;

// Detectar idioma del dispositivo
const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'es';
const normalizedLang = deviceLanguage === 'pt' ? 'pt-BR' : deviceLanguage;
const detectedLang = (normalizedLang in resources) ? normalizedLang : 'es';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectedLang,
    fallbackLng: 'es',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
