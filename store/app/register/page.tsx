"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { ApiClientError } from "@/lib/api/client";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useStoreAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      toast.success("Account created — set your delivery location");
      router.push("/location");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md animate-float-in py-6">
      <div className="rounded-[2rem] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(16,35,26,0.5)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--forest)]">Join NOOR</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">Sign up</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Create your account first. Next we&apos;ll ask for your branch and delivery address.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {(
            [
              ["name", "Full name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "tel"],
              ["password", "Password (min 8)", "password"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block text-sm font-semibold">
              {label}
              <input
                type={type}
                required
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-[var(--sand)] px-4 outline-none ring-[var(--forest)]/30 focus:ring-2"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-full bg-[var(--forest)] font-extrabold text-white hover:bg-[var(--forest-dark)] disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--forest)]">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
