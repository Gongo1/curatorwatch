import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CuratorWatch - Track DeFi Vault Curators",
  description:
    "Real-time intelligence on vault curators. Track $721M across 33 curators managing Morpho V2 vaults. Monitor changes, assess risk, compare strategies.",
  keywords: ["DeFi", "Morpho", "vault curators", "risk intelligence", "yield"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
