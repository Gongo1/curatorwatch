import type { Metadata } from "next";
import { Open_Sans, JetBrains_Mono, Libre_Franklin } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/AppShell";
import { GateProvider } from "@/lib/gate/GateProvider";
import { GATE_ENABLED } from "@/lib/gate/config";
import "./globals.css";

// Body / UI sans — Open Sans, the body face in the J.P. Morgan type model.
const openSans = Open_Sans({
  variable: "--font-sans-face",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Display / headings — Libre Franklin, a Franklin Gothic revival standing in
// for J.P. Morgan's Amplitude (licensed, so unavailable here). It's a variable
// font, so the bold/extrabold headings come from the one downloaded file.
const libreFranklin = Libre_Franklin({
  variable: "--font-display-face",
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
    <html lang="en" className="dark">
      <body
        className={`${openSans.variable} ${jetbrainsMono.variable} ${libreFranklin.variable} antialiased`}
      >
        {GATE_ENABLED ? <ClerkProvider>{shell}</ClerkProvider> : shell}
        <Analytics />
      </body>
    </html>
  );
}
