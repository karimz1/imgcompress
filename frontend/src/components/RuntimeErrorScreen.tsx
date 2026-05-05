"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  LifeBuoy,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { downloadDiagnosticsBundle } from "@/lib/logBuffer";

const REPO_NEW_ISSUE_URL =
  "https://github.com/karimz1/imgcompress/issues/new?template=bug_report.md";

export interface RuntimeErrorScreenAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
  testId?: string;
}

export interface RuntimeErrorScreenTestIds {
  screen?: string;
  summary?: string;
  details?: string;
  copyBtn?: string;
  openTicketBtn?: string;
}

const DEFAULT_TEST_IDS: Required<RuntimeErrorScreenTestIds> = {
  screen: "runtime-error-screen",
  summary: "runtime-error-summary",
  details: "runtime-error-details",
  copyBtn: "runtime-error-copy-btn",
  openTicketBtn: "runtime-error-open-ticket-btn",
};

export interface RuntimeErrorScreenProps {
  title?: string;
  subtitle?: string;
  detailsLabel?: string;
  message: string;
  details?: string;
  primaryAction: RuntimeErrorScreenAction;
  testIds?: RuntimeErrorScreenTestIds;
  withRootChrome?: boolean;
}

export function makeRuntimeErrorScreenPropsFromError(
  error: Error & { digest?: string },
  reset: () => void
): RuntimeErrorScreenProps {
  const summary = `${error.name || "Error"}: ${error.message || "Unknown error"}`;
  const details = [
    error.digest ? `digest: ${error.digest}` : null,
    error.stack ?? null,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    title: "Runtime Error",
    subtitle:
      "Something broke while rendering. Copy the trace below and open a ticket so it can be fixed.",
    detailsLabel: "Stack trace",
    message: summary,
    details,
    primaryAction: {
      label: "Try Again",
      icon: <RefreshCcw className="h-4 w-4" />,
      onClick: reset,
      className:
        "bg-red-600 text-zinc-50 hover:bg-red-500 border border-red-500/40",
      testId: "runtime-error-reset-btn",
    },
  };
}

const NEUTRAL_BTN_CLASS =
  "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700";

export const RuntimeErrorScreen: React.FC<RuntimeErrorScreenProps> = ({
  title = "Runtime Error",
  subtitle =
    "Something broke while rendering. Copy the trace below and open a ticket so it can be fixed.",
  detailsLabel = "Technical details",
  message,
  details,
  primaryAction,
  testIds,
}) => {
  const [copied, setCopied] = useState(false);
  const ids = { ...DEFAULT_TEST_IDS, ...testIds };

  useEffect(() => {
    console.error("[runtime-error]", { title, message, details });
  }, [title, message, details]);

  const handleCopy = () => {
    const text = message + (details ? "\n\n" + details : "");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenTicket = () => {
    if (typeof window !== "undefined") {
      window.open(REPO_NEW_ISSUE_URL, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownloadDiagnostics = () => {
    void downloadDiagnosticsBundle({ title, message, details });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-zinc-50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="runtime-error-title"
      aria-describedby="runtime-error-summary"
      data-testid={ids.screen}
    >
      <div className="shrink-0 flex flex-row items-center gap-4 border-b border-zinc-800 bg-zinc-900/60 px-5 py-4 sm:px-8 sm:py-5">
        <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full ring-1 ring-red-500/30 bg-red-500/10 overflow-hidden">
          <BrandLogo
            variant="face"
            alt=""
            fill
            sizes="56px"
            className="object-contain p-1.5 select-none pointer-events-none"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            id="runtime-error-title"
            className="text-xl sm:text-2xl font-semibold leading-tight"
          >
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={primaryAction.onClick}
          className={
            "shrink-0 px-3 py-2 rounded-md inline-flex items-center gap-2 text-sm font-medium " +
            (primaryAction.className ??
              "bg-red-600 text-zinc-50 hover:bg-red-500 border border-red-500/40")
          }
          data-testid={primaryAction.testId ?? "runtime-error-primary-btn"}
        >
          {primaryAction.icon}
          <span className="hidden sm:inline">{primaryAction.label}</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
        <div className="space-y-5 max-w-5xl mx-auto">
          <div className="flex items-start gap-3">
            <XCircle
              className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-red-400 mt-0.5"
              aria-hidden
            />
            <p
              id="runtime-error-summary"
              className="text-base sm:text-lg font-medium leading-snug break-words min-w-0"
              data-testid={ids.summary}
            >
              {message}
            </p>
          </div>

          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-amber-50 mb-1">
                  Include this in the ticket
                </p>
                <p className="text-xs sm:text-sm leading-relaxed text-amber-100/90">
                  Attach the diagnostics file to the ticket. It includes the
                  error trace, browser context, frontend logs, and backend logs
                  when the running backend exposes them.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadDiagnostics}
                className="shrink-0 rounded-md border border-amber-300/30 bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-300"
                data-testid="runtime-error-download-diagnostics-btn"
              >
                Download Diagnostics
              </button>
            </div>
          </div>

          {details && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/80">
              <div className="border-b border-zinc-800 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                {detailsLabel}
              </div>
              <pre
                className="px-3 py-3 text-xs sm:text-[13px] leading-relaxed font-mono text-zinc-200 whitespace-pre-wrap break-all overflow-x-hidden"
                data-testid={ids.details}
              >
                {details}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col gap-3 border-t border-zinc-800 bg-zinc-900/60 px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2 rounded-md inline-flex items-center gap-2 text-sm font-medium ${NEUTRAL_BTN_CLASS}`}
            data-testid={ids.copyBtn}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Error
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenTicket}
            className={`px-4 py-2 rounded-md inline-flex items-center gap-2 text-sm font-medium ${NEUTRAL_BTN_CLASS}`}
            data-testid={ids.openTicketBtn}
          >
            <LifeBuoy className="h-4 w-4" />
            Open Ticket
          </button>
        </div>
      </div>
    </div>
  );
};
