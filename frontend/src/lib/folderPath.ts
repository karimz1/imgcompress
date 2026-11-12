/**
 * The folder a file was in when a whole directory was dropped or picked,
 * e.g. "holiday/day1" for "/holiday/day1/photo.jpg"; "" for a loose file.
 * The server uses it to keep the layout of the folder in the results.
 */

type PathedFile = File & { path?: unknown };

export function relativeDirOf(file: File): string {
  // react-dropzone sets `path` ("/dir/photo.jpg" for dropped folders,
  // "./photo.jpg" for loose files); a picked folder has webkitRelativePath.
  const { path } = file as PathedFile;
  const full = typeof path === "string" && path ? path : file.webkitRelativePath || "";
  const parts = full.split(/[\\/]/).filter((part) => part !== "" && part !== ".");
  return parts.slice(0, -1).join("/");
}
