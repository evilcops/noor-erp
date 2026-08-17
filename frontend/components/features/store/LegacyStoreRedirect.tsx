"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3001";

/** Old in-app store routes now live in the separate `store/` frontend. */
export default function LegacyStoreRedirect({ to = "/" }: { to?: string }) {
  const router = useRouter();

  useEffect(() => {
    const target = `${STORE_URL}${to}`;
    window.location.href = target;
  }, [router, to]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      Redirecting to NOOR Store…
    </div>
  );
}
