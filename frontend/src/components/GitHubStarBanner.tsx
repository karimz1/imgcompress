"use client";

import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

const DISMISSED_KEY = "imgcompress_github_star_dismissed";
const CONVERSIONS_KEY = "imgcompress_conversion_count";
const LAST_COMPRESSION_KEY = "imgcompress_last_compression_id";

interface GitHubStarBannerProps {
  compressionId: string;
}

const GitHubStarBanner: React.FC<GitHubStarBannerProps> = ({ compressionId }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!compressionId) return;
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed) return;

      let total = parseInt(localStorage.getItem(CONVERSIONS_KEY) ?? "0", 10);

      const lastId = sessionStorage.getItem(LAST_COMPRESSION_KEY);
      if (lastId !== compressionId) {
        sessionStorage.setItem(LAST_COMPRESSION_KEY, compressionId);
        total += 1;
        localStorage.setItem(CONVERSIONS_KEY, String(total));
      }

      if (total >= 2) setVisible(true);
    } catch {
    }
  }, [compressionId]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div data-testid="github-star-banner" className="mx-4 mt-3 rounded-lg border border-amber-200/50 bg-amber-50/40 px-4 py-3 dark:border-amber-500/15 dark:bg-amber-500/5">
      <div className="flex items-start gap-3">
        <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Found ImgCompress useful?{" "}
            <a
              href={APP_CONFIG.GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-800 underline underline-offset-2 transition-colors hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              A star on GitHub
            </a>{" "}
            helps others discover it.
          </p>
          <button
            data-testid="github-star-banner-dismiss-btn"
            onClick={dismiss}
            className="mt-1 text-xs text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitHubStarBanner;
