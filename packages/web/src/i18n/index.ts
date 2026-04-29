import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import de from './de.json';
import en from './en.json';
import tr from './tr.json';
import ar from './ar.json';
import hi from './hi.json';
import mr from './mr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      tr: { translation: tr },
      ar: { translation: ar },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    fallbackLng: 'en',
    supportedLngs: ['de', 'en', 'tr', 'ar', 'hi', 'mr'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
