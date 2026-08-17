"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/shop");
  }, [router]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="h-12 w-12 animate-pulse rounded-full bg-[var(--mint)]" />
    </div>
  );
}
