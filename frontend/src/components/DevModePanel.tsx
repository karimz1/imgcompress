"use client";

import React, { useState } from "react";
import { AlertOctagon, Bug, FlaskConical, ListTree, Skull } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useErrorStore } from "@/context/ErrorStore";
import { cn } from "@/lib/utils";

function buildLongTraceback(): string {
  const lines: string[] = ["Traceback (most recent call last):"];
  for (let i = 0; i < 60; i += 1) {
    const padded = i.toString().padStart(2, "0");
    const file = `/workspaces/imgcompress/backend/image_converter/core/factory/synthetic_chain_stage_${padded}.py`;
    lines.push(`  File "${file}", line ${100 + i}, in stage_${padded}`);
    lines.push(
      `    forward_to_next_stage(payload, retry_policy=AggressiveExponentialBackoffWithJitterAndCircuitBreaker_${padded})`
    );
  }
  lines.push(
    "RuntimeError: All 60 synthetic stages reported failures. This trace is intentionally a page long so the error widget can be tested for scroll, wrap, and footer-stickiness behavior under load."
  );
  return lines.join("\n");
}

type ThrowKind = null | "short" | "long";

export const DevModePanel: React.FC = () => {
  const { setError } = useErrorStore();
  const [shouldThrow, setShouldThrow] = useState<ThrowKind>(null);

  if (shouldThrow === "short") {
    throw new Error(
      "[dev-mode] Synthetic runtime error to verify the global error boundary."
    );
  }
  if (shouldThrow === "long") {
    const err = new Error(
      "[dev-mode] Long synthetic runtime error — the stack trace below is intentionally one page long so you can verify the error screen scrolls vertically and wraps long file paths cleanly."
    );
    err.stack = buildLongTraceback();
    throw err;
  }

  const triggerShortApiError = () => {
    setError({
      message: "[dev-mode] Synthetic API failure",
      details:
        "This error was triggered from the dev panel to verify the API error widget.\n\n" +
        "Traceback (most recent call last):\n" +
        '  File "/workspaces/imgcompress/backend/image_converter/.../fake_handler.py", line 42, in handle\n' +
        "    raise SyntheticError('boom')\n" +
        "SyntheticError: boom",
      isApiError: true,
    });
  };

  const triggerLongApiError = () => {
    setError({
      message:
        "[dev-mode] Synthetic API failure with a one-page-long traceback",
      details: buildLongTraceback(),
      isApiError: true,
    });
  };

  const triggerShortRuntimeError = () => {
    setShouldThrow("short");
  };

  const triggerLongRuntimeError = () => {
    setShouldThrow("long");
  };

  return (
    <div
      className="fixed left-4 top-4 z-[60]"
      data-testid="dev-mode-panel"
    >
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-2 px-3 rounded-full",
              "border-amber-500/40 bg-amber-500/10 text-amber-400",
              "hover:bg-amber-500/20 hover:border-amber-500/60",
              "shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400"
            )}
            data-testid="dev-mode-toggle-btn"
            title="Dev mode tools (only shown when DEV_MODE=true)"
          >
            <FlaskConical className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              DEV
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn(
            "w-80 p-0 overflow-hidden rounded-md border shadow-xl",
            "bg-zinc-900 text-zinc-100 border-zinc-700/70"
          )}
          style={{ backgroundColor: "#18181b", color: "#f4f4f5" }}
          data-testid="dev-mode-popover"
        >
          <div className="max-h-[80vh] overflow-y-auto p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertOctagon className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold leading-tight">
                  Developer Tools
                </h3>
                <p className="text-xs opacity-70 mt-0.5">
                  Trigger UI states to verify error surfaces. None of these
                  call the real backend.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                  API error widget
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full justify-start gap-2 bg-amber-600 text-zinc-50 hover:bg-amber-500 border-0"
                  onClick={triggerShortApiError}
                  data-testid="dev-mode-trigger-api-error-btn"
                >
                  <Bug className="h-4 w-4" />
                  Trigger API Error
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="w-full justify-start gap-2 bg-amber-700 text-zinc-50 hover:bg-amber-600 border-0"
                  onClick={triggerLongApiError}
                  data-testid="dev-mode-trigger-api-error-long-btn"
                >
                  <ListTree className="h-4 w-4" />
                  Trigger API Error (long stack)
                </Button>
              </div>

              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                  Runtime boundary
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full justify-start gap-2 bg-red-600 text-zinc-50 hover:bg-red-500 border-0"
                  onClick={triggerShortRuntimeError}
                  data-testid="dev-mode-trigger-runtime-error-btn"
                >
                  <Skull className="h-4 w-4" />
                  Trigger Runtime Error
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="w-full justify-start gap-2 bg-rose-800 text-zinc-50 hover:bg-rose-700 border-0"
                  onClick={triggerLongRuntimeError}
                  data-testid="dev-mode-trigger-runtime-error-long-btn"
                >
                  <ListTree className="h-4 w-4" />
                  Trigger Runtime Error (long stack)
                </Button>
              </div>
            </div>

            <p className="text-[11px] opacity-60 mt-4 leading-relaxed">
              Toggle this panel via{" "}
              <code className="font-mono text-amber-300">DEV_MODE</code> in{" "}
              <code className="font-mono text-amber-300">
                /config/runtime.json
              </code>
              . It is never shown when the flag is off.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
