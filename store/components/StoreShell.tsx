"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Package, ShoppingBag, UserRound } from "lucide-react";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { useStoreCart } from "@/components/StoreCartContext";
import { useStoreLocation } from "@/components/LocationContext";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/shop", label: "Shop", icon: Home },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/login", label: "Account", icon: UserRound },
];

export function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useStoreAuth();
  const { itemCount } = useStoreCart();
  const { location } = useStoreLocation();
  const hideChrome = pathname === "/login" || pathname === "/register";
  const locationHref = isAuthenticated ? "/location" : "/login?from=/location";
  const locationLabel = !isAuthenticated
    ? "Log in to set delivery"
    : location?.address || location?.branchName || "Set delivery location";

  return (
    <div className="store-root min-h-dvh text-[var(--ink)]">
      {!hideChrome ? (
        <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
            <Link href="/shop" className="flex items-center gap-2.5">
              <span className="brand-mark h-9 w-9 text-sm">N</span>
              <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight lowercase">
                noor<span className="text-[var(--forest)]">store</span>
              </span>
            </Link>

            <BranchSwitcher className="ml-1" />

            <Link
              href={locationHref}
              className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-black/5 bg-[var(--cream)] px-3 py-2 text-left text-sm text-[var(--muted)] transition hover:border-[var(--forest)]/40 md:flex"
            >
              <MapPin className="h-4 w-4 shrink-0 text-[var(--forest)]" />
              <span className="truncate">{locationLabel}</span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <span className="hidden text-sm text-[var(--muted)] md:inline">
                    Hi, {user?.firstName}
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="hidden rounded-full border border-black/10 px-3 py-1.5 text-sm font-bold hover:bg-[var(--cream)] sm:inline-flex"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="hidden rounded-full bg-[var(--forest)] px-4 py-2 text-sm font-extrabold text-white shadow-md shadow-[rgba(var(--brand-shadow),0.28)] hover:bg-[var(--forest-dark)] sm:inline-flex"
                >
                  Log in
                </Link>
              )}
              <Link
                href="/cart"
                className="relative grid h-10 w-10 place-items-center rounded-full bg-[var(--forest)] text-white shadow-md shadow-[rgba(var(--brand-shadow),0.35)]"
              >
                <ShoppingBag className="h-4 w-4" />
                {itemCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--ink)] px-1 text-[10px] font-extrabold text-white">
                    {itemCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        </header>
      ) : null}

      <main
        className={cn(
          "mx-auto w-full max-w-[1600px] px-4 lg:px-8",
          hideChrome ? "pb-8 pt-6" : "pb-24 pt-4 sm:pb-10 sm:pt-6"
        )}
      >
        {children}
      </main>

      {!hideChrome ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
          <div className="grid grid-cols-4 gap-1 py-2">
            {NAV.map((item) => {
              const href = item.href === "/login" && isAuthenticated ? "/orders" : item.href;
              const active =
                pathname === href || (item.href === "/shop" && pathname.startsWith("/products"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-extrabold",
                    active ? "text-[var(--forest)]" : "text-[var(--muted)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                  {item.href === "/cart" && itemCount > 0 ? (
                    <span className="absolute right-3 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--ink)] px-1 text-[9px] text-white">
                      {itemCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
