import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { I18nProvider } from "@/context/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogCaptureBootstrap } from "@/components/LogCaptureBootstrap";

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
  icons: {
    icon: "/favicon-logo-face.webp",
    shortcut: "/favicon-logo-face.webp",
    apple: "/favicon-logo-face.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/logo_transparent.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/logo-face.webp" type="image/webp" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <LogCaptureBootstrap />
            <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
