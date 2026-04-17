import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { ThemeProvider } from "@/lib/theme-context";
import { PlayerProgressProvider } from "@/lib/player-progress";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aegis-range.up.railway.app"),
  title: "AegisRange - Cybersecurity Simulation Platform",
  description:
    "Security Operations Center dashboard for the AegisRange cybersecurity simulation platform.",
  openGraph: {
    title: "AegisRange - Cybersecurity Simulation Platform",
    description:
      "Security Operations Center dashboard for the AegisRange cybersecurity simulation platform.",
    url: "https://aegis-range.up.railway.app",
    siteName: "AegisRange",
    images: [
      {
        url: "/images/aegisrange-og.jpg",
        width: 1200,
        height: 630,
        alt: "AegisRange cybersecurity simulation platform preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AegisRange - Cybersecurity Simulation Platform",
    description:
      "Security Operations Center dashboard for the AegisRange cybersecurity simulation platform.",
    images: ["/images/aegisrange-og.jpg"],
  },
};

const themeInitScript = `(() => {
  try {
    const stored = localStorage.getItem('aegisrange-theme');
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersLight ? 'light' : 'dark');
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
  } catch (_) {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <Script id="ar-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-[family-name:var(--font-geist-sans)] antialiased`}
      >
        <ThemeProvider>
          <PlayerProgressProvider>
            <ErrorBoundary>
              <AppShell>{children}</AppShell>
            </ErrorBoundary>
          </PlayerProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
