"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@/components/visually-hidden";

interface SplashScreenProps {
  isVisible: boolean;
  onAbort: () => void;
}

const MESSAGES = [
  "ImgCompress-chan is on the case!",
  "Pixel-squish time… squish squish~",
  "Compression mode: ON! Full sparkle power!!",
  "Hold up, I’m taming the pixels right now~",
  "So many pixels… but I won’t lose!!",
  "Shh… I’m carefully squeezing the file size~",
  "Calculating… optimizing… kawaii-fying… (just kidding)",
  "Almost done! Final squish incoming~",
  "Just a moment—quality protection spell active!",
  "Still working! These pixels are stubborn…",
  "Loading… tiny computer noises",
  "Okay okay, I’m speeding up!!",
  "Nearly there—wrapping up the last bits~"
];

export function SplashScreen({ isVisible, onAbort }: SplashScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotate the anime-style messages while the splash is visible
  useEffect(() => {
    if (!isVisible) return;

    setMessageIndex(0); // reset when it re-opens

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 12000); // change every 12 seconds

    return () => clearInterval(interval);
  }, [isVisible]);

  const statusMessage = MESSAGES[messageIndex];

  return (
    <DialogPrimitive.Root open={isVisible}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()} // Prevent closing via Escape
          onPointerDownOutside={(e) => e.preventDefault()} // Prevent closing by clicking outside
          className="fixed left-[50%] top-[50%] z-[101] translate-x-[-50%] translate-y-[-50%] flex flex-col items-center justify-center outline-none"
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
          `}</style>

          {/* Floating Card Container */}
          <div className="flex flex-col items-center p-8 rounded-2xl">
            {/* Breathing & Glowing Logo Container */}
            <div className="mb-8 w-full flex justify-center animate-breathe">
              <div className="relative w-[500px] h-[250px] max-w-[90vw] animate-glow">
                <Image
                  src="/logo_transparent.png"
                  alt="ImgCompress Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Static label */}
            <div className="text-[11px] uppercase tracking-[0.25em] text-blue-200/80 mb-2">
              <strong className="text-cyan-200">ImgCompress-chan</strong> is compressing your images.
            </div>

            {/* Anime-style Status Text */}
            <div className="text-sm text-gray-200 mb-6 font-medium tracking-wide text-center max-w-xs">
              {statusMessage}
            </div>

            {/* Reassurance line */}  
            <div className="text-xs text-gray-400/90 text-center max-w-xs">
              Bigger images or lots of files can take a moment — thanks for hanging out~
            </div>

            {/* Loader */}
            <div className="w-[240px] h-1.5 bg-gray-700/50 rounded-full overflow-hidden relative backdrop-blur-md mb-8">
              <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-loading-bar shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            </div>

            {/* Abort Button */}
            <button
              onClick={onAbort}
              className="px-8 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-red-500/50 hover:text-red-200 text-gray-300 text-sm transition-all duration-200 backdrop-blur-md active:scale-95 outline-none focus:ring-2 focus:ring-white/20"
            >
              Cancel
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}