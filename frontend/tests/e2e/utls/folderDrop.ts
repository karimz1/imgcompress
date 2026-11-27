import type { Page } from '@playwright/test';
import { waitForSupportedFormatsCountAsync } from './helpers';

/** A file of a dropped folder: its path inside the drop and its content. */
export type DroppedBytes = { path: string; bytes: number[]; type?: string };

/**
 * Drops a folder through a `drop` event, the way the browser hands it over:
 * Chromium gives react-dropzone a directory handle (getAsFileSystemHandle),
 * Firefox only a directory entry (webkitGetAsEntry). Playwright cannot drag
 * from the desktop, so the handle or entry tree is built here; react-dropzone,
 * file-selector and the app run as they would for a real drop.
 */
export async function dropFolderLikeTheBrowserAsync(page: Page, browserName: string, files: DroppedBytes[]): Promise<void> {
  await waitForSupportedFormatsCountAsync(page);
  await page.getByTestId('dropzone-input').evaluate(
    (input: HTMLInputElement, { files, useHandles }) => {
      type Node = { name: string; fullPath: string; file?: File; children: Map<string, Node> };
      const root: Node = { name: '', fullPath: '', children: new Map() };
      for (const { path, bytes, type = 'image/png' } of files) {
        const parts = path.split('/').filter(Boolean);
        let node = root;
        parts.forEach((name, i) => {
          if (!node.children.has(name)) {
            node.children.set(name, { name, fullPath: `${node.fullPath}/${name}`, children: new Map() });
          }
          node = node.children.get(name)!;
          if (i === parts.length - 1) node.file = new File([new Uint8Array(bytes)], name, { type });
        });
      }
      const toEntry = (node: Node): unknown =>
        node.file
          ? { isFile: true, isDirectory: false, name: node.name, fullPath: node.fullPath, file: (ok: (f: File) => void) => ok(node.file!) }
          : {
              isFile: false,
              isDirectory: true,
              name: node.name,
              fullPath: node.fullPath,
              createReader: () => {
                let read = false;
                return {
                  readEntries: (ok: (batch: unknown[]) => void) => {
                    // Like the browser: one batch with the children, then an empty one.
                    const batch = read ? [] : [...node.children.values()].map(toEntry);
                    read = true;
                    ok(batch);
                  },
                };
              },
            };
      const toHandle = (node: Node): unknown =>
        node.file
          ? { kind: 'file', name: node.name, getFile: async () => node.file }
          : {
              kind: 'directory',
              name: node.name,
              values: async function* () {
                for (const child of node.children.values()) yield toHandle(child);
              },
            };
      const items = [...root.children.values()].map((top) => ({
        kind: 'file',
        type: '',
        getAsFile: () => top.file ?? null,
        webkitGetAsEntry: () => toEntry(top),
        ...(useHandles ? { getAsFileSystemHandle: async () => toHandle(top) } : {}),
      }));
      const dataTransfer = { types: ['Files'], items, files: [], dropEffect: 'copy', effectAllowed: 'all' };
      const zone = input.parentElement!;
      for (const type of ['dragenter', 'dragover', 'drop']) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        zone.dispatchEvent(event);
      }
    },
    { files, useHandles: browserName === 'chromium' }
  );
}
