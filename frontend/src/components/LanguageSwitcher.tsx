"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { i18n, LOCALE_STORAGE_KEY } from "@/i18n";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
];

export function LanguageSwitcher() {
  const { i18n: i18nInstance } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const current = LANGUAGES.find((l) => l.code === i18nInstance.language) ?? LANGUAGES[0];

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
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
        aria-label="Select language"
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
            "z-[200] min-w-[120px] overflow-hidden rounded-lg border shadow-lg",
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
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
