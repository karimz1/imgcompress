/**
 * Background conversion jobs. The server answers the upload at once with a job
 * id and a secret token, then the page asks every second or two how far it is.
 * When the phone switches apps, the tab reloads or a proxy cuts a request, the
 * job keeps running on the server and the page simply picks it up again.
 *
 * The token is the only way to read the job, so it never goes into a URL or
 * a log line; it travels in the X-Job-Token header.
 */

export const JOB_TOKEN_HEADER = "X-Job-Token";
const STORAGE_KEY = "imgcompress.activeJob";
const POLL_VISIBLE_MS = 1000;
const POLL_HIDDEN_MS = 5000;
const MAX_RETRY_MS = 5000;

export interface JobRef {
  id: string;
  token: string;
}

export interface JobProgress {
  files_done?: number;
  files_total?: number;
  tiles_done?: number;
  tiles_total?: number;
  waiting?: boolean;
}

export interface JobResult {
  converted_files: string[];
}

export interface JobState {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress?: JobProgress;
  error?: string;
  result?: JobResult;
}

/** The job is gone: cleaned up, or never ours. */
export class JobNotFoundError extends Error {
  constructor() {
    super("Job not found");
    this.name = "JobNotFoundError";
  }
}

export const jobFileUrl = (job: JobRef, file: string) =>
  `/api/jobs/${encodeURIComponent(job.id)}/files/${encodeURIComponent(file)}`;

export const jobZipUrl = (job: JobRef) => `/api/jobs/${encodeURIComponent(job.id)}/zip`;

export const jobHeaders = (job: JobRef): Record<string, string> => ({ [JOB_TOKEN_HEADER]: job.token });

export function saveActiveJob(job: JobRef | null): void {
  try {
    if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: job.id, token: job.token }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or storage full: the job still works while the page stays open.
  }
}

export function loadActiveJob(): JobRef | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.id === "string" && typeof parsed?.token === "string") {
      return { id: parsed.id, token: parsed.token };
    }
  } catch {
    // ignore broken entries
  }
  return null;
}

async function fetchJobState(job: JobRef, signal: AbortSignal): Promise<JobState> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, {
    headers: jobHeaders(job),
    cache: "no-store",
    signal,
  });
  if (res.status === 404) throw new JobNotFoundError();
  if (!res.ok) throw new Error(`Job status ${res.status}`);
  return (await res.json()) as JobState;
}

function isHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/**
 * Waits until the job is done or failed. Network errors and server hiccups
 * are retried quietly, because they are what happens when the phone sleeps.
 * Polls slower while the page is hidden and right away once it is shown again.
 */
export function waitForJob(
  job: JobRef,
  onProgress: (state: JobState) => void,
  signal: AbortSignal
): Promise<JobState> {
  return new Promise<JobState>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let failures = 0;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("online", onVisible);
      signal.removeEventListener("abort", onAbort);
    };
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, ms);
    };
    const onVisible = () => {
      if (!isHidden()) schedule(0);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    async function poll() {
      if (inFlight || signal.aborted) return;
      inFlight = true;
      try {
        const state = await fetchJobState(job, signal);
        failures = 0;
        onProgress(state);
        if (state.status === "done" || state.status === "failed") {
          cleanup();
          resolve(state);
          return;
        }
        schedule(isHidden() ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof JobNotFoundError) {
          cleanup();
          reject(err);
          return;
        }
        failures += 1;
        schedule(Math.min(MAX_RETRY_MS, POLL_VISIBLE_MS * 2 ** Math.min(failures, 3)));
      } finally {
        inFlight = false;
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("online", onVisible);
    signal.addEventListener("abort", onAbort);
    schedule(0);
  });
}
