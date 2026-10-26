export type InputFileKind = "svg" | "vector" | "document" | "image";

// These formats can contain vector artwork, but only SVG keeps its shapes
// through this app's crop and resize workflow.
export function inputFileKind(filename: string): InputFileKind {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "svg") return "svg";
  if (["eps", "ps", "wmf", "emf"].includes(extension ?? "")) return "vector";
  if (extension === "pdf") return "document";
  return "image";
}
