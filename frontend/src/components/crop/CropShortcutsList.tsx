"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CropShortcutsListProps {
  surfaceClass: string;
}

const SHORTCUTS: { keys: string[]; desc: string }[] = [
  { keys: ["Drag"], desc: "Move crop" },
  { keys: ["Drag corner"], desc: "Resize" },
  { keys: ["Alt", "+ Drag handle"], desc: "Resize from center" },
  { keys: ["Wheel"], desc: "Zoom at cursor" },
  { keys: ["Space", "+ Drag"], desc: "Pan" },
  { keys: ["Esc"], desc: "Close" },
];

export const CropShortcutsList: React.FC<CropShortcutsListProps> = ({
  surfaceClass,
}) => (
  <div
    className={cn(
      "text-xs rounded-md border p-2 space-y-1 opacity-90",
      surfaceClass
    )}
    data-testid="crop-shortcuts"
  >
    <div className="font-medium uppercase tracking-wide opacity-70 mb-1">
      Shortcuts
    </div>
    {SHORTCUTS.map(({ keys, desc }) => (
      <div key={desc} className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          {keys.map((k, i) => (
            <kbd
              key={i}
              className="rounded border border-current/40 px-1 py-0.5 text-[10px] font-mono opacity-90"
            >
              {k}
            </kbd>
          ))}
        </span>
        <span className="opacity-80">{desc}</span>
      </div>
    ))}
  </div>
);
