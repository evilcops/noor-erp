"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthScene, authButtonClass, authInputClass } from "@/components/AuthScene";
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
    <AuthScene
      eyebrow="Welcome back"
      title="Log in"
      subtitle="Use your NOOR Store customer account."
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </label>
        <button type="submit" disabled={busy} className={authButtonClass}>
          {busy ? "Signing in…" : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        New here?{" "}
        <Link href="/register" className="font-bold text-[var(--forest)]">
          Create an account
        </Link>
      </p>
    </AuthScene>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-80 max-w-md rounded-[1.75rem]" />}>
      <LoginForm />
    </Suspense>
  );
}
