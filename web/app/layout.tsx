import type { Metadata, Viewport } from "next";
import type React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import "./globals.css";

// the design system fonts: Geist Sans for all text, Geist Mono for data.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bnbagent.trade"),
  title: { default: SITE_NAME, template: `%s, ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/brand/mark-32.png", sizes: "32x32" },
      { url: "/brand/mark.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/mark-512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e11",
  colorScheme: "dark",
};

/*
 * Pages compose SiteNav / SiteFooter themselves (the marketplace hides the CTA).
 * `dark` on <html> is not a theme switch — the site is dark-only and :root and
 * .dark carry the same palette — it is there so the `dark:` variants inside the
 * generated shadcn components resolve instead of falling back to light values.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark h-full", sans.variable, mono.variable)}>
      <body className="min-h-full overflow-x-hidden font-sans">
        {/*
          Sections enter with Magic UI's BlurFade, which is a
          client component: it server-renders its children inside
          `style="opacity:0;filter:blur(6px);transform:translateY(-6px)"` and
          only reveals them once motion hydrates. The words are in the HTML, so
          a crawler reads the page — but a visitor with JavaScript off would see
          a blank one. This override runs only when scripting is disabled, and
          cannot affect the animation for anyone else.
        */}
        <noscript>
          <style>{`[style*="blur("],[style*="rotateX("]{opacity:1!important;filter:none!important;transform:none!important}`}</style>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
