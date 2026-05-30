"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  i18n,
  resolveSupportedLocale,
  type Locale,
} from "@/i18n";

const LANGUAGE_META: Record<Locale, { label: string; flag: string }> = {
  ar: { label: "العربية", flag: "🇸🇦" },
  de: { label: "Deutsch", flag: "🇩🇪" },
  en: { label: "English", flag: "🇬🇧" },
  es: { label: "Español", flag: "🇪🇸" },
  "es-MX": { label: "Español (México)", flag: "🇲🇽" },
  fr: { label: "Français", flag: "🇫🇷" },
  hi: { label: "हिन्दी", flag: "🇮🇳" },
  hu: { label: "Magyar", flag: "🇭🇺" },
  ja: { label: "日本語", flag: "🇯🇵" },
  "pt-BR": { label: "Português (Brasil)", flag: "🇧🇷" },
  ru: { label: "Русский", flag: "🇷🇺" },
  "zh-CN": { label: "中文（普通话）", flag: "🇨🇳" },
};

const LANGUAGES = SUPPORTED_LOCALES.map((code) => ({
  code,
  ...LANGUAGE_META[code],
}));

const TRANSLATION_CONTRIBUTION_URL =
  "https://github.com/karimz1/imgcompress/tree/main/frontend/src/i18n/locales";

function toLocale(code: string): Locale {
  return resolveSupportedLocale(code) ?? DEFAULT_LOCALE;
}

export function LanguageSwitcher() {
  const { t, i18n: i18nInstance } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const currentCode = toLocale(i18nInstance.language);
  const current = LANGUAGES.find((l) => l.code === currentCode) ?? LANGUAGES[0];

  const handleChange = (code: string) => {
    const next = toLocale(code);
    i18n.changeLanguage(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable in some private browsing modes
    }
  };

  return (
    <SelectPrimitive.Root value={current.code} onValueChange={handleChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 h-9",
          "bg-zinc-800 text-zinc-100 border border-zinc-700/40 shadow-sm",
          "hover:bg-zinc-700 transition-colors text-xs font-medium",
          "focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
        )}
        aria-label={t("langSwitcher.ariaLabel")}
      >
        <span>{current.flag}</span>
        <SelectPrimitive.Value>
          <span>{current.code.toUpperCase()}</span>
        </SelectPrimitive.Value>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          align="end"
          className={cn(
            "z-[200] min-w-[260px] max-w-[280px] overflow-hidden rounded-lg border shadow-lg",
            "bg-zinc-900 border-zinc-700 text-zinc-100",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2"
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {LANGUAGES.map((lang) => (
              <SelectPrimitive.Item
                key={lang.code}
                value={lang.code}
                className={cn(
                  "relative flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                  "cursor-default select-none outline-none",
                  "focus:bg-zinc-700 data-[state=checked]:font-semibold"
                )}
              >
                <span>{lang.flag}</span>
                <SelectPrimitive.ItemText>{lang.label}</SelectPrimitive.ItemText>
                <span className="absolute right-2 flex items-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3 w-3 text-zinc-400" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <div
            dir="ltr"
            className="border-t border-zinc-700/70 px-3 py-2 text-left text-[11px] leading-snug text-zinc-400"
          >
            Some translations are online-tool assisted and may be imperfect. If a text
            looks off, please{" "}
            <a
              href={TRANSLATION_CONTRIBUTION_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-zinc-100 underline underline-offset-2 hover:text-white"
              onPointerDown={(event) => event.stopPropagation()}
            >
              improve it on GitHub
            </a>
            .
          </div>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
