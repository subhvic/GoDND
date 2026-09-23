import type { Metadata } from "next";
import { Outfit, Roboto } from "next/font/google";

import "./globals.css";

// Roboto is the portal's type system; Outfit carries the GoDND wordmark only.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GoDND Portal",
    template: "%s · GoDND Portal",
  },
  description:
    "Build and sell travel experiences — itineraries, bookings, payments and your own branded site.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
