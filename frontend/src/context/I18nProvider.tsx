"use client";

import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n, resolveInitialLocale } from "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const syncLang = (lng: string) => {
      document.documentElement.lang = lng;
      document.documentElement.dir = lng.startsWith("ar") ? "rtl" : "ltr";
    };

    i18n.on("languageChanged", syncLang);

    // i18n initializes on the default locale so SSR matches the first client
    // render. Now that we've hydrated, switch to the user's stored/detected
    // locale (a re-render, not a hydration mismatch).
    const initial = resolveInitialLocale();
    if (initial !== i18n.language) {
      i18n.changeLanguage(initial);
    } else {
      syncLang(i18n.language);
    }

    return () => {
      i18n.off("languageChanged", syncLang);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
