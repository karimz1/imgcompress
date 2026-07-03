export const fileDownloadUrl = (folder: string, file: string) =>
  `/api/download?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(file)}`;

export const zipDownloadUrl = (folder: string) =>
  `/api/download_all?folder=${encodeURIComponent(folder)}`;

/**
 * Fetches a file and saves it via the browser, returning `false` when the
 * server responds non-OK (e.g. the file was deleted or expired) so the caller
 * can react instead of navigating to the raw error body. Network errors throw.
 */
export async function fetchDownload(
  url: string,
  fallbackName?: string
): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) return false;

  const objectUrl = URL.createObjectURL(await res.blob());
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filenameFromResponse(res) ?? fallbackName ?? "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return true;
}

function filenameFromResponse(res: Response): string | undefined {
  const header = res.headers.get("Content-Disposition");
  if (!header) return undefined;

  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain filename
    }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1]?.trim();
}
