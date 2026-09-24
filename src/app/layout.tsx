import type { Metadata } from "next";
import { Rubik } from "next/font/google";

import { ThemeController } from "@/components/theme/theme-controller";
import { THEME_BOOTSTRAP } from "@/lib/theme";

import "./globals.css";

// Rubik is the only typeface in the system. It is a variable font, so every
// weight the scale uses (300–700) comes from one file.
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GoDND",
    template: "%s · GoDND",
  },
  description:
    "Build and sell travel experiences — itineraries, bookings, payments and your own branded site.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme defaults to dark on the server; the bootstrap script corrects
    // it from the stored preference before first paint, so the DOM and the
    // server HTML legitimately differ here — hence suppressHydrationWarning.
    <html lang="en" data-theme="dark" className={rubik.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
