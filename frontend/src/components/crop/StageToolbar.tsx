"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Keyboard, Redo2, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useModifierLabel } from "./FitPlacementControls";

/** Shortcut rows: keys (Mod = Ctrl or ⌘) and the translation key of what they do. */
const SHORTCUTS: [string[][], string][] = [
  [[["Mod", "Z"]], "undo"],
  [[["Mod", "Shift", "Z"], ["Mod", "Y"]], "redo"],
  [[["Mod", "D"]], "duplicate"],
  [[["Del"]], "delete"],
  [[["Esc"]], "deselect"],
  [[["←↑→↓"], ["Shift", "←↑→↓"]], "nudge"],
  [[["Shift", "drag"]], "axis"],
  [[["Alt", "drag"]], "noSnap"],
  [[["Shift", "corner"]], "freeAspect"],
  [[["Shift", "rotate"]], "rotateSteps"],
  [[["Mod", "wheel"], ["Mod", "+"], ["Mod", "−"]], "zoom"],
  [[["Mod", "B"], ["Mod", "I"]], "boldItalic"],
  [[["dblclick"]], "editText"],
];

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  testId,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-md transition-colors hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-30",
        danger && "hover:text-red-500",
      )}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** Small bar above the stage: undo/redo, the selected layer's actions, shortcuts. */
export function StageToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  layerSelected,
  onDuplicate,
  onDelete,
  canDuplicate,
  compact,
  disabled,
  isDarkTheme,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** A text or picture (not the image or background) is selected. */
  layerSelected: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  canDuplicate: boolean;
  compact: boolean;
  disabled: boolean;
  isDarkTheme: boolean;
}) {
  const { t } = useTranslation();
  const mod = useModifierLabel();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      setShortcutsOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);
  const key = (k: string) =>
    k === "Mod" ? mod : ["Shift", "Alt", "Esc", "Del", "drag", "corner", "rotate", "wheel", "dblclick"].includes(k)
      ? t(`crop.fit.shortcuts.keys.${k}`)
      : k;
  const divider = <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-current opacity-15" />;
  return (
    <div className="flex shrink-0 justify-center px-3 pt-1">
      <div
        role="toolbar"
        aria-label={t("crop.fit.toolbar.label")}
        className={cn(
          "flex items-center gap-0.5 rounded-lg border p-1 shadow-sm",
          isDarkTheme ? "border-slate-700 bg-slate-950/90" : "border-slate-200 bg-white/90",
        )}
        data-testid="fit-stage-toolbar"
      >
        <ToolButton
          icon={Undo2}
          label={`${t("crop.fit.toolbar.undo")} (${mod}+Z)`}
          onClick={onUndo}
          disabled={disabled || !canUndo}
          testId="fit-undo-btn"
        />
        <ToolButton
          icon={Redo2}
          label={`${t("crop.fit.toolbar.redo")} (${mod}+Shift+Z)`}
          onClick={onRedo}
          disabled={disabled || !canRedo}
          testId="fit-redo-btn"
        />
        {!compact && (
          <>
            {divider}
            <ToolButton
              icon={Copy}
              label={`${t("crop.fit.toolbar.duplicate")} (${mod}+D)`}
              onClick={onDuplicate}
              disabled={disabled || !layerSelected || !canDuplicate}
              testId="fit-duplicate-btn"
            />
            <ToolButton
              icon={Trash2}
              label={`${t("crop.fit.toolbar.delete")} (${t("crop.fit.shortcuts.keys.Del")})`}
              onClick={onDelete}
              disabled={disabled || !layerSelected}
              testId="fit-delete-btn"
              danger
            />
            {divider}
            <Popover open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("crop.fit.toolbar.shortcuts")}
                  title={`${t("crop.fit.toolbar.shortcuts")} (?)`}
                  className="flex h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-md transition-colors hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  data-testid="fit-shortcuts-btn"
                >
                  <Keyboard className="h-4 w-4" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="max-h-[min(32rem,var(--radix-popover-content-available-height))] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto p-3 text-xs"
                align="center"
                data-testid="fit-shortcuts-popover"
                // A read-only list: focus stays where it was, so the dialog's focus
                // trap does not pull it back and close the list right away.
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <p className="mb-2 font-medium">{t("crop.fit.toolbar.shortcuts")}</p>
                {/* What it does on the left, the keys on the right: easy to scan, and long
                    translations wrap in the text column instead of squeezing the keys. */}
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
                  {SHORTCUTS.map(([combos, id]) => (
                    <React.Fragment key={id}>
                      <dt className="opacity-80">{t(`crop.fit.shortcuts.${id}`)}</dt>
                      <dd className="flex flex-wrap items-center justify-end gap-1">
                        {combos.map((combo, i) => (
                          <span key={i} className="flex items-center gap-0.5 whitespace-nowrap">
                            {i > 0 && <span className="mr-0.5 opacity-50">/</span>}
                            {combo.map((k) => (
                              <kbd key={k} className="rounded border border-current/30 px-1 py-0.5 font-mono text-[10px]">
                                {key(k)}
                              </kbd>
                            ))}
                          </span>
                        ))}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    </div>
  );
}

/** Focus is in a field where keys type text, so editor shortcuts must stay out. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'textarea, select, [contenteditable="true"], input:not([type="range"]):not([type="color"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="file"])',
    )
  );
}
