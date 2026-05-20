import type { Metadata, Viewport } from "next";
import { Manrope, Space_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Display — variable humanist sans, used for track titles. Tight, warm,
// pairs cleanly with Space Mono chrome.
const manrope = Manrope({
  variable: "--font-manrope",
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
    <html lang="en" className={`${manrope.variable} ${spaceMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('reso-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
      <GoogleAnalytics gaId="G-J3H5VM8C7D" />
    </html>
  );
}
