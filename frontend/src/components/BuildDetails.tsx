"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type BuildInfo } from "@/lib/build-info";
import { APP_CONFIG } from "@/lib/config";

export function BuildDetails({ info, version }: { info: BuildInfo | null; version: string }) {
  const { t, i18n } = useTranslation();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (!info) return <span>{t("footer.version", { version })}</span>;

  const date = new Date(info.builtAt);
  const buildDate = new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "short", day: "numeric" }).format(date);
  const buildTime = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "long" }).format(date);
  const channel = t(`footer.build.channels.${info.channel}`);
  const preview = info.channel === "nightly" || info.channel === "rc";
  const commitUrl = info.commit ? `${APP_CONFIG.GITHUB_REPO_URL}/commit/${info.commit}` : null;

  const copyDetails = async () => {
    const lines = [`imgcompress ${version}`, channel, info.builtAt, info.buildId, commitUrl].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <Dialog onOpenChange={() => setCopyState("idle")}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="build-details-trigger"
          aria-label={t("footer.build.open")}
          className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-md px-1 py-1 text-xs hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{t("footer.version", { version })}</span>
          {preview && (
            <>
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-sky-700 dark:text-sky-300">{channel}</span>
              <time dateTime={info.builtAt}>{buildDate}</time>
              {info.commit && <span className="font-mono">{info.commit.slice(0, 7)}</span>}
            </>
          )}
          <Info className="h-3 w-3" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent data-testid="build-details-dialog" className="w-[calc(100%_-_2rem)] max-w-md rounded-xl text-left">
        <DialogHeader>
          <DialogTitle>{t("footer.build.title")}</DialogTitle>
          <DialogDescription>{t("footer.build.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">v{version}</span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{channel}</span>
        </div>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("footer.build.built")}</dt>
            <dd className="mt-1">
              <time dateTime={info.builtAt}>{buildTime}</time>
            </dd>
          </div>
          {info.commit && commitUrl && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("footer.build.commit")}</dt>
              <dd className="mt-1">
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono underline underline-offset-4 hover:text-primary"
                >
                  {info.commit.slice(0, 7)}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">{t("footer.build.buildId")}</dt>
            <dd className="mt-1 break-all rounded-lg bg-muted/50 p-3 font-mono text-xs select-all">{info.buildId}</dd>
          </div>
        </dl>
        <Button variant="outline" onClick={copyDetails} className="mt-1 gap-2">
          {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {t(copyState === "copied" ? "footer.build.copied" : "footer.build.copy")}
        </Button>
        <span role="status" className="sr-only">{copyState === "copied" ? t("footer.build.copied") : ""}</span>
        {copyState === "failed" && <p role="status" className="text-xs text-muted-foreground">{t("footer.build.copyFailed")}</p>}
      </DialogContent>
    </Dialog>
  );
}
