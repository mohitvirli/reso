import type { Metadata, Viewport } from "next";
import { Caveat, Space_Mono } from "next/font/google";
import "./globals.css";

// Display — handwritten variable serif, used only for track titles.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
});

// Mono — chrome, body, labels, timecodes. The project's voice.
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Reso — listen closer",
  description: "A retro-futuristic offline music player.",
};

export const viewport: Viewport = {
  themeColor: "#f1ead8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${caveat.variable} ${spaceMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
