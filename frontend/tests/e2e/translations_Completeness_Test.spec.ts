import { test, expect } from "@playwright/test";
import { en } from "../../src/i18n/locales/en";
import { hu } from "../../src/i18n/locales/hu";
import { SUPPORTED_LOCALES } from "../../src/i18n";

// Brand names / acronyms that legitimately appear identically in both
// languages. Add new entries here only when an English-identical Hungarian
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
  test("every locale resource is registered for every supported locale", () => {
    // SUPPORTED_LOCALES is the single source of truth — if a locale is added
    // there but the resource map is not updated, this fails fast.
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("hu");
  });

  test("Hungarian translation has every English key and no untranslated copies", () => {
    const flatEn = flatten(en as unknown as Tree);
    const flatHu = flatten(hu as unknown as Tree);

    const missingInHu = Object.keys(flatEn).filter((k) => !(k in flatHu));
    expect(missingInHu, "Hungarian is missing keys present in English").toEqual([]);

    const extraInHu = Object.keys(flatHu).filter((k) => !(k in flatEn));
    expect(extraInHu, "Hungarian has keys not present in English").toEqual([]);

    const emptyHu = Object.entries(flatHu)
      .filter(([, v]) => v.trim() === "")
      .map(([k]) => k);
    expect(emptyHu, "Hungarian has empty values").toEqual([]);

    const untranslated = Object.entries(flatHu)
      .filter(([key, huValue]) => {
        const enValue = flatEn[key];
        if (huValue !== enValue) return false;
        if (ALLOWED_IDENTICAL_VALUES.has(huValue.trim())) return false;
        return true;
      })
      .map(([k, v]) => `${k}: ${v}`);
    expect(
      untranslated,
      "Hungarian values are identical to English (likely untranslated)"
    ).toEqual([]);
  });

  test("placeholder sets match across locales", () => {
    const flatEn = flatten(en as unknown as Tree);
    const flatHu = flatten(hu as unknown as Tree);

    const mismatches: string[] = [];
    for (const [key, enValue] of Object.entries(flatEn)) {
      const huValue = flatHu[key];
      if (typeof huValue !== "string") continue;
      const enPlaceholders = extractPlaceholders(enValue);
      const huPlaceholders = extractPlaceholders(huValue);
      if (enPlaceholders.join(",") !== huPlaceholders.join(",")) {
        mismatches.push(
          `${key}: en=[${enPlaceholders.join(",")}] hu=[${huPlaceholders.join(",")}]`
        );
      }
    }
    expect(
      mismatches,
      "Placeholder names differ between EN and HU for the same key"
    ).toEqual([]);
  });
});
