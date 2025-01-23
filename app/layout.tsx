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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nametwolangs.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "NameTwoLangs - Real-Time AI Translation",
  description: "Instantly translate between any two languages with AI-powered voice recognition. Perfect for travelers and language learners to communicate naturally.",
  keywords: ["translation", "AI", "real-time", "language", "communication", "travel", "voice translation", "two-way translation"],
  authors: [{ name: "DatoBHJ - King BOB" }],
  openGraph: {
    title: "NameTwoLangs - Real-Time AI Translation",
    description: "Instantly translate between any two languages with AI-powered voice recognition. Perfect for travelers and language learners to communicate naturally.",
    type: "website",
    siteName: "NameTwoLangs",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "NameTwoLangs - Real-Time AI Translation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NameTwoLangs - Real-Time AI Translation",
    description: "Instantly translate between any two languages with AI-powered voice recognition.",
    images: {
      url: `${APP_URL}/api/og`,
      alt: "NameTwoLangs - Real-Time AI Translation",
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Desktop Layout */}
        <div className="hidden md:flex min-h-screen items-center justify-center bg-neutral-100">
          <div className="relative w-[360px] h-[700px] bg-black rounded-[55px] shadow-xl border-[10px] border-black">
            {/* iPhone Frame Inner Border */}
            <div className="absolute inset-0 rounded-[45px] pointer-events-none border border-neutral-600/20" />
            {/* iPhone Dynamic Island */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[32px] w-[126px] bg-black rounded-b-[18px] z-[100]" />
            {/* iPhone Frame Content */}
            <div className="relative h-full w-full bg-white rounded-[45px] overflow-hidden">
              <div className="absolute inset-0 overflow-y-auto overflow-x-hidden">
                {children}
              </div>
            </div>
          </div>
          <div className="absolute bottom-16 text-center">
            <p className="text-[11px] tracking-[0.4em] uppercase text-black font-light">
              APP IS DESIGNED FOR MOBILE
            </p>
          </div>
        </div>
        {/* Mobile Layout */}
        <div className="md:hidden bg-white overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
