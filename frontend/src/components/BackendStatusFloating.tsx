"use client";

import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useInternetHealth } from "@/hooks/useInternetHealth";
import { Network, X } from "lucide-react";
import { useState } from "react";

export function BackendStatusFloating() {
  const { isDown, status, backendLastUpdate } = useBackendHealth();
  const { hasInternet, lastUpdate, loading, checkInternet } = useInternetHealth();
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="System Status"
          className={`fixed bottom-4 right-4 z-[70] p-3 rounded-full shadow-lg transition 
          ${isDown ? "bg-red-600 hover:bg-red-500" : "bg-neutral-900 hover:bg-neutral-700"} 
          text-white active:scale-95`}
        >
          <Network size={20}/>
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-[70] w-80 p-4 rounded-xl shadow-xl
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
                {hasInternet === null ? "Not Checked" : hasInternet ? "Has Internet Access" : "No Internet Detected 🚫"}
              </b>
            </p>

            <p>Mode: <b>{status ?? "Unknown"}</b></p>

            <button
              onClick={checkInternet}
              disabled={loading}
              className="mt-2 px-3 py-1.5 rounded bg-neutral-800 text-white hover:bg-neutral-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              {loading ? "Checking..." : "Check Internet Connection"}
            </button>
          </div>

          <div className="text-xs opacity-70 leading-snug border-t pt-2 space-y-2">
            <p className="font-semibold">Why this exists?</p>

            <p>
              This widget helps verify that the imgcompress container is healthy and whether
              outbound internet access is available for transparency & security hardening.
            </p>

            <p>
              The connectivity test is a <b>lightweight DNS reachability probe</b> to Cloudflare
              <code className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px]">1.1.1.1:53</code>,
              equivalent to a ping. No images, files or metadata ever leave your machine.
            </p>

            <p>
              This is especially useful when running imgcompress in network-isolated containers
              and wanting a visible confirmation that it's properly sandboxed and offline.
            </p>

            <a
              href="https://github.com/karimz1/imgcompress/issues/382"
              target="_blank"
              className="underline opacity-80 hover:opacity-100"
            >
              Learn more about the security reasoning behind this feature →
            </a>

            <p className="opacity-60">
              Future plans include network isolation docs & container hardening guides.
              Contributions welcome.
            </p>
          </div>

          <p className="text-xs opacity-40 pt-2">
            Backend Last Check: {backendLastUpdate ?? "--"}<br/>
            Internet Last Check: {lastUpdate ?? "--"}
          </p>
        </div>
      )}
    </>
  );
}
