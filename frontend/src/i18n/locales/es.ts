import { esMX } from "./es-MX";
import type { TranslationSchema } from "../types";

export const es: TranslationSchema = {
  ...esMX,
  page: {
    ...esMX.page,
    subtitle: "Herramienta de compresión de imágenes",
  },
  langSwitcher: {
    ariaLabel: "Seleccionar idioma",
  },
};
