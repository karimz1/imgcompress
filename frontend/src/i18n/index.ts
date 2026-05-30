import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { hu } from "./locales/hu";
import type { TranslationSchema } from "./types";

export const LOCALE_STORAGE_KEY = "imgcompress_locale";

export const SUPPORTED_LOCALES = ["en", "hu"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const resources: Record<Locale, { translation: TranslationSchema }> = {
  en: { translation: en },
  hu: { translation: hu },
};

function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const primary = candidate.toLowerCase().split("-")[0];
    if (isSupportedLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) return saved;
  } catch {
    // localStorage unavailable (private browsing, sandboxed iframe, etc.)
  }
  return detectBrowserLocale();
}

const isDev = process.env.NODE_ENV === "development";

i18n.use(initReactI18next).init({
  resources: resources as unknown as Resource,
  lng: resolveInitialLocale(),
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
