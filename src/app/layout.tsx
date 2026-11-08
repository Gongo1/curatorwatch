import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/AppShell";
import { GateProvider } from "@/lib/gate/GateProvider";
import { GATE_ENABLED } from "@/lib/gate/config";
import "./globals.css";

// One UI family. Archivo's width axis does the terminal work: condensed for
// labels, titles and the function bar (`.label`, `.cond`, `.panel-title`),
// normal width for prose.
const archivo = Archivo({
  variable: "--font-sans-face",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

// Figures, codes and the command line only — never as a label costume.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
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
    // Font variables live on <html>: the theme tokens (--font-sans/--font-mono)
    // resolve at :root, so the face variables must exist there too.
    <html lang="en" className={`dark ${archivo.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        {GATE_ENABLED ? <ClerkProvider>{shell}</ClerkProvider> : shell}
        <Analytics />
      </body>
    </html>
  );
}
