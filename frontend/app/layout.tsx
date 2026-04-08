import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
  title: "AegisRange - Cybersecurity Simulation Platform",
  description:
    "Security Operations Center dashboard for the AegisRange cybersecurity simulation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-[family-name:var(--font-geist-sans)] bg-[#0a0a0a] text-gray-100 antialiased`}
      >
        <Sidebar />
        <main className="ml-56 min-h-screen">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </body>
    </html>
  );
}
