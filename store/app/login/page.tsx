"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { useStoreLocation } from "@/components/LocationContext";
import { ApiClientError } from "@/lib/api/client";
import { getStoredLocation } from "@/lib/location";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, isAuthenticated } = useStoreAuth();
  const { location } = useStoreLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const hasLocation = Boolean(location?.inService || getStoredLocation()?.inService);
    router.replace(hasLocation ? params.get("from") || "/shop" : "/location");
  }, [isAuthenticated, location, params, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      const hasLocation = Boolean(getStoredLocation()?.inService);
      router.push(hasLocation ? params.get("from") || "/shop" : "/location");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-float-in py-6">
      <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(16,35,26,0.5)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--forest)]">Account</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">Log in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Use your NOOR Store customer account.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-[var(--sand)] px-4 outline-none ring-[var(--forest)]/30 focus:ring-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-[var(--sand)] px-4 outline-none ring-[var(--forest)]/30 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-full bg-[var(--forest)] font-extrabold text-white hover:bg-[var(--forest-dark)] disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          New here?{" "}
          <Link href="/register" className="font-semibold text-[var(--forest)]">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-[2rem] bg-white" />}>
      <LoginForm />
    </Suspense>
  );
}
