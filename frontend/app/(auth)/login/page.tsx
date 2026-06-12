import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/features/auth/LoginForm";

export const metadata = {
  title: "Sign in",
  description: "Sign in to NOOR ERP — Business Operations Platform",
};

function LoginFormFallback() {
  return (
    <div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />
  );
}

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-foreground">
          N
        </div>
        <h1 className="text-2xl font-semibold text-foreground">NOOR ERP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business Operations Platform for Oman &amp; GCC
        </p>
      </div>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Register company
        </Link>
      </p>
    </div>
  );
}
