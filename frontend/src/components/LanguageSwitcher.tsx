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

const LANGUAGE_META: Record<Locale, { label: string }> = {
  ar: { label: "العربية" },
  de: { label: "Deutsch" },
  en: { label: "English" },
  es: { label: "Español" },
  "es-MX": { label: "Español (México)" },
  fr: { label: "Français" },
  hi: { label: "हिन्दी" },
  hu: { label: "Magyar" },
  ja: { label: "日本語" },
  "pt-BR": { label: "Português (Brasil)" },
  ru: { label: "Русский" },
  "zh-CN": { label: "中文（普通话）" },
};

const LANGUAGE_FLAG_CODES: Record<Locale, string> = {
  ar: "arab",
  de: "de",
  en: "gb",
  es: "es",
  "es-MX": "mx",
  fr: "fr",
  hi: "in",
  hu: "hu",
  ja: "jp",
  "pt-BR": "br",
  ru: "ru",
  "zh-CN": "cn",
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

function FlagMark({ locale }: { locale: Locale }) {
  const flagCode = LANGUAGE_FLAG_CODES[locale];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "fi shrink-0 overflow-hidden rounded-[3px] text-base leading-none shadow-sm ring-1 ring-black/15 dark:ring-white/20",
        `fi-${flagCode}`
      )}
      style={{
        backgroundSize: "100% 100%",
      }}
    />
  );
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
          "group flex h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold",
          "border border-black/10 bg-white/70 text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl",
          "transition-all duration-200 hover:-translate-y-px hover:bg-white/90 hover:shadow-[0_12px_30px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.75)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40",
          "dark:border-white/10 dark:bg-zinc-950/55 dark:text-zinc-100 dark:shadow-[0_10px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] dark:hover:bg-zinc-900/75"
        )}
        aria-label={t("langSwitcher.ariaLabel")}
      >
        <FlagMark locale={current.code} />
        <SelectPrimitive.Value>
          <span className="tracking-[0.02em]">{current.code.toUpperCase()}</span>
        </SelectPrimitive.Value>
        <ChevronDown className="h-3 w-3 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          align="end"
          collisionPadding={16}
          className={cn(
            "z-[200] w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border shadow-[0_24px_70px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-2xl",
            "border-white/50 bg-white/80 text-slate-800 dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100 dark:shadow-[0_28px_80px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.1)]",
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
                  "relative flex items-center gap-2.5 rounded-xl py-1.5 pl-2 pr-8 text-xs",
                  "cursor-default select-none outline-none",
                  "text-slate-700 transition-colors focus:bg-slate-900/10 data-[state=checked]:font-semibold data-[state=checked]:text-slate-950",
                  "dark:text-zinc-200 dark:focus:bg-white/10 dark:data-[state=checked]:text-white"
                )}
              >
                <FlagMark locale={lang.code} />
                <SelectPrimitive.ItemText>{lang.label}</SelectPrimitive.ItemText>
                <span className="absolute right-2 flex items-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-sky-500 dark:text-sky-300" />
                  </SelectPrimitive.ItemIndicator>
                </span>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <div
            dir="ltr"
            className="border-t border-slate-900/10 px-3.5 py-2.5 text-left text-[11px] leading-snug text-slate-500 dark:border-white/10 dark:text-zinc-400"
          >
            Some translations are online-tool assisted and may be imperfect. If a text
            looks off, please{" "}
            <a
              href={TRANSLATION_CONTRIBUTION_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950 dark:text-zinc-100 dark:hover:text-white"
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
