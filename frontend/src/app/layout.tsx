import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "imgcompress",
  description: "imgcompress: Image Compression Tool"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="fixed right-3 top-3 z-50 flex items-start gap-2">
            <div className="flex flex-col items-end gap-2">
              <a
                href="https://paypal.me/KarimZouine972"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-md transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 dark:border-white/10 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900/95 border-slate-200 bg-white/95 text-slate-900 hover:bg-white"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ImgCompress is forever free. Donate via PayPal to support ongoing improvements."
                title="ImgCompress is forever free. Donate via PayPal to support ongoing improvements."
              >
                <span className="text-base">💙</span>
                <span className="hidden sm:inline">Donate via PayPal to support updates</span>
              </a>
              <a
                href="https://github.com/karimz1/imgcompress"
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 dark:border-white/10 dark:bg-slate-900/75 dark:text-slate-100 dark:hover:bg-slate-900/90 border-slate-200 bg-white/85 text-slate-800 hover:bg-white"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Star on GitHub helps the project grow and keeps updates coming."
                title="Star on GitHub helps the project grow and keeps updates coming."
              >
                <span className="text-base">⭐</span>
                <span className="hidden sm:inline">Star on GitHub to help it grow</span>
              </a>
            </div>
            <ThemeToggle />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
