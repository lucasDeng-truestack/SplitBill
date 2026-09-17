import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, DM_Mono } from "next/font/google";
import "./globals.css";

const vietnam = Be_Vietnam_Pro({
  variable: "--font-vietnam",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Receipt Splitter",
  description: "Snap the bill, walk up to each person, take what they owe, then pay the counter.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${vietnam.variable} ${dmMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-table text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
