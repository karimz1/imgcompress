"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/BrandLogo";
import { fileFormatLabel } from "@/lib/crop";
import { cn } from "@/lib/utils";
import styles from "./CropLoadingPanel.module.css";

interface CropLoadingPanelProps {
  file: File;
  isDarkTheme: boolean;
  disableLogo: boolean;
  variant?: "local" | "server";
}

export const CropLoadingPanel: React.FC<CropLoadingPanelProps> = ({
  file,
  isDarkTheme,
  disableLogo,
  variant = "server",
}) => {
  const { t } = useTranslation();
  const label = fileFormatLabel(file);
  const isServer = variant === "server";
  const rawWords = t(
    isServer ? "crop.loading.serverWords" : "crop.loading.localWords",
    { returnObjects: true }
  );
  const loadingWords = Array.isArray(rawWords) ? (rawWords as string[]) : [];
  const loadingCopy = isServer
    ? t("crop.loading.serverMessage", { label })
    : t("crop.loading.localMessage", { label });

  return (
    <div
      className={cn(
        "flex-1 min-h-0 flex flex-col items-center justify-center gap-6 p-6 text-center",
        isDarkTheme ? "bg-zinc-950/20" : "bg-white"
      )}
      data-testid="crop-loading-panel"
    >
      {!disableLogo && (
        <div
          className={cn(
            styles.breathe,
            "relative",
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
            styles.textPop,
            "text-base sm:text-lg font-medium tracking-wide text-center max-w-2xl px-6 py-3 rounded-full shadow-lg backdrop-blur-md",
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
              className={cn(styles.animatedWord, "inline-block")}
            >
              {word}
              {index < loadingWords.length - 1 ? " " : ""}
            </span>
          ))}
          <span className={cn(styles.cursorBlink, "inline-block w-[0.6ch]")}>▍</span>
        </div>
      </div>

      <div className="relative w-full max-w-lg overflow-hidden px-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-current/10">
          <div
            className={cn(
              styles.loadingBar,
              "h-full w-1/2 rounded-full",
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
