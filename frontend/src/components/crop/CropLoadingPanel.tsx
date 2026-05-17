"use client";

import React from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { fileFormatLabel } from "@/lib/crop";
import { cn } from "@/lib/utils";

interface CropLoadingPanelProps {
  file: File;
  isDarkTheme: boolean;
  disableLogo: boolean;
  variant?: "local" | "server";
}

const SERVER_LOADING_WORDS = ["Please", "wait", "a", "bit,", "I'm", "almost", "ready"];
const LOCAL_LOADING_WORDS = ["Opening", "crop", "editor"];

export const CropLoadingPanel: React.FC<CropLoadingPanelProps> = ({
  file,
  isDarkTheme,
  disableLogo,
  variant = "server",
}) => {
  const label = fileFormatLabel(file);
  const isServer = variant === "server";
  const loadingWords = isServer ? SERVER_LOADING_WORDS : LOCAL_LOADING_WORDS;
  const loadingCopy = isServer
    ? `${label} needs a server-rendered bitmap before cropping. Preparing it now.`
    : `Opening ${label} in the crop editor.`;

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col items-center justify-center gap-6 p-6 text-center",
        isDarkTheme ? "bg-zinc-950/20" : "bg-white"
      )}
      data-testid="crop-loading-panel"
    >
      <style jsx>{`
        @keyframes crop-loading-bar {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        .crop-loading-bar {
          animation: crop-loading-bar 1.35s infinite ease-in-out;
        }
        @keyframes crop-breathe {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        .crop-breathe {
          animation: crop-breathe 2.6s infinite ease-in-out;
          will-change: transform;
        }
        @keyframes crop-text-pop {
          0% {
            transform: translateY(8px) scale(0.98);
            opacity: 0;
            filter: blur(1px);
          }
          60% {
            transform: translateY(0) scale(1.02);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .crop-text-pop {
          animation: crop-text-pop 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
          will-change: transform, opacity, filter;
        }
        @keyframes crop-cursor-blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
        .crop-cursor-blink {
          animation: crop-cursor-blink 1s steps(1) infinite;
        }
        @keyframes crop-word-pop {
          0% {
            opacity: 0;
            transform: translateY(0.45em);
            filter: blur(2px);
          }
          70% {
            opacity: 1;
            transform: translateY(-0.04em);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
        .crop-word-pop {
          animation: crop-word-pop 3.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite both;
          will-change: transform, opacity, filter;
        }
      `}</style>

      {!disableLogo && (
        <div
          className={cn(
            "crop-breathe relative",
            isServer ? "h-36 w-36 sm:h-44 sm:w-44" : "h-24 w-24 sm:h-28 sm:w-28"
          )}
        >
          <BrandLogo
            fill
            sizes={isServer ? "(min-width: 640px) 176px, 144px" : "(min-width: 640px) 112px, 96px"}
            className="object-contain"
          />
        </div>
      )}

      <div className="min-h-[3.25rem] flex items-center justify-center">
        <div
          className={cn(
            "crop-text-pop text-base sm:text-lg font-medium tracking-wide text-center max-w-2xl px-6 py-3 rounded-full shadow-lg backdrop-blur-md",
            isDarkTheme
              ? "bg-transparent text-gray-50 shadow-blue-500/10 ring-1 ring-white/20"
              : "bg-transparent text-slate-950 shadow-slate-900/10 ring-1 ring-slate-300"
          )}
          data-testid="crop-loading-headline"
          aria-live="polite"
        >
          {loadingWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="inline-block crop-word-pop"
              style={{ animationDelay: `${index * 110}ms` }}
            >
              {word}
              {index < loadingWords.length - 1 ? " " : ""}
            </span>
          ))}
          <span className="inline-block w-[0.6ch] crop-cursor-blink">▍</span>
        </div>
      </div>

      <div className="relative w-full max-w-lg overflow-hidden px-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-current/10">
          <div
            className={cn(
              "crop-loading-bar h-full w-1/2 rounded-full",
              isDarkTheme ? "bg-zinc-200/80" : "bg-zinc-950"
            )}
          />
        </div>
      </div>

      <p className="max-w-xl text-base font-medium leading-relaxed opacity-80 sm:text-lg">
        {loadingCopy}
      </p>
    </div>
  );
};
