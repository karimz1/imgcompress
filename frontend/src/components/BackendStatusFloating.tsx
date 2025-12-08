"use client";

import { useBackendHealth } from "@/hooks/useBackendHealth";
import { Network, X } from "lucide-react";
import { useState } from "react";

/**
 * Floating backend & connectivity status widget
 * Clear privacy explanation included — no data ever leaves the container.
 */
export function BackendStatusFloating() {
  const { isDown, hasInternet, status, lastUpdate } = useBackendHealth();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Icon — visible when panel is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="System Status"
          className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition 
          ${isDown ? "bg-red-600 hover:bg-red-500" : "bg-neutral-900 hover:bg-neutral-700"} 
          text-white active:scale-95`}
        >
          <Network size={20}/>
        </button>
      )}

      {/* Main Status Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-80 p-4 rounded-xl shadow-xl
          bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700
          animate-in slide-in-from-bottom fade-in space-y-3 text-sm font-medium"
        >
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Network size={18}/>
              System & Connectivity Status
            </h2>

            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded"
            >
              <X size={16}/>
            </button>
          </div>

          <div className="space-y-1">
            <p>
              Container Backend:{" "}
              <b className={isDown ? "text-red-600" : "text-green-600"}>
                {isDown ? "Is Down ❌" : "Is Working"}
              </b>
            </p>

            <p>
              Network Access:{" "}
              <b className={hasInternet ? "text-green-600" : "text-red-600"}>
                {hasInternet ? "Has Internet Access" : "No Internet Detected 🚫"}
              </b>
            </p>

            <p>
              Mode: <b>{status ?? "Unknown"}</b>
            </p>
          </div>

          {/* Privacy reassurance */}
          <div className="text-xs opacity-70 leading-snug border-t pt-2 space-y-1">
            <p>
              <b>Privacy Notice:</b> imgcompress processes everything fully locally — no files,
              analytics or telemetry are ever uploaded or shared.
            </p>

            <p>
              Internet status is detected using a lightweight socket probe to CloudFlare DNS
              <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px]">1.1.1.1:53</code>.
              This checks basic network reachability only — <i>no data is transferred</i>.
            </p>

            <p className="opacity-60">
              The check is equivalent to a <i>ping-style connectivity test</i>, purely for diagnostics.
            </p>
          </div>


          <p className="text-xs opacity-40">
            Last Check: {lastUpdate ?? "--"}
          </p>
        </div>
      )}
    </>
  );
}
