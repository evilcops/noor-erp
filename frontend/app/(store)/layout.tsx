import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NOOR Store",
  description: "Customer storefront has moved to the dedicated store app",
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
