"use client";

import React, { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const syncLang = (lng: string) => {
      document.documentElement.lang = lng;
    };

    syncLang(i18n.language);
    i18n.on("languageChanged", syncLang);
    return () => {
      i18n.off("languageChanged", syncLang);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
