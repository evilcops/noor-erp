import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-foreground">
          N
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company registration wizard — coming soon
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        Registration will be part of the company setup wizard. The first user
        becomes Business Owner.
      </div>

      <Link href="/login" className="mt-6 block">
        <Button variant="secondary" className="w-full">
          Back to sign in
        </Button>
      </Link>
    </div>
  );
}
