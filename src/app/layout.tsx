import type { Metadata } from "next";
import { Fraunces, Inter, Poppins } from "next/font/google";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Headings on the product landing pages (see .lp in globals.css).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
