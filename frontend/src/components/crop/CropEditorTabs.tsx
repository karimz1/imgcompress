"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Crop, Image as ImageIcon, Layers, Move, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorTab = "crop" | "fit" | "background" | "layers";
export const EDITOR_TABS: EditorTab[] = ["crop", "fit", "background", "layers"];
/** Small screens and touch: cropping and the target size only. */
export const COMPACT_TABS: EditorTab[] = ["crop", "fit"];
const icons: Record<EditorTab, LucideIcon> = {
  crop: Crop,
  fit: Move,
  background: ImageIcon,
  layers: Layers,
};

export function CropEditorTabs({
  value,
  onChange,
  suffix = "",
  disabled = false,
  tabs = EDITOR_TABS,
}: {
  value: EditorTab;
  onChange: (value: EditorTab) => void;
  suffix?: string;
  disabled?: boolean;
  tabs?: EditorTab[];
}) {
  const { t } = useTranslation();
  const buttons = useRef<Partial<Record<EditorTab, HTMLButtonElement | null>>>({});
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: EditorTab) => {
    const at = tabs.indexOf(tab);
    let next: EditorTab;
    if (event.key === "Home") next = tabs[0];
    else if (event.key === "End") next = tabs[tabs.length - 1];
    else if (event.key === "ArrowRight") next = tabs[(at + 1) % tabs.length];
    else if (event.key === "ArrowLeft") next = tabs[(at - 1 + tabs.length) % tabs.length];
    else return;
    event.preventDefault();
    onChange(next);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t("crop.editorTitle")}
      className={cn(
        "grid min-w-0 flex-1 gap-0.5 rounded-lg bg-current/5 p-1",
        tabs.length === 4 ? "grid-cols-4" : "grid-cols-2",
      )}
      data-testid={`crop-editor-tabs${suffix}`}
    >
      {tabs.map((tab) => {
        const Icon = icons[tab];
        const name = t(`crop.tabs.${tab}`);
        return (
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
            aria-label={name}
            title={name}
            tabIndex={value === tab ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(tab)}
            onKeyDown={(event) => onKeyDown(event, tab)}
            data-testid={`crop-tab-${tab}${suffix}`}
            className={cn(
              "flex min-h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40",
              // Four tabs share a narrow panel: icon above a label of up to two lines.
              tabs.length > 2 ? "min-h-12" : "sm:flex-row sm:gap-1.5 sm:text-xs",
              value === tab
                ? "bg-background text-foreground shadow-sm"
                : "opacity-65 hover:bg-current/5 hover:opacity-100",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                "max-w-full",
                tabs.length > 2 ? "line-clamp-2 text-center [hyphens:manual]" : "truncate",
              )}
            >
              {t(`crop.tabs.short.${tab}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
