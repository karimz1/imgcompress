"use client";

const MAX_ENTRIES = 500;
const entries: string[] = [];
let installed = false;

type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";

function safeStringify(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? "\n" + arg.stack : ""}`;
  }
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function record(level: ConsoleLevel, args: unknown[]): void {
  const ts = new Date().toISOString();
  const text = args.map(safeStringify).join(" ");
  entries.push(`[${ts}] [${level.toUpperCase()}] ${text}`);
  while (entries.length > MAX_ENTRIES) entries.shift();
}

export function installFrontendLogCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const levels: ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];
  for (const level of levels) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      record(level, args);
      original(...args);
    };
  }
}

export function dumpFrontendLogs(): string {
  if (entries.length === 0) return "(no log entries captured yet)";
  return entries.join("\n");
}

export function downloadTextFile(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadBackendLogs(): Promise<void> {
  if (typeof window === "undefined") return;
  const content = await fetchBackendLogs();
  downloadTextFile("imgcompress-backend.log", content);
}

export async function fetchBackendLogs(): Promise<string> {
  if (typeof window === "undefined") return "(browser unavailable)";
  try {
    const res = await fetch("/api/logs/backend");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return buildBackendUnavailableLog(res.status, body);
    }
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return buildBackendUnavailableLog(null, "empty backend log response");
    if (isLegacyBackendLogResponse(trimmed)) {
      return [
        "[backend diagnostics route is stale]",
        "The backend responded with the older log format, so it is still running a process from before the diagnostics changes.",
        "Restart the backend with ./runStartLocalBackend.sh, then reproduce the issue and download diagnostics again.",
        "",
        "Old backend response:",
        trimmed,
      ].join("\n");
    }
    return trimmed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return buildBackendUnavailableLog(null, message);
  }
}

function isLegacyBackendLogResponse(text: string): boolean {
  return (
    text.includes("## Captured app logs") ||
    text.includes("This file contains app-level logs captured by the in-process logger")
  );
}

export function downloadFrontendLogs(): void {
  downloadTextFile("imgcompress-frontend.log", dumpFrontendLogs());
}

export async function downloadDiagnosticsBundle(context: {
  title: string;
  message: string;
  details?: string;
}): Promise<void> {
  const backendLogs = await fetchBackendLogs();
  const bundle = [
    "# imgcompress diagnostics",
    "",
    `created_at: ${new Date().toISOString()}`,
    typeof window !== "undefined" ? `url: ${window.location.href}` : null,
    typeof navigator !== "undefined" ? `user_agent: ${navigator.userAgent}` : null,
    "",
    "## Error",
    context.title,
    "",
    context.message,
    context.details ? `\n## Error details\n${context.details}` : null,
    "",
    "## Backend logs",
    backendLogs,
    "",
    "## Frontend logs",
    dumpFrontendLogs(),
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  downloadTextFile("imgcompress-diagnostics.log", bundle);
}

function buildBackendUnavailableLog(status: number | null, detail: string): string {
  const statusLine = status == null ? "request failed" : `HTTP ${status}`;
  return [
    "[backend logs unavailable]",
    `status: ${statusLine}`,
    `detail: ${detail || "(no response body)"}`,
    "",
    "What this usually means:",
    "- the backend process was not restarted after the branch added /api/logs/backend",
    "- the frontend is running without the Next.js /api rewrite",
    "- the backend is down or serving an older container image",
    "",
    "Useful fallback:",
    "- include the frontend logs and error trace from this diagnostics bundle",
    "- if running Docker, attach the output of `docker logs <imgcompress-container>`",
    "- if running locally, attach the terminal output from ./runStartLocalBackend.sh",
  ].join("\n");
}
