import { test, expect } from "@playwright/test";
import {
  resources,
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
} from "../../src/i18n";

// Brand names / acronyms that legitimately appear identically in both
// languages. Add new entries here only when an English-identical translated
// value is genuinely correct (not because translation is pending).
const ALLOWED_IDENTICAL_VALUES = new Set<string>([
  "PDF",
  "AVIF",
  "JPEG",
  "PNG",
  "WebP",
  "ICO",
  "PSD",
  "OK",
  "API",
  "ZIP",
  "URL",
  "(ZIP)",
  "GitHub",
  "Alt",
  "Esc",
  "Ctrl",
  "Shift",
  "Cmd",
  "Tab",
  "Enter",
]);

type Tree = { [key: string]: unknown };

const LOCALE_RESOURCES = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [locale, resources[locale].translation])
) as Record<string, unknown>;

function flatten(obj: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        const itemPath = `${path}[${idx}]`;
        if (typeof item === "string") {
          out[itemPath] = item;
        } else if (item && typeof item === "object") {
          Object.assign(out, flatten(item as Tree, itemPath));
        }
      });
    } else if (value && typeof value === "object") {
      Object.assign(out, flatten(value as Tree, path));
    }
  }
  return out;
}

function extractPlaceholders(value: string): string[] {
  return Array.from(value.matchAll(/{{\s*([^}]+?)\s*}}/g))
    .map((m) => m[1])
    .sort();
}

test.describe("Translation completeness", () => {
  test("locale resolver normalizes browser language tags", () => {
    expect(resolveSupportedLocale("de-DE")).toBe("de");
    expect(resolveSupportedLocale("ar-EG")).toBe("ar");
    expect(resolveSupportedLocale("hi-IN")).toBe("hi");
    expect(resolveSupportedLocale("fr-FR")).toBe("fr");
    expect(resolveSupportedLocale("pt")).toBe("pt-BR");
    expect(resolveSupportedLocale("pt-BR")).toBe("pt-BR");
    expect(resolveSupportedLocale("ru-RU")).toBe("ru");
    expect(resolveSupportedLocale("ja-JP")).toBe("ja");
    expect(resolveSupportedLocale("es")).toBe("es");
    expect(resolveSupportedLocale("es-ES")).toBe("es");
    expect(resolveSupportedLocale("es-mx")).toBe("es-MX");
    expect(resolveSupportedLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(resolveSupportedLocale("it-IT")).toBeNull();
  });

  test("every locale resource is registered for every supported locale", () => {
    // SUPPORTED_LOCALES is the single source of truth — if a locale is added
    // there but the resource map is not updated, this fails fast.
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("es");
    expect(SUPPORTED_LOCALES).toContain("zh-CN");
    expect(SUPPORTED_LOCALES).toContain("hi");
    expect(SUPPORTED_LOCALES).toContain("ar");
    expect(SUPPORTED_LOCALES).toContain("fr");
    expect(SUPPORTED_LOCALES).toContain("pt-BR");
    expect(SUPPORTED_LOCALES).toContain("ru");
    expect(SUPPORTED_LOCALES).toContain("ja");
    expect(SUPPORTED_LOCALES).toContain("de");
    expect(SUPPORTED_LOCALES).toContain("es-MX");
    expect(SUPPORTED_LOCALES).toContain("hu");
    expect(Object.keys(LOCALE_RESOURCES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  test("translations have every English key and no untranslated copies", () => {
    const flatEn = flatten(resources.en.translation as unknown as Tree);
    const translatedLocales = Object.entries(LOCALE_RESOURCES).filter(
      ([locale]) => locale !== "en"
    );

    for (const [locale, resource] of translatedLocales) {
      const flatLocale = flatten(resource as unknown as Tree);

      const missing = Object.keys(flatEn).filter((k) => !(k in flatLocale));
      expect(missing, `${locale} is missing keys present in English`).toEqual([]);

      const extra = Object.keys(flatLocale).filter((k) => !(k in flatEn));
      expect(extra, `${locale} has keys not present in English`).toEqual([]);

      const empty = Object.entries(flatLocale)
        .filter(([, v]) => v.trim() === "")
        .map(([k]) => k);
      expect(empty, `${locale} has empty values`).toEqual([]);

      const untranslated = Object.entries(flatLocale)
        .filter(([key, localeValue]) => {
          const enValue = flatEn[key];
          if (localeValue !== enValue) return false;
          if (ALLOWED_IDENTICAL_VALUES.has(localeValue.trim())) return false;
          return true;
        })
        .map(([k, v]) => `${k}: ${v}`);
      expect(
        untranslated,
        `${locale} values are identical to English (likely untranslated)`
      ).toEqual([]);
    }
  });

  test("placeholder sets match across locales", () => {
    const flatEn = flatten(resources.en.translation as unknown as Tree);
    const translatedLocales = Object.entries(LOCALE_RESOURCES).filter(
      ([locale]) => locale !== "en"
    );

    for (const [locale, resource] of translatedLocales) {
      const flatLocale = flatten(resource as unknown as Tree);
      const mismatches: string[] = [];

      for (const [key, enValue] of Object.entries(flatEn)) {
        const localeValue = flatLocale[key];
        if (typeof localeValue !== "string") continue;
        const enPlaceholders = extractPlaceholders(enValue);
        const localePlaceholders = extractPlaceholders(localeValue);
        if (enPlaceholders.join(",") !== localePlaceholders.join(",")) {
          mismatches.push(
            `${key}: en=[${enPlaceholders.join(",")}] ${locale}=[${localePlaceholders.join(",")}]`
          );
        }
      }

      expect(
        mismatches,
        `Placeholder names differ between EN and ${locale} for the same key`
      ).toEqual([]);
    }
  });
});
