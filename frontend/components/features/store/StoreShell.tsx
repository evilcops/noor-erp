"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin, ShoppingBag, LogOut, Menu, X, Search } from "lucide-react";
import { Suspense, useState } from "react";
import { useStoreAuth } from "@/components/features/store/StoreAuthContext";
import { useStoreCart } from "@/components/features/store/StoreCartContext";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/store", label: "Shop" },
  { href: "/store/orders", label: "Orders" },
  { href: "/store/cart", label: "Cart" },
];

function StoreShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, customer, isAuthenticated, logout } = useStoreAuth();
  const { itemCount } = useStoreCart();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  return (
    <div className="store-shell min-h-screen bg-[#f7f7f7] text-slate-900">
      <div className="bg-[#0f9f6e] px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white sm:text-xs">
        Fast delivery · Live stock · Easy checkout
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/store" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0f9f6e] text-sm font-bold text-white">
              N
            </span>
            <span className="text-lg font-bold tracking-tight text-[#0f9f6e]">
              noor<span className="text-slate-800">store</span>
            </span>
          </Link>

          <button
            type="button"
            className="ml-2 hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 transition hover:border-[#0f9f6e]/40 md:flex"
          >
            <MapPin className="h-4 w-4 shrink-0 text-[#0f9f6e]" />
            <span className="truncate">
              {customer?.address || customer?.area || "Select your delivery address"}
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden max-w-[120px] truncate text-sm text-slate-600 sm:inline">
                  Hi, {user?.firstName}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="hidden h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/store/login"
                  className="hidden h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
                >
                  Log in
                </Link>
                <Link
                  href="/store/register"
                  className="hidden h-10 items-center rounded-lg bg-[#0f9f6e] px-4 text-sm font-semibold text-white hover:bg-[#0d8a5f] sm:inline-flex"
                >
                  Sign up
                </Link>
              </>
            )}

            <Link
              href="/store/cart"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0f9f6e] px-1 text-[11px] font-bold text-white">
                  {itemCount}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
            <nav className="flex items-center gap-1 overflow-x-auto">
              {TABS.map((tab) => {
                const active =
                  tab.href === "/store"
                    ? pathname === "/store"
                    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
                      active
                        ? "border-[#0f9f6e] text-[#0f9f6e]"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <form
              className="relative ml-auto hidden min-w-[280px] flex-1 max-w-md lg:block"
              onSubmit={(e) => {
                e.preventDefault();
                const q = query.trim();
                router.push(q ? `/store?q=${encodeURIComponent(q)}` : "/store");
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products and brands"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none ring-[#0f9f6e]/30 focus:bg-white focus:ring-2"
              />
            </form>
          </div>
        </div>

        {open ? (
          <div className="border-t border-slate-100 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {tab.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                  className="rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Log out
                </button>
              ) : (
                <>
                  <Link
                    href="/store/login"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/store/register"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-[#0f9f6e] hover:bg-slate-50"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>

      <footer className="mt-8 border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-semibold text-slate-800">noorstore</p>
          <p>Shop products · Checkout online · Rider delivery</p>
        </div>
      </footer>
    </div>
  );
}

export function StoreShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <StoreShellInner>{children}</StoreShellInner>
    </Suspense>
  );
}
