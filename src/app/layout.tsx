import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
  openGraph: {
    title: "CuratorWatch",
    description: "Track DeFi vault curators",
    url: "https://curatorwatch.com",
    siteName: "CuratorWatch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CuratorWatch",
    description: "Track DeFi vault curators",
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
      </body>
    </html>
  );
}
