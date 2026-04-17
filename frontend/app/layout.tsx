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

// ---------------------------------------------------------------------------
// Social preview metadata
//
// LinkedIn, Slack, and Twitter/X pull a thumbnail from the `og:image` tag
// (with `twitter:image` as fallback). All three require:
//   - an absolute image URL (relative paths fail silently)
//   - the image reachable anonymously (no auth)
//   - the image under ~5 MB
//
// Next.js resolves relative image paths in the metadata below against
// `metadataBase`, so we keep the image reference relative here and let
// the build pick the right absolute host. Override the origin per
// environment via NEXT_PUBLIC_SITE_URL (e.g. your Railway custom domain).
//
// After changing any OG tag, re-scrape via LinkedIn Post Inspector
// (https://www.linkedin.com/post-inspector/) — LinkedIn caches results
// for ~7 days and will keep showing the old preview otherwise.
// ---------------------------------------------------------------------------
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://aegis-range.up.railway.app";
const SITE_TITLE = "AegisRange - Cybersecurity Simulation Platform";
const SITE_DESCRIPTION =
  "Security Operations Center dashboard for the AegisRange cybersecurity simulation platform.";
const OG_IMAGE_PATH = "/images/aegisrange-og.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "AegisRange",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "AegisRange cybersecurity simulation platform dashboard",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

// Inline script that runs before React hydrates so the correct theme class
// is applied to <html> on first paint (prevents a flash of the wrong theme).
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
