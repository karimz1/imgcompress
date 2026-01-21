"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@/components/visually-hidden";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  isVisible: boolean;
  onAbort: () => void;
  disableLogo?: boolean;
}

const waitMessages = [
  "Compressing your files…",
  "Optimizing quality and size.",
  "Re-encoding images, please hold on.",
  "Large uploads can take a moment.",
  "Still working—thanks for your patience.",
  "Cleaning up and preparing your downloads.",
  "Balancing speed with quality right now.",
  "Finishing touches on the output files.",
  "Crunching pixels into smaller packages.",
  "Almost there—writing final bytes.",
  "Checking file integrity.",
  "Wrapping up conversion tasks.",
  "Making sure everything looks good.",
];

const helpfulTips = [
  "Keep working—leave this window open and I’ll drop your compressed files here when they’re ready.",
];

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
}: SplashScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Typewriter state for the current message
  const [displayText, setDisplayText] = useState("");

  const statusMessage = useMemo(() => waitMessages[messageIndex], [messageIndex]);
  const tipMessage = useMemo(
    () => helpfulTips[Math.floor(Math.random() * helpfulTips.length)],
    [isVisible]
  );

  // Rotate messages while visible
  useEffect(() => {
    if (!isVisible) return;

    setMessageIndex(0); // reset when it re-opens

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % waitMessages.length);
    }, 6500);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Typewriter effect whenever the message changes
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
          className="fixed inset-0 z-[101] flex items-center justify-center outline-none bg-transparent p-0"
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Compressing Files</DialogPrimitive.Title>
            <DialogPrimitive.Description>
              Please wait while your files are being compressed.
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

          <div className="relative w-full h-full flex flex-col items-center justify-center px-4 text-center">
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

            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl gap-8">
              {!disableLogo && (
                <div className="w-full flex justify-center animate-breathe">
                  <div className="relative w-[460px] h-[220px] max-w-[92vw] sm:w-[520px] sm:h-[240px] animate-glow after:absolute after:inset-0 after:rounded-[36%] after:bg-gradient-to-r after:from-blue-500/20 after:to-fuchsia-500/20 after:blur-3xl after:-z-10">
                    <Image
                      src="/logo_transparent.png"
                      alt="ImgCompress Logo"
                      fill
                      draggable={false}
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
              )}

              <div className="w-full flex flex-col items-center gap-5">
                {/* Animated message area */}
                <div className="min-h-[3.25rem] flex items-center justify-center">
                  <div
                    key={messageIndex}
                    className="text-base sm:text-lg text-gray-50 font-medium tracking-wide text-center max-w-2xl animate-text-pop bg-white/5 px-6 py-3 rounded-full shadow-lg shadow-blue-500/10 ring-1 ring-white/15 backdrop-blur-md"
                    aria-live="polite"
                  >
                    {displayText}
                    <span className="inline-block w-[0.6ch] cursor-blink">▍</span>
                  </div>
                </div>

                {/* Progress steps */}
                <div className="w-full max-w-2xl">
                  <div className="flex items-center justify-between gap-2">
                    {["Starting", "Compressing", "Packaging"].map((label, index) => (
                      <div
                        key={label}
                        className="flex flex-col items-center text-xs uppercase tracking-[0.2em] text-gray-400"
                      >
                        <div
                          className={cn(
                            "w-11 h-11 rounded-full mb-2 transition text-base font-semibold tracking-tight",
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

              {/* Loader */}
              <div className="w-full max-w-2xl h-2.5 bg-white/5 rounded-full overflow-hidden relative backdrop-blur-md ring-1 ring-white/10">
                <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 rounded-full animate-loading-bar shadow-[0_4px_18px_rgba(79,70,229,0.45)]" />
              </div>

              {/* Tips & actions */}
              <div className="w-full max-w-3xl flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-1 bg-white/5 rounded-2xl p-4 text-left text-sm text-gray-100 ring-1 ring-white/10 shadow-inner shadow-black/30 backdrop-blur-md">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-blue-200 mb-1">
                    Tip
                  </p>
                  <p className="text-base font-medium text-white/90">{tipMessage}</p>
                </div>
                <button
                  onClick={onAbort}
                  className="px-8 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-500/50 hover:text-red-200 text-gray-100 text-sm transition-all duration-200 backdrop-blur-md active:scale-95 outline-none focus:ring-2 focus:ring-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
