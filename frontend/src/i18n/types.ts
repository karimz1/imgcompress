import type { en } from "./locales/en";

type DeepStringValues<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringValues<T[K]>;
};

export type TranslationSchema = DeepStringValues<typeof en>;
