"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthScene, authButtonClass, authInputClass } from "@/components/AuthScene";
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
    <AuthScene
      eyebrow="Join NOOR"
      title="Create account"
      subtitle="Then we will ask for your branch and delivery address."
    >
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
              className={authInputClass}
            />
          </label>
        ))}
        <button type="submit" disabled={busy} className={authButtonClass}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-[var(--forest)]">
          Log in
        </Link>
      </p>
    </AuthScene>
  );
}
