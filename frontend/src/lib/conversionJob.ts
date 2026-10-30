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
// A status request that takes longer is given up and sent again. iOS can
// freeze a request while Safari is in the background and never settle it.
const REQUEST_TIMEOUT_MS = 15000;

export interface JobRef {
  id: string;
  token: string;
  /** The user already saw this finished result; a reload restores it quietly. */
  seen?: boolean;
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
  /** Server times in epoch seconds; the timer uses them, not the browser clock. */
  created_at?: number;
  started_at?: number;
  finished_at?: number;
  duration_seconds?: number;
  server_time?: number;
  /** Whether "notify me when done" is on for this job. */
  notify?: boolean;
}

/**
 * Turns the server-side "notify me when done" on or off for this job. The
 * server sends the message, so it still arrives after this tab is closed.
 */
export async function setJobNotify(job: JobRef, enabled: boolean, language?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/notify`, {
      method: "POST",
      headers: { ...jobHeaders(job), "Content-Type": "application/json" },
      // The message is written in this UI language (the server falls back to English).
      body: JSON.stringify({ enabled, language }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * When the job started, in this browser's clock (ms). Shifting by the
 * server's own "now" keeps the timer right even if the device clock is off.
 */
export function jobStartedAtLocal(state: JobState, receivedAt: number = Date.now()): number | null {
  const start = state.started_at ?? state.created_at;
  if (typeof start !== "number" || typeof state.server_time !== "number") return null;
  return receivedAt - Math.max(0, state.server_time - start) * 1000;
}

/** "0:42" or "1:02:05" for the live timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
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

/**
 * The last job stays saved after it finishes, so a reload shows its result
 * again. It is forgotten when the user clears the result, starts a new
 * conversion, or the server no longer knows the job.
 */
export function saveActiveJob(job: JobRef | null): void {
  try {
    if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: job.id, token: job.token, seen: job.seen === true }));
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
      return { id: parsed.id, token: parsed.token, seen: parsed.seen === true };
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
    let request: AbortController | null = null;
    let failures = 0;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      request?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      signal.removeEventListener("abort", onAbort);
    };
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, ms);
    };
    const onVisible = () => {
      if (isHidden()) return;
      // Back from the background: a request started before may be frozen, so
      // drop it and ask again right away.
      request?.abort();
      request = null;
      schedule(0);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    async function poll() {
      if (request || signal.aborted) return;
      const current = new AbortController();
      request = current;
      const timeout = setTimeout(() => current.abort(), REQUEST_TIMEOUT_MS);
      try {
        // cleanup() and onAbort abort `request`, which stops this fetch too.
        const state = await fetchJobState(job, current.signal);
        if (request !== current) return;
        failures = 0;
        onProgress(state);
        if (state.status === "done" || state.status === "failed") {
          cleanup();
          resolve(state);
          return;
        }
        schedule(isHidden() ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
      } catch (err) {
        if (signal.aborted || request !== current) return;
        if (err instanceof JobNotFoundError) {
          cleanup();
          reject(err);
          return;
        }
        failures += 1;
        schedule(Math.min(MAX_RETRY_MS, POLL_VISIBLE_MS * 2 ** Math.min(failures, 3)));
      } finally {
        clearTimeout(timeout);
        if (request === current) request = null;
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    signal.addEventListener("abort", onAbort);
    schedule(0);
  });
}
