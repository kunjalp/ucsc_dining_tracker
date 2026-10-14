import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import DeepLinkHandler from './components/DeepLinkHandler'
import { TEXT_SIZE_BOOT_SCRIPT } from '@/lib/textSize'
import "./globals.css";

// The app's one typeface. Pages used to name 'Plus Jakarta Sans' in an
// inline style without ever loading it, so iOS silently fell back to the
// system font. Self-hosted by next/font; only the weights the UI uses
// (font-medium/semibold/bold -- extrabold/black resolve to 700).
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sammy's Palate",
  description: "A macro and nutrition tracker for UC Santa Cruz dining halls",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale/userScalable: blocking pinch-zoom locks out low-vision
  // users (WCAG 1.4.4). 16px inputs keep iOS from auto-zooming on focus.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased`}
      // The boot script below may set an inline font-size before hydration
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved Text size before first paint (see lib/textSize.ts) */}
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <DeepLinkHandler />
        {children}
      </body>
    </html>
  );
}
