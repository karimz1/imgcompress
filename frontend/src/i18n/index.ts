import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { hu } from "./locales/hu";

export const LOCALE_STORAGE_KEY = "imgcompress_locale";

const savedLocale =
  typeof window !== "undefined"
    ? (localStorage.getItem(LOCALE_STORAGE_KEY) ?? "en")
    : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hu: { translation: hu },
  },
  lng: savedLocale,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export { i18n };
