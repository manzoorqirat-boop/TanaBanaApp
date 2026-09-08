import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import hi from './locales/hi.json';
import { prefsStorage } from '../lib/storage';

const LANG_KEY = 'lang';

/**
 * Ported from the web app's i18n.ts. Locale JSON files are copied
 * byte-for-byte from src/locales/{en,hi}.json — no key changes needed,
 * react-i18next's API is identical on RN.
 */
export async function initI18n() {
  const stored = await prefsStorage.getItem(LANG_KEY);
  const deviceLang = getLocales()[0]?.languageCode;
  const initialLang = stored || (deviceLang === 'hi' ? 'hi' : 'en');

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  return i18n;
}

export async function changeLanguage(lang: 'en' | 'hi') {
  await i18n.changeLanguage(lang);
  await prefsStorage.setItem(LANG_KEY, lang);
}

export default i18n;
