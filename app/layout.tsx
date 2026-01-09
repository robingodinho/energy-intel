import type { Metadata } from "next";
import { Inter, Sora, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700"],
});

// Elegant serif font for the enerva brand - Didone style with high contrast
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "enerva | AI-Driven Energy Intelligence",
  description: "AI-driven intelligence for energy policy and infrastructure. Stay updated on U.S. energy policy, grid reliability, and energy security.",
  keywords: ["enerva", "energy policy", "FERC", "EPA", "DOE", "EIA", "renewable energy", "LNG", "emissions", "grid reliability", "energy security", "AI"],
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
    other: [
      { rel: "android-chrome", url: "/brand/android-chrome-192x192.png", sizes: "192x192" },
      { rel: "android-chrome", url: "/brand/android-chrome-512x512.png", sizes: "512x512" },
    ],
  },
  manifest: "/brand/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${sora.variable} ${cormorant.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
