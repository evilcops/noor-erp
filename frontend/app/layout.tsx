import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NOOR ERP",
    template: "%s | NOOR ERP",
  },
  description: "Business Operations Platform for Oman/GCC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <body
        suppressHydrationWarning
        className="min-h-full font-sans antialiased"
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
