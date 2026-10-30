/**
 * Pictures for the editor (background, picture layers) are uploaded once per
 * editor session and then referenced by id, instead of riding along with
 * every preview. The session token and ids live only in this tab's memory.
 *
 * When the server answers 410 (session expired) or 409 (session full), the
 * ids are forgotten and the pictures still in use upload again on demand.
 */

export class AssetsGoneError extends Error {}

type Uploaded = { asset: string; width: number; height: number };

let session: string | null = null;
let generation = 0;
let ids = new WeakMap<File, Uploaded>();
const pending = new WeakMap<File, Promise<Uploaded>>();
// Uploads run one after another, so the first one creates the session for all.
let queue: Promise<unknown> = Promise.resolve();

async function errorText(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") return data.error;
  } catch {
    // Not JSON: fall through to the status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function upload(file: File, retry = true): Promise<Uploaded> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (session) form.append("session", session);
  const response = await fetch("/api/editor/assets", { method: "POST", body: form });
  if ((response.status === 410 || response.status === 409) && retry) {
    forgetEditorAssets();
    return upload(file, false);
  }
  if (!response.ok) throw new Error(await errorText(response));
  const data = await response.json();
  session = data.session;
  const uploaded = { asset: data.asset, width: data.width, height: data.height };
  ids.set(file, uploaded);
  return uploaded;
}

/** Uploads ``file`` unless this session already has it. */
export function uploadEditorPicture(file: File): Promise<Uploaded> {
  const known = ids.get(file);
  if (known) return Promise.resolve(known);
  const running = pending.get(file);
  if (running) return running;
  const started = generation;
  const next = queue.then(() => {
    const done = started === generation ? ids.get(file) : undefined;
    return done ?? upload(file);
  });
  queue = next.catch(() => undefined);
  pending.set(file, next);
  void next.finally(() => pending.delete(file)).catch(() => undefined);
  return next;
}

export const editorSession = () => session;

/** Drops the session; pictures upload again when next needed. */
export function forgetEditorAssets() {
  session = null;
  generation += 1;
  ids = new WeakMap();
}
