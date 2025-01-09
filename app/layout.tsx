import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  colorScheme: "light",
  themeColor: "#ffffff",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Real-Time AI Translation Platform",
  description: "A minimalist real-time AI-powered translation platform for seamless communication across languages. Perfect for travelers to communicate with locals instantly.",
  keywords: ["translation", "AI", "real-time", "language", "communication", "travel"],
  authors: [{ name: "Your Name" }],
  openGraph: {
    title: "Real-Time AI Translation Platform",
    description: "A minimalist real-time AI-powered translation platform for seamless communication across languages. Perfect for travelers to communicate with locals instantly.",
    type: "website",
    siteName: "Real-Time AI Translation Platform",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Real-Time AI Translation Platform Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Real-Time AI Translation Platform",
    description: "A minimalist real-time AI-powered translation platform for seamless communication across languages.",
    images: {
      url: `${APP_URL}/api/og`,
      alt: "Real-Time AI Translation Platform Preview",
      width: 1200,
      height: 630,
    },
    creator: "@DatoBHJ",
    site: "@DatoBHJ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
