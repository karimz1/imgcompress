import React from "react";
import { ExternalLink, Heart, ArrowUpCircle } from "lucide-react";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { APP_CONFIG } from "@/lib/config";

const PageFooter = (props: React.HTMLAttributes<HTMLDivElement>) => {
  const { currentVersion, latestVersion, updateAvailable } = useVersionCheck();

  const links = [
    { href: APP_CONFIG.DOCS_URL, label: "Docs" },
    { href: APP_CONFIG.GITHUB_REPO_URL, label: "GitHub" },
    { href: APP_CONFIG.GITHUB_ISSUES_URL, label: "Issues" },
    { href: APP_CONFIG.AUTHOR_URL, label: "Author" },
    { href: APP_CONFIG.SPONSOR_URL, label: "Sponsor", icon: Heart },
  ];

  return (
    <footer className="w-full max-w-3xl mt-16 pt-8 pb-6 text-center border-t border-border/40" {...props}>
      <div className="space-y-4">
        {updateAvailable && latestVersion && (
          <div className="mx-auto max-w-md px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
            <div className="flex items-center justify-center gap-2 text-xs font-medium">
              <ArrowUpCircle className="h-4 w-4" />
              <span>
                Update available: {latestVersion} •{" "}
                <a
                  href={APP_CONFIG.DOCS_RELEASE_NOTES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-300"
                >
                  What's new
                </a>
              </span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/70">
          {links.map((link, index) => {
            const Icon = link.icon || ExternalLink;
            return (
              <React.Fragment key={link.href}>
                <a
                  href={link.href}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                  <Icon className="h-3 w-3" />
                </a>
                {index < links.length - 1 && (
                  <span className="hidden sm:inline text-muted-foreground/30">•</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
        {currentVersion && (
          <div className="text-xs text-muted-foreground/50 space-x-2">
            <span>Version {currentVersion}</span>
            <span className="text-muted-foreground/30">•</span>
            <a
              href={APP_CONFIG.DOCS_RELEASE_NOTES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Release Notes
            </a>
          </div>
        )}
      </div>
    </footer>
  );
};

export default PageFooter;
