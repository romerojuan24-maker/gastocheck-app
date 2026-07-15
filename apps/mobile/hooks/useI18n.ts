import { useTranslation as useI18nTranslation } from 'react-i18next';

export function useI18n() {
  const { t, i18n } = useI18nTranslation();

  return {
    t,
    language: i18n.language,
    changeLanguage: (lang: string) => i18n.changeLanguage(lang),
    isSpanish: i18n.language.startsWith('es'),
    isEnglish: i18n.language.startsWith('en'),
  };
}
