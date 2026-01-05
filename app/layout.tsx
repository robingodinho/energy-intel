import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Discover | U.S. Energy Intelligence",
  description: "AI-powered regulatory intelligence for U.S. energy policy. Stay updated on FERC, EPA, DOE, and EIA announcements.",
  keywords: ["energy policy", "FERC", "EPA", "DOE", "EIA", "renewable energy", "LNG", "emissions"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}>
        {children}
      </body>
    </html>
  );
}
