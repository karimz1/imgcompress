"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_PRESET_NAME_LENGTH,
  MAX_PRESETS,
  PresetRequestError,
  createPreset,
  deletePreset,
  updatePreset,
  type CompressionPreset,
  type PresetSettings,
} from "@/lib/presets";
import { cn } from "@/lib/utils";

interface CompressionPresetsProps {
  presets: CompressionPreset[];
  loadFailed: boolean;
  refresh: () => Promise<void>;
  /** Shown as selected only while the form still matches it; otherwise the list reads "Custom". */
  activePresetId: string | null;
  /** What the form would convert with right now; null while it cannot convert. */
  currentSettings: PresetSettings | null;
  onApply: (preset: CompressionPreset) => void;
  /** Marks a preset as selected without changing the form (it was just saved from it). */
  onActivate: (id: string) => void;
  disabled: boolean;
  isDarkTheme: boolean;
}

/** The user's language for an API error; only validation errors keep the server's own words. */
function usePresetErrorText() {
  const { t } = useTranslation();
  return (err: unknown): string => {
    const code = err instanceof PresetRequestError ? err.code : null;
    switch (code) {
      case "limit_reached":
        return t("presets.errors.limitReached", { max: MAX_PRESETS });
      case "name_taken":
        return t("presets.errors.nameTaken");
      case "not_found":
        return t("presets.errors.notFound");
      case "unavailable":
      case "disabled":
        return t("presets.errors.unavailable");
      default:
        return t("presets.errors.failed", { message: err instanceof Error ? err.message : String(err) });
    }
  };
}

const formatLabel = (format: string) => (format === "webp" ? "WebP" : format.toUpperCase());

export function CompressionPresets({
  presets,
  loadFailed,
  refresh,
  activePresetId,
  currentSettings,
  onApply,
  onActivate,
  disabled,
  isDarkTheme,
}: CompressionPresetsProps) {
  const { t } = useTranslation();
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const selectSurface = isDarkTheme
    ? "bg-gray-800 text-gray-300 border-gray-700"
    : "bg-white text-slate-900 border-slate-300";

  return (
    <div className="space-y-1" data-testid="compression-presets">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Label htmlFor="compressionPreset" className="text-sm">
          {t("presets.label")}
        </Label>
        <Select
          value={activePresetId ?? ""}
          onValueChange={(id) => {
            const preset = presets.find((candidate) => candidate.id === id);
            if (preset) onApply(preset);
          }}
          // Presets are shared, so pick up ones saved elsewhere when the list opens.
          onOpenChange={(open) => {
            if (open) void refresh();
          }}
          disabled={disabled || loadFailed || presets.length === 0}
        >
          <SelectTrigger
            id="compressionPreset"
            data-testid="preset-select"
            className={cn(selectSurface, "h-9 w-48 focus:border-blue-500 focus:ring-2 focus:ring-blue-500")}
          >
            <SelectValue placeholder={t("presets.custom")} />
          </SelectTrigger>
          <SelectContent className={selectSurface}>
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id} data-testid="preset-option">
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || loadFailed || !currentSettings}
          title={currentSettings ? undefined : t("presets.invalidSettings")}
          onClick={() => setSaveOpen(true)}
          data-testid="preset-save-btn"
        >
          <Save className="h-4 w-4" />
          {t("presets.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || loadFailed}
          onClick={() => {
            setManageOpen(true);
            void refresh();
          }}
          data-testid="preset-manage-btn"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("presets.manage")}
        </Button>
      </div>
      {loadFailed && (
        <p className="text-right text-xs text-red-500" data-testid="presets-unavailable">
          {t("presets.errors.unavailable")}
        </p>
      )}
      {currentSettings && (
        <SavePresetDialog
          open={saveOpen}
          onOpenChange={setSaveOpen}
          settings={currentSettings}
          onSaved={async (preset) => {
            await refresh();
            onActivate(preset.id);
          }}
        />
      )}
      <ManagePresetsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        presets={presets}
        currentSettings={currentSettings}
        refresh={refresh}
        onActivate={onActivate}
      />
    </div>
  );
}

interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PresetSettings;
  onSaved: (preset: CompressionPreset) => Promise<void>;
}

function SavePresetDialog({ open, onOpenChange, settings, onSaved }: SavePresetDialogProps) {
  const { t } = useTranslation();
  const errorText = usePresetErrorText();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const preset = await createPreset(trimmed, settings);
      await onSaved(preset);
      toast.success(t("presets.toast.saved", { name: preset.name }));
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="preset-save-dialog" className="max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("presets.saveTitle")}</DialogTitle>
            <DialogDescription>{t("presets.saveDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="presetName">{t("presets.nameLabel")}</Label>
            <Input
              id="presetName"
              data-testid="preset-name-input"
              value={name}
              maxLength={MAX_PRESET_NAME_LENGTH}
              placeholder={t("presets.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-500" role="alert" data-testid="preset-save-error">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("presets.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || busy} data-testid="preset-save-confirm-btn">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("presets.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ManagePresetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: CompressionPreset[];
  currentSettings: PresetSettings | null;
  refresh: () => Promise<void>;
  onActivate: (id: string) => void;
}

function ManagePresetsDialog({
  open,
  onOpenChange,
  presets,
  currentSettings,
  refresh,
  onActivate,
}: ManagePresetsDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="preset-manage-dialog" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("presets.manageTitle")}</DialogTitle>
          <DialogDescription>{t("presets.manageDescription")}</DialogDescription>
        </DialogHeader>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="preset-manage-empty">
            {t("presets.manageEmpty")}
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {presets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                currentSettings={currentSettings}
                refresh={refresh}
                onActivate={onActivate}
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface PresetRowProps {
  preset: CompressionPreset;
  currentSettings: PresetSettings | null;
  refresh: () => Promise<void>;
  onActivate: (id: string) => void;
}

/** One preset: rename in place; replacing its settings and deleting both ask first. */
function PresetRow({ preset, currentSettings, refresh, onActivate }: PresetRowProps) {
  const { t } = useTranslation();
  const errorText = usePresetErrorText();
  const [name, setName] = useState(preset.name);
  const [confirming, setConfirming] = useState<"overwrite" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(preset.name), [preset.name]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirming(null);
    } catch (err) {
      setError(errorText(err));
      // Someone else may have changed or deleted it; show the list as it is now.
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const rename = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === preset.name) return;
    void run(async () => {
      const updated = await updatePreset(preset.id, { name: trimmed });
      await refresh();
      toast.success(t("presets.toast.renamed", { name: updated.name }));
    });
  };

  const overwrite = () =>
    run(async () => {
      if (!currentSettings) return;
      const updated = await updatePreset(preset.id, { settings: currentSettings });
      await refresh();
      onActivate(updated.id);
      toast.success(t("presets.toast.updated", { name: updated.name }));
    });

  const remove = () =>
    run(async () => {
      await deletePreset(preset.id);
      await refresh();
      toast.success(t("presets.toast.deleted", { name: preset.name }));
    });

  const trimmedName = name.trim();
  return (
    <li className="space-y-2 rounded-md border p-3" data-testid="preset-row" data-preset-name={preset.name}>
      <form onSubmit={rename} className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t("presets.nameLabel")}
          data-testid="preset-row-name-input"
          value={name}
          maxLength={MAX_PRESET_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className="h-9 min-w-0 flex-1"
        />
        <span className="w-12 rounded border py-0.5 text-center text-[10px] font-semibold text-muted-foreground">
          {formatLabel(preset.settings.format)}
        </span>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={busy || !trimmedName || trimmedName === preset.name}
          data-testid="preset-rename-btn"
        >
          {t("presets.rename")}
        </Button>
      </form>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || !currentSettings}
          title={currentSettings ? undefined : t("presets.invalidSettings")}
          onClick={() => setConfirming("overwrite")}
          data-testid="preset-overwrite-btn"
        >
          {t("presets.overwrite")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirming("delete")}
          className="text-red-600 hover:text-red-700 dark:text-red-400"
          data-testid="preset-delete-btn"
        >
          {t("presets.delete")}
        </Button>
      </div>
      {confirming && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="preset-confirm"
        >
          <span className="mr-auto">
            {t(confirming === "overwrite" ? "presets.overwriteConfirm" : "presets.deleteConfirm", {
              name: preset.name,
            })}
          </span>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(null)}>
            {t("presets.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={confirming === "delete" ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void (confirming === "overwrite" ? overwrite() : remove())}
            data-testid="preset-confirm-btn"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t(confirming === "overwrite" ? "presets.overwriteConfirmButton" : "presets.delete")}
          </Button>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-500" role="alert" data-testid="preset-row-error">
          {error}
        </p>
      )}
    </li>
  );
}
