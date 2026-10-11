"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type EditorTab = "crop" | "fit";
const tabs: EditorTab[] = ["crop", "fit"];

export function CropEditorTabs({
  value,
  onChange,
  suffix = "",
  disabled = false,
}: {
  value: EditorTab;
  onChange: (value: EditorTab) => void;
  suffix?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const buttons = useRef<Partial<Record<EditorTab, HTMLButtonElement | null>>>(
    {},
  );
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: EditorTab,
  ) => {
    let next: EditorTab;
    if (event.key === "Home") next = "crop";
    else if (event.key === "End") next = "fit";
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      next = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
    } else return;
    event.preventDefault();
    onChange(next);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("crop.editorTitle")}
      className="grid min-w-0 flex-1 grid-cols-2 rounded-lg bg-current/5 p-1"
      data-testid={`crop-editor-tabs${suffix}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          ref={(element) => {
            buttons.current[tab] = element;
          }}
          type="button"
          role="tab"
          id={`crop-editor-tab-${tab}${suffix}`}
          aria-controls={`crop-editor-panel-${tab}${suffix}`}
          aria-selected={value === tab}
          tabIndex={value === tab ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => onKeyDown(event, tab)}
          data-testid={`crop-tab-${tab}${suffix}`}
          className={cn(
            "min-h-9 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50",
            value === tab
              ? "bg-background text-foreground shadow-sm"
              : "opacity-65 hover:bg-current/5 hover:opacity-100",
          )}
        >
          {t(`crop.tabs.${tab}`)}
        </button>
      ))}
    </div>
  );
}
