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

/**
 * Identifies a file in the selection: "holiday/day1/photo.jpg" for a file of a
 * dropped folder, just "photo.jpg" for a loose file. Crops, sizes and removal
 * go by this key, so two photo.jpg in different folders stay independent.
 */
export function fileKeyOf(file: File): string {
  const dir = relativeDirOf(file);
  return dir ? `${dir}/${file.name}` : file.name;
}

const KEEP_FOLDERS_PREFERENCE_KEY = "imgcompress.keepFolderStructure";

/**
 * The last "keep folder structure" choice in this browser. Off until the user
 * turns it on, so dropped folders come back flat like they always did.
 */
export function loadKeepFoldersPreference(): boolean {
  try {
    return localStorage.getItem(KEEP_FOLDERS_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveKeepFoldersPreference(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(KEEP_FOLDERS_PREFERENCE_KEY, "true");
    else localStorage.removeItem(KEEP_FOLDERS_PREFERENCE_KEY);
  } catch {
    // Private mode or storage full: the switch just starts off next time.
  }
}
