import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Wellness Center USA",
    template: "%s · Wellness Center USA",
  },
  description: "Independent health and wellness product research.",
  // Search Console verification is NOT here — it lives in the public layout,
  // so it is emitted on public pages only. See the note there.
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
