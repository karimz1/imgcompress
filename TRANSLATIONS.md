# Contributing Translations

imgcompress uses [react-i18next](https://react.i18next.com/) for internationalization. All translation files live in `frontend/src/i18n/locales/`. Adding a new language requires changes to exactly three files.

## How to add a new language

### 1. Create the locale file

Copy `frontend/src/i18n/locales/en.ts` to a new file named after the [BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag) (e.g. `de.ts` for German, `fr.ts` for French):

```
frontend/src/i18n/locales/de.ts
```

The file must export a typed constant that satisfies `TranslationSchema`:

```ts
import type { TranslationSchema } from "../types";

export const de: TranslationSchema = {
  page: {
    subtitle: "Ein Bildkomprimierungswerkzeug",
    // ... translate every key from en.ts
  },
  // ...
};
```

`TranslationSchema` is derived from `en.ts` at compile time, so TypeScript will report an error for any missing or extra key — you cannot ship an incomplete translation.

### 2. Register the locale in the i18n initializer

Open `frontend/src/i18n/index.ts` and add your import and resource entry:

```diff
 import { en } from "./locales/en";
 import { hu } from "./locales/hu";
+import { de } from "./locales/de";

 i18n.use(initReactI18next).init({
   resources: {
     en: { translation: en },
     hu: { translation: hu },
+    de: { translation: de },
   },
```

### 3. Add the language to the switcher

Open `frontend/src/components/LanguageSwitcher.tsx` and add an entry to the `LANGUAGES` array:

```diff
 const LANGUAGES = [
   { code: "en", label: "English", flag: "🇬🇧" },
   { code: "hu", label: "Magyar",  flag: "🇭🇺" },
+  { code: "de", label: "Deutsch", flag: "🇩🇪" },
 ];
```

That is all — no changes to any component or page are needed.

## Opening a PR

Once your three files are ready:

1. Fork the repository and create a branch named `feat/i18n-<language-code>` (e.g. `feat/i18n-de`).
2. Commit only the three changed/new files.
3. Open a pull request against `main` and reference this file in the description.

The maintainer will review the translation and merge it when ready.
