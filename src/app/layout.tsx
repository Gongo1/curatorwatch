import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/AppShell";
import { GateProvider } from "@/lib/gate/GateProvider";
import { GATE_ENABLED } from "@/lib/gate/config";
import "./globals.css";

// Body sans is now real Geist (the --font-geist-sans alias was previously Inter).
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Display face self-hosted (was a render-blocking Fontshare stylesheet).
const cabinetGrotesk = localFont({
  // Only the weights actually used (font-display is only ever bold/extrabold).
  src: [
    { path: "../fonts/cabinet-grotesk-700.woff2", weight: "700" },
    { path: "../fonts/cabinet-grotesk-800.woff2", weight: "800" },
  ],
  variable: "--font-cabinet",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://curatorwatch.com"),
  title: "CuratorWatch - Track DeFi Vault Curators",
  description:
    "Hourly intelligence on DeFi vault curators. Track managed vaults across Morpho, Aave, Euler, Compound, Spark, and more. Monitor changes, assess risk, compare strategies.",
  keywords: ["DeFi", "Morpho", "Aave", "Euler", "vault curators", "risk intelligence", "yield", "multi-protocol"],
  // Favicons come from the app/icon.png + app/apple-icon.png file conventions —
  // pointing icons at /logo.png shipped the raw 731KB PNG on every page load.
  openGraph: {
    title: "CuratorWatch",
    description: "Track DeFi vault curators",
    url: "https://curatorwatch.com",
    siteName: "CuratorWatch",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "CuratorWatch Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "CuratorWatch",
    description: "Track DeFi vault curators",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Account gate (flag-dark): ClerkProvider + GateProvider wrap the shell only
  // when the flag is on, so the dark path ships zero auth JS or behavior change.
  const shell = (
    <GateProvider>
      <AppShell>{children}</AppShell>
    </GateProvider>
  );
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${jetbrainsMono.variable} ${cabinetGrotesk.variable} antialiased`}
      >
        {GATE_ENABLED ? <ClerkProvider>{shell}</ClerkProvider> : shell}
        <Analytics />
      </body>
    </html>
  );
}
