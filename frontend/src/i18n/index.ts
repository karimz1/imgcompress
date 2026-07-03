import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import { ar } from "./locales/ar";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { esMX } from "./locales/es-MX";
import { fr } from "./locales/fr";
import { hi } from "./locales/hi";
import { hu } from "./locales/hu";
import { ja } from "./locales/ja";
import { ptBR } from "./locales/pt-BR";
import { ru } from "./locales/ru";
import { zhCN } from "./locales/zh-CN";
import type { TranslationSchema } from "./types";

export const LOCALE_STORAGE_KEY = "imgcompress_locale";

export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "es-MX",
  "zh-CN",
  "hi",
  "ar",
  "fr",
  "pt-BR",
  "ru",
  "ja",
  "de",
  "hu",
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const resources: Record<Locale, { translation: TranslationSchema }> = {
  ar: { translation: ar },
  de: { translation: de },
  en: { translation: en },
  es: { translation: es },
  "es-MX": { translation: esMX },
  fr: { translation: fr },
  hi: { translation: hi },
  hu: { translation: hu },
  ja: { translation: ja },
  "pt-BR": { translation: ptBR },
  ru: { translation: ru },
  "zh-CN": { translation: zhCN },
};

export function resolveSupportedLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === normalized
  );
  if (exact) return exact;

  const primary = normalized.split("-")[0];
  const primaryLocale = SUPPORTED_LOCALES.find((locale) => locale === primary);
  if (primaryLocale) return primaryLocale;

  if (primary === "pt") return "pt-BR";
  if (primary === "zh") return "zh-CN";

  return null;
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const locale = resolveSupportedLocale(candidate);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const savedLocale = resolveSupportedLocale(saved);
    if (savedLocale) return savedLocale;
  } catch {
    // localStorage unavailable (private browsing, sandboxed iframe, etc.)
  }
  return detectBrowserLocale();
}

const isDev = process.env.NODE_ENV === "development";

i18n.use(initReactI18next).init({
  resources: resources as unknown as Resource,
  // Always start on the default locale so the server-rendered HTML and the first
  // client render match. The stored/detected locale is applied after hydration
  // in I18nProvider to avoid a hydration mismatch.
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: {
    escapeValue: false,
  },
  saveMissing: isDev,
  missingKeyHandler: isDev
    ? (lngs, _ns, key) => {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing key "${key}" for [${lngs.join(", ")}]`);
      }
    : undefined,
});

export { i18n };
