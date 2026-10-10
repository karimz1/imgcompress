export const RELEASE_VERSION_PATTERN = '\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?';

// The first entry identifies this build, even when its archive has newer entries.
export function extractCurrentVersion(markdown: string): string | null {
  const header = new RegExp(`^##\\s+v?(${RELEASE_VERSION_PATTERN})\\s+[—-]\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`, 'm');
  return markdown.match(header)?.[1] ?? null;
}
