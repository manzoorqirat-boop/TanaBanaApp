import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ur from './locales/ur.json';
import { prefsStorage } from '../lib/storage';

const LANG_KEY = 'lang';
export type SupportedLang = 'en' | 'hi' | 'ur';
const RTL_LANGS: SupportedLang[] = ['ur'];

function isRtl(lang: string): boolean {
  return RTL_LANGS.includes(lang as SupportedLang);
}

/**
 * Ported from the web app's i18n.ts, then extended with Urdu — Urdu
 * isn't in the web app at all (it only ships en/hi), so this is a
 * genuine RN-only addition, not a port. Text is the easy part; Urdu
 * is written right-to-left, and RN's `I18nManager` needs to know that
 * *before* anything renders, since flipping it after the fact doesn't
 * retroactively mirror an already-mounted tree — see the README's
 * "Urdu / RTL support" section for exactly what this does and doesn't
 * cover, and why a real device test matters more than usual here.
 */
export async function initI18n() {
  const stored = await prefsStorage.getItem(LANG_KEY);
  const deviceLang = getLocales()[0]?.languageCode;
  const initialLang: SupportedLang =
    (stored as SupportedLang) || (deviceLang === 'hi' ? 'hi' : deviceLang === 'ur' ? 'ur' : 'en');

  // Must happen before the app's first real render (we're still inside
  // App.tsx's boot spinner at this point, nothing else has mounted) —
  // RN mirrors flex layout automatically once this is set, which
  // covers most of this codebase since every screen is flex-based.
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(isRtl(initialLang));

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ur: { translation: ur },
    },
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  return i18n;
}

/**
 * Returns `true` if switching to `lang` changes the RTL requirement
 * from what's currently active — the caller (LanguageToggle) uses
 * this to decide whether to prompt for a restart. Numbers/dates stay
 * LTR-shaped regardless (handled at the text level, not layout).
 */
export async function changeLanguage(lang: SupportedLang): Promise<{ rtlChanged: boolean }> {
  const rtlChanged = isRtl(lang) !== I18nManager.isRTL;
  await i18n.changeLanguage(lang);
  await prefsStorage.setItem(LANG_KEY, lang);
  if (rtlChanged) {
    I18nManager.forceRTL(isRtl(lang));
  }
  return { rtlChanged };
}

/**
 * Locale for Intl date/number formatting — mirrors the web app's
 * i18n.ts currentLocale(). Numbers stay grouped the Indian way in all
 * three languages; only weekday/month names switch. Note: Urdu date
 * formatting depends on the JS engine's bundled ICU data (Hermes on
 * Android ships a reduced ICU set) — if 'ur-PK' isn't recognized on a
 * given device, `toLocaleDateString` silently falls back to a default
 * formatting rather than throwing, so this degrades gracefully even
 * if Urdu date names aren't available everywhere.
 */
export function currentLocale(): string {
  if (i18n.language === 'hi') return 'hi-IN';
  if (i18n.language === 'ur') return 'ur-PK';
  return 'en-IN';
}

export default i18n;
