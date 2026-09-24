import type { Metadata } from "next";
import { Rubik } from "next/font/google";

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
    <html lang="en" className={rubik.variable}>
      <body>{children}</body>
    </html>
  );
}
