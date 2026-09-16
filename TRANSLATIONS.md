# Contributing Translations

ImgCompress uses [i18next](https://www.i18next.com/) and
[react-i18next](https://react.i18next.com/). Translation files live in
[`frontend/src/i18n/locales/`](frontend/src/i18n/locales/), with `en.ts` as the
source of truth.

Some translations were created with online tools and may be imperfect. Fixes
from fluent speakers are always welcome.

New to the project? Read the
[Developer Guide](https://imgcompress.karimzouine.com/docs/developers) first.
It explains the recommended Dev Container, required tools, local development,
Make targets, testing, and how to simulate CI before opening a pull request.

## Improve an existing translation

Edit the matching locale file and keep the same keys and structure as `en.ts`.
Only translate values—do not rename keys.

Please preserve:

- placeholders such as `{{count}}`, `{{fileName}}`, and `{{model}}`;
- plural keys such as `_one` and `_other`;
- arrays and intentional line breaks (`\n`).

The locale files use `TranslationSchema`, which is generated from English.
TypeScript will catch missing, extra, or incorrectly shaped values.

For a meaningful translation improvement, also update the contributor credit
in [`frontend/src/i18n/locales/README.md`](frontend/src/i18n/locales/README.md).

## Add a new language

Use a valid [BCP 47 language tag](https://www.rfc-editor.org/rfc/rfc5646), such
as `it` or `pt-BR`.

### 1. Create the locale file

Copy `frontend/src/i18n/locales/en.ts`, rename it to the new locale, and
translate every value:

```ts
import type { TranslationSchema } from "../types";

export const it: TranslationSchema = {
  page: {
    subtitle: "Uno strumento per comprimere immagini",
    // ...translate the remaining values
  },
  // ...
};
```

### 2. Register the locale

In [`frontend/src/i18n/index.ts`](frontend/src/i18n/index.ts):

1. Import the new locale.
2. Add its tag to `SUPPORTED_LOCALES`.
3. Add it to the `resources` map.

`SUPPORTED_LOCALES` controls locale detection and the languages shown in the
switcher. If a regional locale needs a special fallback—for example, `pt`
resolving to `pt-BR`—update `resolveSupportedLocale` too.

### 3. Add it to the language switcher

In
[`frontend/src/components/LanguageSwitcher.tsx`](frontend/src/components/LanguageSwitcher.tsx),
add entries to both maps:

```ts
const LANGUAGE_META = {
  it: { label: "Italiano" },
};

const LANGUAGE_FLAG_CODES = {
  it: "it",
};
```

Use the language's native name. This project uses the
[`flag-icons`](https://github.com/lipis/flag-icons) package, not emoji. Browse
the [flag-icons gallery](https://flagicons.lipis.dev/) to find an available
code. Most flags use a lowercase ISO 3166-1 country code (`it`, `br`, `mx`),
while the package also provides a few regional codes such as `arab`.

Enter only the code in `LANGUAGE_FLAG_CODES`. The component turns it into the
CSS class `fi-<code>` automatically—for example, `it: "it"` uses `fi-it`.
Because languages and countries are not the same thing, choose the least
misleading flag for languages spoken in several countries.

For a right-to-left language, also update the direction handling in
[`frontend/src/context/I18nProvider.tsx`](frontend/src/context/I18nProvider.tsx).

### 4. Update tests and credits

- Add relevant locale-resolution cases to
  `frontend/tests/e2e/translations_Completeness_Test.spec.ts`.
- Add the language and contributor to `frontend/src/i18n/locales/README.md`.
- Update the supported-language list in `ReadMe.md`.

## Check your work

From the `frontend` directory, run:

```sh
pnpm lint
pnpm exec playwright test tests/e2e/translations_Completeness_Test.spec.ts
```

These checks verify the TypeScript shape, missing or extra keys, empty values,
untranslated English copies, and mismatched placeholders.

Finally, open the app and confirm that the language appears in the switcher,
looks correct, and remains selected after reloading the page.

For the full local build and test workflow, including `make e2e` and
`make simci`, see the
[Developer Guide](https://imgcompress.karimzouine.com/docs/developers).
