"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@/components/visually-hidden";
import { BrandLogo } from "@/components/BrandLogo";
import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { formatClock, type JobProgress } from "@/lib/conversionJob";

interface SplashScreenProps {
  isVisible: boolean;
  onAbort: () => void;
  disableLogo?: boolean;
  /** Live progress of the background job, when the server reports it. */
  progress?: JobProgress | null;
  /** When the job started, in this browser's clock (ms); drives the live timer. */
  startedAt?: number | null;
  /** "Notify me when done"; null hides it (not configured on this server). */
  notify?: { checked: boolean; onChange: (checked: boolean) => void } | null;
}


type ParticleConfig = {
  id: number;
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  drift: number;
  rise: number;
  hue: number;
  opacity: number;
};

type ParticleStyle = React.CSSProperties & {
  "--drift-x": string;
  "--rise-y": string;
  "--particle-opacity": string;
};

export function SplashScreen({
  isVisible,
  onAbort,
  disableLogo = false,
  progress = null,
  startedAt = null,
  notify = null,
}: SplashScreenProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isVisible || startedAt === null) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [isVisible, startedAt]);
  const progressText = describeProgress(progress, t);
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");

  const waitMessages = t("splash.messages", { returnObjects: true }) as string[];
  const statusMessage = useMemo(() => waitMessages[messageIndex], [messageIndex, waitMessages]);
  // AI upscaling on a small CPU can run for a long time: say so, and point to the notify switch.
  const isUpscale = Boolean(progress?.tiles_total);
  const tipMessage = t(isUpscale ? (notify ? "splash.tipUpscaleNotify" : "splash.tipUpscale") : "splash.tip");

  useEffect(() => {
    if (!isVisible) return;

    setMessageIndex(0);

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % waitMessages.length);
    }, 6500);

    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    setDisplayText("");
    let i = 0;

    const t = setInterval(() => {
      i += 1;
      setDisplayText(statusMessage.slice(0, i));
      if (i >= statusMessage.length) clearInterval(t);
    }, 18);

    return () => clearInterval(t);
  }, [isVisible, statusMessage]);

  const particles = useMemo<ParticleConfig[]>(() => {
    const COUNT = 70;
    return Array.from({ length: COUNT }, (_, id) => ({
      id,
      size: 2 + Math.random() * 4.5,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 8 + Math.random() * 6,
      drift: (Math.random() - 0.5) * 200,
      rise: -280 - Math.random() * 320,
      hue: 195 + Math.random() * 80,
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, []);

  return (
    <DialogPrimitive.Root open={isVisible}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-[101] block outline-none bg-transparent p-0 overflow-y-auto overscroll-contain"
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>{t("splash.dialogTitle")}</DialogPrimitive.Title>
            <DialogPrimitive.Description>
              {t("splash.dialogDescription")}
            </DialogPrimitive.Description>
          </VisuallyHidden>

          <style jsx>{`
            @keyframes loading-bar {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(200%);
              }
            }
            .animate-loading-bar {
              animation: loading-bar 1.5s infinite ease-in-out;
            }

            @keyframes breathe {
              0%,
              100% {
                transform: scale(1);
              }
              50% {
                transform: scale(1.05);
              }
            }
            .animate-breathe {
              animation: breathe 3s infinite ease-in-out;
              will-change: transform;
            }

            @keyframes glow {
              0%,
              100% {
                filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.3));
              }
              50% {
                filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.6));
              }
            }
            .animate-glow {
              animation: glow 3s infinite ease-in-out;
              will-change: filter;
            }

            @keyframes text-pop {
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
            .animate-text-pop {
              animation: text-pop 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
              will-change: transform, opacity, filter;
            }

            @keyframes blink {
              0%,
              49% {
                opacity: 1;
              }
              50%,
              100% {
                opacity: 0;
              }
            }
            .cursor-blink {
              animation: blink 1s steps(1) infinite;
            }

            @keyframes particle-float {
              0% {
                transform: translate3d(0, 0, 0) scale(0.8);
                opacity: 0;
              }
              15% {
                opacity: var(--particle-opacity, 0.85);
              }
              100% {
                transform: translate3d(var(--drift-x, 90px), var(--rise-y, -380px), 0)
                  scale(1.35);
                opacity: 0;
              }
            }

            .particle-glimmer {
              position: absolute;
              border-radius: 9999px;
              background: radial-gradient(
                circle,
                rgba(255, 255, 255, 0.95) 0%,
                rgba(255, 255, 255, 0.05) 70%
              );
              animation-name: particle-float;
              animation-timing-function: linear;
              animation-iteration-count: infinite;
              filter: blur(0.7px);
              mix-blend-mode: screen;
              will-change: transform, opacity, filter;
              box-shadow: 0 0 18px rgba(255, 255, 255, 0.35);
            }
          `}</style>

          {/* min-h-full + m-auto: centered when it fits, scrollable from the top
              when it does not (landscape phones). Safe-area padding keeps it clear
              of the notch and the home indicator. */}
          <div className="relative w-full min-h-full flex flex-col items-center px-4 text-center"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              {particles.map((particle) => {
                const style: ParticleStyle = {
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                  background: `radial-gradient(circle, hsla(${particle.hue}, 100%, 75%, 0.95) 0%, hsla(${particle.hue}, 100%, 60%, 0.05) 70%)`,
                  "--drift-x": `${particle.drift}px`,
                  "--rise-y": `${particle.rise}px`,
                  "--particle-opacity": `${particle.opacity}`,
                };
                return (
                  <span key={particle.id} className="particle-glimmer" style={style} />
                );
              })}
            </div>

            <div className="relative z-10 m-auto flex flex-col items-center w-full max-w-4xl gap-3 sm:gap-8">
              {!disableLogo && (
                <div className="w-full flex justify-center animate-breathe">
                  <div className="relative w-[240px] h-[110px] [@media(max-height:600px)]:h-[80px] max-w-[92vw] sm:w-[520px] sm:h-[240px] sm:[@media(max-height:600px)]:h-[120px] animate-glow after:absolute after:inset-0 after:rounded-[36%] after:bg-gradient-to-r after:from-blue-500/20 after:to-fuchsia-500/20 after:blur-3xl after:-z-10">
                    <BrandLogo
                      fill
                      alt="ImgCompress Logo"
                      sizes="(min-width: 640px) 520px, 460px"
                      className="object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="w-full flex flex-col items-center gap-3 sm:gap-5">
                <div className="min-h-[2.5rem] sm:min-h-[3.25rem] flex items-center justify-center">
                  <div
                    key={messageIndex}
                    className="text-sm sm:text-lg text-gray-50 font-medium tracking-wide text-center max-w-2xl animate-text-pop bg-white/5 px-4 py-2 sm:px-6 sm:py-3 rounded-full shadow-lg shadow-blue-500/10 ring-1 ring-white/15 backdrop-blur-md"
                    aria-live="polite"
                  >
                    {displayText}
                    <span className="inline-block w-[0.6ch] cursor-blink">▍</span>
                  </div>
                </div>

                <div className="w-full max-w-2xl">
                  <div className="flex items-center justify-between gap-2">
                    {[t("splash.steps.starting"), t("splash.steps.compressing"), t("splash.steps.packaging")].map((label, index) => (
                      <div
                        key={label}
                        className="flex flex-col items-center text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-gray-400"
                      >
                        <div
                          className={cn(
                            "w-8 h-8 sm:w-11 sm:h-11 rounded-full mb-1 sm:mb-2 transition text-sm sm:text-base font-semibold tracking-tight",
                            "flex items-center justify-center text-center",
                            index === 1
                              ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white border border-transparent shadow-lg shadow-blue-500/40"
                              : "border border-white/30 text-white/70 bg-black/30"
                          )}
                        >
                          <span className="mt-[1px]">{index + 1}</span>
                        </div>
                        <span className="text-[11px] sm:text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full max-w-2xl h-2.5 bg-white/5 rounded-full overflow-hidden relative backdrop-blur-md ring-1 ring-white/10">
                <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 rounded-full animate-loading-bar shadow-[0_4px_18px_rgba(79,70,229,0.45)]" />
              </div>
              {startedAt !== null && (
                <p className="text-sm text-gray-300 -mt-1 sm:-mt-4 tabular-nums" data-testid="job-elapsed">
                  {t("splash.elapsed", { time: formatClock((now - startedAt) / 1000) })}
                </p>
              )}
              {notify && (
                <label
                  htmlFor="notifyWhenDone"
                  className="sm:-mt-2 flex items-center gap-3 text-sm text-gray-200 cursor-pointer"
                >
                  <Switch
                    id="notifyWhenDone"
                    data-testid="notify-switch"
                    checked={notify.checked}
                    onCheckedChange={notify.onChange}
                  />
                  {t("splash.notify")}
                </label>
              )}
              {progressText && (
                <p className="text-sm text-gray-300 -mt-1 sm:-mt-4" data-testid="job-progress" aria-live="polite">
                  {progressText}
                </p>
              )}

              <div className="w-full max-w-3xl flex flex-col md:flex-row gap-3 sm:gap-4 items-center">
                <div
                  className={cn(
                    "w-full md:w-auto flex-1 rounded-2xl px-3 py-2.5 sm:p-4 text-left text-sm text-gray-100 shadow-inner shadow-black/30 backdrop-blur-md",
                    isUpscale ? "bg-amber-400/10 ring-1 ring-amber-400/40" : "bg-white/5 ring-1 ring-white/10"
                  )}
                  data-testid="job-tip"
                >
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.3em] mb-0.5 sm:mb-1",
                      isUpscale ? "text-amber-300" : "text-blue-200"
                    )}
                  >
                    {isUpscale && <Hourglass aria-hidden="true" className="h-3 w-3 shrink-0" />}
                    {t("splash.tipLabel")}
                  </p>
                  <p
                    className={cn(
                      "text-[13px] leading-snug sm:text-base sm:leading-normal font-medium",
                      isUpscale ? "text-amber-100" : "text-white/90"
                    )}
                    data-testid="job-background-hint"
                  >
                    {tipMessage}
                  </p>
                </div>
                <button
                  data-testid="splash-cancel"
                  onClick={onAbort}
                  className="shrink-0 px-8 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-500/50 hover:text-red-200 text-gray-100 text-sm transition-all duration-200 backdrop-blur-md active:scale-95 outline-none focus:ring-2 focus:ring-white/20"
                >
                  {t("splash.cancelButton")}
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function describeProgress(
  progress: JobProgress | null,
  t: (key: string, options?: Record<string, unknown>) => string
): string | null {
  if (!progress) return null;
  if (progress.waiting) return t("splash.waitingForUpscale");
  if (progress.tiles_total && progress.tiles_total > 1) {
    return t("splash.progressTiles", { done: progress.tiles_done ?? 0, total: progress.tiles_total });
  }
  if (progress.files_total && progress.files_total > 1) {
    return t("splash.progressFiles", { done: progress.files_done ?? 0, total: progress.files_total });
  }
  return null;
}
