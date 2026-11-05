import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "SyncLab: multiplayer netcode, made visible";
const description =
  "A live multiplayer lab: watch client prediction, server reconciliation and interpolation fight latency, jitter and packet loss you control. Naive vs predicted, side by side.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title,
  description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.github }],
  keywords: [
    "netcode",
    "client-side prediction",
    "server reconciliation",
    "snapshot interpolation",
    "multiplayer",
    "websockets",
    "game networking",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
