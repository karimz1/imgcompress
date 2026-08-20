const REMBG_MODEL_ORDER = [
  "u2net",
  "isnet-anime",
  "isnet-general-use",
  "birefnet-portrait",
  "birefnet-general-lite",
  "birefnet-general",
];

const REMBG_MODEL_ORDER_INDEX = new Map(
  REMBG_MODEL_ORDER.map((model, index) => [model, index])
);

export function orderRembgModels(models: string[]) {
  return [...models].sort((a, b) => {
    const aIndex = REMBG_MODEL_ORDER_INDEX.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = REMBG_MODEL_ORDER_INDEX.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b);
  });
}
