"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Package, ShoppingBag, UserRound } from "lucide-react";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { useStoreCart } from "@/components/StoreCartContext";
import { useStoreLocation } from "@/components/LocationContext";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { cn } from "@/lib/utils";

export function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const { isAuthenticated, user, logout } = useStoreAuth();
  const { itemCount } = useStoreCart();
  const { location }  = useStoreLocation();
  const hideChrome    = pathname === "/login" || pathname === "/register";
  const locationHref  = isAuthenticated ? "/location" : "/login?from=/location";
  const locationLabel = !isAuthenticated
    ? "Set location"
    : location?.address || location?.branchName || "Set location";

  const navItems = [
    { href: "/shop",   label: "Shop",    icon: Home },
    { href: "/orders", label: "Orders",  icon: Package },
    { href: isAuthenticated ? "/orders" : "/login", label: "Account", icon: UserRound },
  ];

  return (
    <div className="min-h-dvh text-[var(--ink)]">
      {/* Drifting aurora backdrop */}
      <div className="aurora" aria-hidden="true"><span className="orb" /></div>

      {/* ── Glass header ─────────────────────────── */}
      {!hideChrome && (
        <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
          <div className="glass-strong mx-auto flex h-14 max-w-[1500px] items-center gap-2 rounded-2xl px-3 sm:gap-3 sm:px-5">
            {/* Logo */}
            <Link href="/shop" className="flex shrink-0 items-center gap-2">
              <span className="brand-mark h-8 w-8 text-[13px]">N</span>
              <span className="hidden font-[family-name:var(--font-display)] text-base font-black sm:block">
                noor<span className="text-sunrise">store</span>
              </span>
            </Link>

            <BranchSwitcher className="ml-0.5" />

            {/* Location — desktop */}
            <Link
              href={locationHref}
              className="hidden min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white/60 px-3.5 py-2 text-sm text-[var(--muted)] ring-1 ring-white/80 transition hover:ring-[var(--forest)]/30 md:flex"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--forest)]" />
              <span className="truncate">{locationLabel}</span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <span className="hidden text-sm font-medium text-[var(--muted)] lg:inline">
                    Hi, {user?.firstName}
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="hidden rounded-full bg-white/60 px-3.5 py-1.5 text-sm font-semibold text-[var(--muted)] ring-1 ring-white/80 transition hover:text-[var(--ink)] sm:block"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="hidden rounded-full bg-gradient-to-r from-[#ff7a2f] to-[var(--forest)] px-4 py-2 text-sm font-extrabold text-white shadow-[0_6px_18px_-6px_rgba(255,90,0,0.6)] transition hover:shadow-[0_8px_24px_-6px_rgba(255,90,0,0.8)] sm:block"
                >
                  Log in
                </Link>
              )}

              {/* Cart — desktop header (mobile uses dock) */}
              <Link
                href="/cart"
                className="relative hidden h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#ff7a2f] to-[var(--forest)] text-white shadow-[0_6px_18px_-6px_rgba(255,90,0,0.6)] transition hover:scale-105 sm:grid"
              >
                <ShoppingBag className="h-4 w-4" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--ink)] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {itemCount}
                  </span>
                )}
              </Link>

              {/* Mobile: compact location button */}
              <Link
                href={locationHref}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/60 text-[var(--forest)] ring-1 ring-white/80 md:hidden"
                aria-label="Delivery location"
              >
                <MapPin className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* ── Content ─────────────────────────────── */}
      <main
        className={cn(
          hideChrome
            ? "w-full p-0"
            : "mx-auto w-full max-w-[1500px] px-4 pb-32 pt-5 sm:pb-12 sm:pt-7 lg:px-8"
        )}
      >
        {children}
      </main>

      {/* ── Floating dock nav (mobile) ──────────── */}
      {!hideChrome && (
        <nav className="fixed inset-x-4 bottom-4 z-40 sm:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="glass-strong relative mx-auto flex max-w-sm items-center justify-around rounded-[1.6rem] px-2 py-2">
            {/* left two items */}
            {navItems.slice(0, 2).map((item) => {
              const active = pathname === item.href || (item.href === "/shop" && pathname.startsWith("/products"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1 text-[10px] font-bold transition",
                    active ? "text-[var(--forest)]" : "text-[var(--muted)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}

            {/* raised cart FAB */}
            <Link
              href="/cart"
              aria-label="Cart"
              className="animate-glow-pulse relative -mt-9 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#ff8a3d] to-[var(--forest)] text-white ring-4 ring-white/90 transition active:scale-90"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--ink)] px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* right item + account */}
            {navItems.slice(2).map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1 text-[10px] font-bold transition",
                    active ? "text-[var(--forest)]" : "text-[var(--muted)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}

            <Link
              href={locationHref}
              className="flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1 text-[10px] font-bold text-[var(--muted)] transition"
            >
              <MapPin className="h-5 w-5" />
              Area
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
