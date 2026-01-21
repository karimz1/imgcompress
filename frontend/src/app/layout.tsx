import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Star, Coffee } from "lucide-react";

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
  description: "imgcompress: Image Compression Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Top-LEFT: Support & GitHub Buttons */}
         <div className="fixed left-3 top-3 z-50 flex flex-col items-start gap-2">

            {/* GitHub Star Button */}
            <a
              href="https://github.com/karimz1/imgcompress"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 w-full
                border-amber-200 bg-white text-amber-700 hover:bg-amber-50 hover:shadow-amber-500/20
                dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-amber-500/10 dark:hover:shadow-amber-500/40"
            >
              <Star className="h-4 w-4 fill-amber-400 text-amber-500 transition-transform group-hover:rotate-12" />
              <span className="hidden sm:inline">Star on GitHub</span>
            </a>

            {/* Support Button */}
            <a
              href="https://github.com/sponsors/karimz1"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 w-full
                /* Emerald colors specifically tuned for dark blue backgrounds */
                border-emerald-500/20 bg-slate-900 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40"
            >
              {/* stroke-[3px] makes the icon match the boldness o the font */}
              <Coffee className="h-4 w-4 text-emerald-500 stroke-[3px] transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">Buy me a Coffee</span>
            </a>
          </div>

          {/* Top-RIGHT: Theme Toggle */}
          <div className="fixed right-3 top-3 z-50">
            <ThemeToggle />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
