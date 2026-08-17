import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const body = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Nunito({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "NOOR Store",
    template: "%s | NOOR Store",
  },
  description: "Shop NOOR products from your nearest branch with fast delivery",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} font-[family-name:var(--font-body)] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
