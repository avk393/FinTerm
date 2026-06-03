import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

// A clean geometric grotesque that reads close to Robinhood's house font.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Robinhood-style portfolio dashboard powered by Alpaca",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="bg-rh-bg text-rh-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
