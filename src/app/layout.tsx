import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import "./globals.css";

// Roboto is the only typeface in the system. It is a variable font, so every
// weight the scale uses (300–700) comes from one file. latin-ext carries the
// rupee sign (U+20B9), which is on nearly every screen — without it ₹ falls
// back to a system face beside Roboto digits.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext"],
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
    <html lang="en" className={roboto.variable}>
      <body>{children}</body>
    </html>
  );
}
